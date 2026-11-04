package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"

	"hyperline/server/internal/auth"
)

const appOrigin = "http://tauri.localhost"

var nonceN atomic.Int64

// pkce returns a verifier and its challenge.
func pkce() (verifier, challenge string) {
	verifier = auth.RandomToken(32)
	sum := sha256.Sum256([]byte(verifier))
	return verifier, base64.RawURLEncoding.EncodeToString(sum[:])
}

func appEnv(t *testing.T, dev bool) *testEnv {
	e := newTestEnvWith(t, dev, func(c *Config) { c.WebOrigins = []string{web, appOrigin} })
	e.api.authRate = newLimiter(1000, 1000, time.Now) // these tests log in many times
	return e
}

// steamCallbackFor starts a Steam login with the given query and answers the
// callback with a valid Steam response; it returns the callback's response.
func (e *testEnv) steamCallbackFor(loginQuery string) *http.Response {
	e.t.Helper()
	res := e.req("GET", "/auth/steam/login"+loginQuery, "", "", nil)
	login := cookieOf(res, loginCookie)
	if res.StatusCode != http.StatusFound || login == nil {
		e.t.Fatalf("login: %d", res.StatusCode)
	}
	loc, _ := url.Parse(res.Header.Get("Location"))
	returnTo, _ := url.Parse(loc.Query().Get("openid.return_to"))
	claimed := "https://steamcommunity.com/openid/id/76561198000000042"
	q := url.Values{
		"s":                     {returnTo.Query().Get("s")},
		"openid.ns":             {"http://specs.openid.net/auth/2.0"},
		"openid.mode":           {"id_res"},
		"openid.op_endpoint":    {e.steam.URL},
		"openid.claimed_id":     {claimed},
		"openid.identity":       {claimed},
		"openid.return_to":      {returnTo.String()},
		"openid.response_nonce": {time.Now().UTC().Format(time.RFC3339) + fmt.Sprint("n", nonceN.Add(1))},
		"openid.assoc_handle":   {"h"},
		"openid.signed":         {"signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"},
		"openid.sig":            {"s"},
	}
	return e.req("GET", "/auth/steam/callback?"+q.Encode(), "", login.Name+"="+login.Value, nil)
}

var deepLinkRe = regexp.MustCompile(`jukejoint://auth/([A-Za-z0-9_-]{43})`)

// appCode runs the browser half of the app login and returns the code.
func (e *testEnv) appCode(challenge string) string {
	e.t.Helper()
	res := e.steamCallbackFor("?app=" + challenge)
	body, _ := io.ReadAll(res.Body)
	m := deepLinkRe.FindSubmatch(body)
	if res.StatusCode != http.StatusOK || m == nil {
		e.t.Fatalf("app callback: %d %s", res.StatusCode, body)
	}
	return string(m[1])
}

func (e *testEnv) postJSON(path, origin, bearer, body string) *http.Response {
	e.t.Helper()
	r, _ := http.NewRequest("POST", e.srv.URL+path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	if bearer != "" {
		r.Header.Set("Authorization", "Bearer "+bearer)
	}
	res, err := client.Do(r)
	if err != nil {
		e.t.Fatal(err)
	}
	e.t.Cleanup(func() { res.Body.Close() })
	return res
}

func (e *testEnv) exchange(code, verifier string) *http.Response {
	b, _ := json.Marshal(map[string]string{"code": code, "verifier": verifier})
	return e.postJSON("/auth/app/token", appOrigin, "", string(b))
}

type tokenReply struct {
	Token string
	User  struct{ ID, Name string }
}

func decodeToken(t *testing.T, res *http.Response) tokenReply {
	t.Helper()
	var tr tokenReply
	if res.StatusCode != http.StatusOK || json.NewDecoder(res.Body).Decode(&tr) != nil || tr.Token == "" {
		t.Fatalf("token exchange: %d %+v", res.StatusCode, tr)
	}
	return tr
}

func (e *testEnv) meBearer(token string) meView {
	e.t.Helper()
	r, _ := http.NewRequest("GET", e.srv.URL+"/api/me", nil)
	r.Header.Set("Authorization", "Bearer "+token)
	res, err := client.Do(r)
	if err != nil {
		e.t.Fatal(err)
	}
	defer res.Body.Close()
	var v meView
	_ = json.NewDecoder(res.Body).Decode(&v)
	return v
}

func (e *testEnv) dialProtocols(origin string, protos ...string) (*wsConn, *websocket.Conn) {
	e.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(e.srv.URL, "http")+"/api/ws", &websocket.DialOptions{
		HTTPHeader:   http.Header{"Origin": {origin}},
		Subprotocols: protos,
	})
	if err != nil {
		e.t.Fatal(err)
	}
	e.t.Cleanup(func() { c.CloseNow() })
	return &wsConn{e.t, c}, c
}

func TestAppLoginFlow(t *testing.T) {
	e := appEnv(t, false)
	verifier, challenge := pkce()

	res := e.steamCallbackFor("?app=" + challenge)
	body, _ := io.ReadAll(res.Body)
	page := string(body)
	if res.StatusCode != http.StatusOK || res.Header.Get("Location") != "" || cookieOf(res, sessionCookie) != nil {
		t.Fatalf("callback: %d loc=%q", res.StatusCode, res.Header.Get("Location"))
	}
	if csp := res.Header.Get("Content-Security-Policy"); csp != "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" {
		t.Fatalf("csp: %q", csp)
	}
	m := deepLinkRe.FindStringSubmatch(page)
	if m == nil || !strings.Contains(page, `href="`+m[0]+`"`) || !strings.Contains(page, `content="0;url=`+m[0]+`"`) ||
		!strings.Contains(page, "Voltar para o Jukejoint") || !strings.Contains(page, "<title>Login feito</title>") || strings.Contains(page, "<script") {
		t.Fatalf("page: %s", page)
	}
	code := m[1]

	tr := decodeToken(t, e.exchange(code, verifier))
	if tr.User.ID != "76561198000000042" || tr.User.Name != "Jogador 0042" {
		t.Fatalf("user: %+v", tr.User)
	}
	if v := e.meBearer(tr.Token); v.User == nil || v.User.ID != tr.User.ID {
		t.Fatalf("me with Bearer: %+v", v)
	}
	if v := e.meBearer(tr.Token + "x"); v.User != nil {
		t.Fatal("tampered token accepted")
	}

	// The socket takes the token as a subprotocol and the server answers "jukejoint".
	w, raw := e.dialProtocols(appOrigin, "jukejoint", "auth."+tr.Token)
	if raw.Subprotocol() != "jukejoint" {
		t.Fatalf("subprotocol: %q", raw.Subprotocol())
	}
	if m := w.until("welcome"); m["me"] == nil || m["me"].(map[string]any)["id"] != tr.User.ID {
		t.Fatalf("welcome: %v", m)
	}
	w.send(map[string]any{"type": "create", "req": 1, "lobby": map[string]any{"name": "Duelo", "modeSlug": "duelo-meia-noite", "region": "BR", "slots": 8, "minPlayers": 2}})
	if ack := w.until("ack"); ack["lobbyId"] == nil {
		t.Fatalf("create: %v", ack)
	}

	// Logout with the Bearer token drops the session and its sockets.
	if res := e.postJSON("/auth/logout", appOrigin, tr.Token, ""); res.StatusCode != http.StatusNoContent {
		t.Fatalf("logout: %d", res.StatusCode)
	}
	if v := e.meBearer(tr.Token); v.User != nil {
		t.Fatal("session survived logout")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		if _, _, err := w.c.Read(ctx); err != nil {
			if ctx.Err() != nil {
				t.Fatal("socket still open after logout")
			}
			break
		}
	}
}

func TestAppLoginBadChallenge(t *testing.T) {
	e := appEnv(t, false)
	for _, q := range []string{"?app=curto", "?app=" + strings.Repeat("a", 44), "?app=" + strings.Repeat("a", 42) + "!"} {
		if res := e.req("GET", "/auth/steam/login"+q, "", "", nil); res.StatusCode != http.StatusBadRequest || cookieOf(res, loginCookie) != nil {
			t.Fatalf("%s: %d", q, res.StatusCode)
		}
	}
}

func TestAppCodeWrongVerifierBurnsCode(t *testing.T) {
	e := appEnv(t, false)
	verifier, challenge := pkce()
	code := e.appCode(challenge)
	other, _ := pkce()
	for _, bad := range []string{other, "curto"} {
		code := e.appCode(challenge)
		if res := e.exchange(code, bad); res.StatusCode != http.StatusBadRequest {
			t.Fatalf("wrong verifier %q: %d", bad, res.StatusCode)
		}
		if res := e.exchange(code, verifier); res.StatusCode != http.StatusBadRequest {
			t.Fatalf("code usable after a failed try: %d", res.StatusCode)
		}
	}
	// The untouched code still works.
	decodeToken(t, e.exchange(code, verifier))
}

func TestAppCodeReusedAndExpired(t *testing.T) {
	e := appEnv(t, false)
	verifier, challenge := pkce()
	code := e.appCode(challenge)
	decodeToken(t, e.exchange(code, verifier))
	res := e.exchange(code, verifier)
	var errBody map[string]string
	_ = json.NewDecoder(res.Body).Decode(&errBody)
	if res.StatusCode != http.StatusBadRequest || errBody["code"] != "bad_code" || errBody["message"] != "O login expirou ou já foi usado. Tente de novo." {
		t.Fatalf("reuse: %d %v", res.StatusCode, errBody)
	}

	code = e.appCode(challenge)
	e.api.cfg.Now = func() time.Time { return time.Now().Add(appCodeTTL + time.Second) }
	if res := e.exchange(code, verifier); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expired: %d", res.StatusCode)
	}
}

func TestAppCodeTableIsCapped(t *testing.T) {
	e := appEnv(t, false)
	_, challenge := pkce()
	now := time.Now()
	for i := 0; i < maxAppCode; i++ {
		e.api.appCodes[fmt.Sprint("c", i)] = appCode{userID: "u", challenge: challenge, expires: now.Add(time.Minute)}
	}
	res := e.steamCallbackFor("?app=" + challenge)
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("full table: %d", res.StatusCode)
	}
	// Expired entries are pruned on insert, so it recovers.
	for k := range e.api.appCodes {
		e.api.appCodes[k] = appCode{expires: now.Add(-time.Minute)}
	}
	e.appCode(challenge)
	if n := len(e.api.appCodes); n != 1 {
		t.Fatalf("after pruning: %d", n)
	}
}

func TestAppTokenGuards(t *testing.T) {
	e := appEnv(t, false)
	verifier, challenge := pkce()
	code := e.appCode(challenge)
	good, _ := json.Marshal(map[string]string{"code": code, "verifier": verifier})
	if res := e.postJSON("/auth/app/token", "", "", string(good)); res.StatusCode != http.StatusForbidden {
		t.Fatalf("no origin: %d", res.StatusCode)
	}
	if res := e.postJSON("/auth/app/token", "https://evil.example", "", string(good)); res.StatusCode != http.StatusForbidden {
		t.Fatalf("evil origin: %d", res.StatusCode)
	}
	extra := fmt.Sprintf(`{"code":%q,"verifier":%q,"admin":true}`, code, verifier)
	if res := e.postJSON("/auth/app/token", appOrigin, "", extra); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("unknown field: %d", res.StatusCode)
	}
	// Refused requests did not spend the code.
	decodeToken(t, e.postJSON("/auth/app/token", appOrigin, "", string(good)))
}

func TestAppLoginCancelledAndFailed(t *testing.T) {
	e := appEnv(t, false)
	_, challenge := pkce()
	res := e.req("GET", "/auth/steam/login?app="+challenge, "", "", nil)
	login := cookieOf(res, loginCookie)
	loc, _ := url.Parse(res.Header.Get("Location"))
	returnTo, _ := url.Parse(loc.Query().Get("openid.return_to"))
	cancel := url.Values{"s": {returnTo.Query().Get("s")}, "openid.ns": {"http://specs.openid.net/auth/2.0"}, "openid.mode": {"cancel"}}
	res = e.req("GET", "/auth/steam/callback?"+cancel.Encode(), "", login.Name+"="+login.Value, nil)
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK || res.Header.Get("Location") != "" || !strings.Contains(string(body), "Não deu para entrar com a Steam. Volte para o Jukejoint e tente de novo.") || strings.Contains(string(body), "jukejoint://") {
		t.Fatalf("cancelled: %d %s", res.StatusCode, body)
	}
	// A bad answer: failure page, still no redirect to the site.
	res = e.req("GET", "/auth/steam/login?app="+challenge, "", "", nil)
	login = cookieOf(res, loginCookie)
	res = e.req("GET", "/auth/steam/callback?openid.mode=id_res", "", login.Name+"="+login.Value, nil)
	body, _ = io.ReadAll(res.Body)
	if res.StatusCode != http.StatusBadRequest || res.Header.Get("Location") != "" || !strings.Contains(string(body), "Não deu para entrar com a Steam") {
		t.Fatalf("failed: %d %s", res.StatusCode, body)
	}
	// No login cookie at all: unchanged, back to the site.
	if res := e.req("GET", "/auth/steam/callback", "", "", nil); !strings.Contains(res.Header.Get("Location"), "login=falhou") {
		t.Fatalf("no cookie: %d %s", res.StatusCode, res.Header.Get("Location"))
	}
}

func TestDevToken(t *testing.T) {
	off := appEnv(t, false)
	if res := off.postJSON("/auth/dev/token", appOrigin, "", `{"name":"Teste_A"}`); res.StatusCode != http.StatusNotFound {
		t.Fatalf("dev token without DEV_LOGIN: %d", res.StatusCode)
	}
	e := appEnv(t, true)
	if res := e.postJSON("/auth/dev/token", "", "", `{"name":"Teste_A"}`); res.StatusCode != http.StatusForbidden {
		t.Fatalf("no origin: %d", res.StatusCode)
	}
	res := e.postJSON("/auth/dev/token", appOrigin, "", `{"name":"<b>"}`)
	var bad map[string]string
	_ = json.NewDecoder(res.Body).Decode(&bad)
	if res.StatusCode != http.StatusBadRequest || bad["code"] != "bad_name" {
		t.Fatalf("bad name: %d %v", res.StatusCode, bad)
	}
	tr := decodeToken(t, e.postJSON("/auth/dev/token", appOrigin, "", `{"name":"Teste_A"}`))
	if tr.User.ID != "dev:teste_a" {
		t.Fatalf("user: %+v", tr.User)
	}
	if v := e.meBearer(tr.Token); v.User == nil || v.User.ID != "dev:teste_a" || !v.User.Dev {
		t.Fatalf("me: %+v", v)
	}
}

func TestPreflightListsAuthorization(t *testing.T) {
	e := appEnv(t, false)
	res := e.req("OPTIONS", "/auth/app/token", appOrigin, "", nil)
	if res.StatusCode != http.StatusNoContent || res.Header.Get("Access-Control-Allow-Headers") != "Content-Type, Authorization" ||
		res.Header.Get("Access-Control-Allow-Origin") != appOrigin {
		t.Fatalf("preflight: %d %v", res.StatusCode, res.Header)
	}
}

func TestWebSocketCookieWithoutSubprotocol(t *testing.T) {
	e := newTestEnv(t, true)
	w, res, err := e.dial(web, e.devSignIn("Eva"))
	if err != nil {
		t.Fatal(err)
	}
	if p := res.Header.Get("Sec-WebSocket-Protocol"); p != "" {
		t.Fatalf("subprotocol without an offer: %q", p)
	}
	if m := w.until("welcome"); m["me"] == nil {
		t.Fatalf("welcome: %v", m)
	}
}

func TestSubprotocolTokenOnlyOnWebSocket(t *testing.T) {
	e := appEnv(t, true)
	tr := decodeToken(t, e.postJSON("/auth/dev/token", appOrigin, "", `{"name":"Teste_B"}`))
	r, _ := http.NewRequest("GET", e.srv.URL+"/api/me", nil)
	r.Header.Set("Sec-WebSocket-Protocol", "jukejoint, auth."+tr.Token)
	res, err := client.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var v meView
	_ = json.NewDecoder(res.Body).Decode(&v)
	if v.User != nil {
		t.Fatal("subprotocol token accepted outside the WebSocket")
	}
	// Several headers / comma lists on the socket.
	r, _ = http.NewRequest("GET", "/", nil)
	r.Header.Add("Sec-WebSocket-Protocol", "jukejoint")
	r.Header.Add("Sec-WebSocket-Protocol", "x, auth.abc")
	if got := tokenFrom(r, true); got != "abc" {
		t.Fatalf("tokenFrom: %q", got)
	}
	if got := tokenFrom(r, false); got != "" {
		t.Fatalf("tokenFrom without subprotocols: %q", got)
	}
}

func TestNewChecksAppConfig(t *testing.T) {
	for _, scheme := range []string{"Jukejoint", "1abc", "a", "ab-c", "ab://"} {
		public, _ := url.Parse("http://localhost:8090")
		if _, err := New(Config{PublicURL: public, WebOrigins: []string{web}, AppScheme: scheme}); err == nil {
			t.Fatalf("scheme %q accepted", scheme)
		}
	}
	public, _ := url.Parse("http://localhost:8090")
	s, err := New(Config{PublicURL: public, WebOrigins: []string{web}})
	if err != nil || s.appScheme != "jukejoint" || s.appName != "Jukejoint" {
		t.Fatalf("defaults: %v %q %q", err, s.appScheme, s.appName)
	}
}
