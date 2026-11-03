package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"

	"hyperline/server/internal/auth"
	"hyperline/server/internal/lobby"
	"hyperline/server/internal/store"
)

const web = "http://localhost:5199"

type testEnv struct {
	t     *testing.T
	srv   *httptest.Server
	api   *Server
	steam *httptest.Server
}

func newTestEnv(t *testing.T, dev bool) *testEnv {
	t.Helper()
	e := &testEnv{t: t}
	e.steam = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		fmt.Fprint(w, "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n")
	}))
	t.Cleanup(e.steam.Close)

	// The test server's address is only known once it listens, so the handler
	// is swapped in afterwards.
	var h http.Handler = http.NotFoundHandler()
	e.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { h.ServeHTTP(w, r) }))
	t.Cleanup(e.srv.Close)
	public, _ := url.Parse(e.srv.URL)
	st := store.NewMemory(nil)
	api, err := New(Config{
		PublicURL:  public,
		WebOrigins: []string{web},
		DevLogin:   dev,
		Store:      st,
		Hub:        lobby.New(lobby.RealClock{}, Friendship{Store: st}),
		Signer:     auth.NewSigner([]byte(strings.Repeat("k", auth.KeySize))),
		Steam: &auth.Steam{
			Endpoint: e.steam.URL,
			Realm:    e.srv.URL,
			Callback: e.srv.URL + "/auth/steam/callback",
			Nonces:   st,
			Now:      time.Now,
		},
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	e.api = api
	h = api.Handler()
	return e
}

// client never follows redirects, so tests can read Location.
var client = &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

func (e *testEnv) req(method, path, origin, cookie string, body io.Reader) *http.Response {
	e.t.Helper()
	r, _ := http.NewRequest(method, e.srv.URL+path, body)
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	if cookie != "" {
		r.Header.Set("Cookie", cookie)
	}
	if body != nil {
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	res, err := client.Do(r)
	if err != nil {
		e.t.Fatal(err)
	}
	e.t.Cleanup(func() { res.Body.Close() })
	return res
}

func cookieOf(res *http.Response, name string) *http.Cookie {
	for _, c := range res.Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// devSignIn logs a fake user in and returns the session cookie header.
func (e *testEnv) devSignIn(name string) string {
	e.t.Helper()
	res := e.req("POST", "/auth/dev/login", e.srv.URL, "", strings.NewReader(url.Values{"name": {name}, "return": {"/sala/x"}}.Encode()))
	if res.StatusCode != http.StatusSeeOther || res.Header.Get("Location") != web+"/sala/x" {
		e.t.Fatalf("dev login: %d %s", res.StatusCode, res.Header.Get("Location"))
	}
	c := cookieOf(res, sessionCookie)
	if c == nil || !c.HttpOnly || c.SameSite != http.SameSiteLaxMode {
		e.t.Fatalf("session cookie: %+v", c)
	}
	return c.Name + "=" + c.Value
}

func (e *testEnv) me(cookie string) meView {
	e.t.Helper()
	res := e.req("GET", "/api/me", web, cookie, nil)
	var v meView
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		e.t.Fatal(err)
	}
	return v
}

type wsConn struct {
	t *testing.T
	c *websocket.Conn
}

func (e *testEnv) dial(origin, cookie string) (*wsConn, *http.Response, error) {
	h := http.Header{}
	if origin != "" {
		h.Set("Origin", origin)
	}
	if cookie != "" {
		h.Set("Cookie", cookie)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, res, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(e.srv.URL, "http")+"/api/ws", &websocket.DialOptions{HTTPHeader: h})
	if err != nil {
		return nil, res, err
	}
	e.t.Cleanup(func() { c.CloseNow() })
	return &wsConn{e.t, c}, res, nil
}

func (w *wsConn) send(v any) {
	w.t.Helper()
	data, _ := json.Marshal(v)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := w.c.Write(ctx, websocket.MessageText, data); err != nil {
		w.t.Fatal(err)
	}
}

// until reads messages until one of type typ arrives.
func (w *wsConn) until(typ string) map[string]any {
	w.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		_, data, err := w.c.Read(ctx)
		if err != nil {
			w.t.Fatalf("waiting for %s: %v", typ, err)
		}
		var m map[string]any
		_ = json.Unmarshal(data, &m)
		if m["type"] == typ {
			return m
		}
	}
}

/* ───────── Tests ───────── */

func TestNewRefusesDevLoginOffLocalhost(t *testing.T) {
	public, _ := url.Parse("https://lobbies.example")
	_, err := New(Config{PublicURL: public, WebOrigins: []string{"https://lobbies.example"}, DevLogin: true})
	if err == nil {
		t.Fatal("dev login accepted on a public host")
	}
	_, err = New(Config{PublicURL: public, WebOrigins: []string{"https://*.example"}})
	if err == nil {
		t.Fatal("wildcard origin accepted")
	}
}

func TestDevLoginGuards(t *testing.T) {
	off := newTestEnv(t, false)
	if res := off.req("GET", "/auth/dev", "", "", nil); res.StatusCode != http.StatusNotFound {
		t.Fatalf("dev page without DEV_LOGIN: %d", res.StatusCode)
	}
	if off.me("").DevLogin {
		t.Fatal("devLogin advertised while off")
	}

	e := newTestEnv(t, true)
	if res := e.req("GET", "/auth/dev", "", "", nil); res.StatusCode != http.StatusOK {
		t.Fatalf("dev page: %d", res.StatusCode)
	}
	form := func() io.Reader { return strings.NewReader("name=Teste_A") }
	if res := e.req("POST", "/auth/dev/login", "", "", form()); res.StatusCode != http.StatusForbidden {
		t.Fatalf("no origin: %d", res.StatusCode)
	}
	if res := e.req("POST", "/auth/dev/login", "https://evil.example", "", form()); res.StatusCode != http.StatusForbidden {
		t.Fatalf("evil origin: %d", res.StatusCode)
	}
	if res := e.req("POST", "/auth/dev/login", e.srv.URL, "", strings.NewReader("name=%3Cscript%3E")); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("bad name: %d", res.StatusCode)
	}
	// Behind a proxy every visitor looks local: refuse.
	r, _ := http.NewRequest("GET", e.srv.URL+"/auth/dev", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.9")
	if res, _ := client.Do(r); res.StatusCode != http.StatusNotFound {
		t.Fatalf("proxied: %d", res.StatusCode)
	}
	// DNS rebinding: a loopback socket but someone else's Host.
	r, _ = http.NewRequest("GET", e.srv.URL+"/auth/dev", nil)
	r.Host = "evil.example"
	if res, _ := client.Do(r); res.StatusCode != http.StatusNotFound {
		t.Fatalf("foreign host: %d", res.StatusCode)
	}

	cookie := e.devSignIn("Teste_A")
	if v := e.me(cookie); v.User == nil || v.User.ID != "dev:teste_a" || !v.User.Dev || !v.DevLogin {
		t.Fatalf("me: %+v", v)
	}
	if v := e.me(cookie + "x"); v.User != nil {
		t.Fatal("tampered cookie accepted")
	}
}

func TestCORS(t *testing.T) {
	e := newTestEnv(t, false)
	if res := e.req("GET", "/api/me", web, "", nil); res.Header.Get("Access-Control-Allow-Origin") != web || res.Header.Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("allowed origin: %v", res.Header)
	}
	if res := e.req("GET", "/api/me", "https://evil.example", "", nil); res.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("CORS granted to a foreign origin")
	}
	if res := e.req("OPTIONS", "/auth/logout", "https://evil.example", "", nil); res.StatusCode != http.StatusForbidden {
		t.Fatalf("foreign preflight: %d", res.StatusCode)
	}
	if res := e.req("OPTIONS", "/auth/logout", web, "", nil); res.StatusCode != http.StatusNoContent {
		t.Fatalf("preflight: %d", res.StatusCode)
	}
}

func TestSteamLoginFlow(t *testing.T) {
	e := newTestEnv(t, false)
	res := e.req("GET", "/auth/steam/login?return=/sala/l1", "", "", nil)
	loc, _ := url.Parse(res.Header.Get("Location"))
	login := cookieOf(res, loginCookie)
	if res.StatusCode != http.StatusFound || !strings.HasPrefix(loc.String(), e.steam.URL) || login == nil || !login.HttpOnly {
		t.Fatalf("login redirect: %d %s %+v", res.StatusCode, loc, login)
	}
	returnTo, _ := url.Parse(loc.Query().Get("openid.return_to"))
	state := returnTo.Query().Get("s")

	claimed := "https://steamcommunity.com/openid/id/76561198000000042"
	q := url.Values{
		"s":                     {state},
		"openid.ns":             {"http://specs.openid.net/auth/2.0"},
		"openid.mode":           {"id_res"},
		"openid.op_endpoint":    {e.steam.URL},
		"openid.claimed_id":     {claimed},
		"openid.identity":       {claimed},
		"openid.return_to":      {returnTo.String()},
		"openid.response_nonce": {time.Now().UTC().Format(time.RFC3339) + "n1"},
		"openid.assoc_handle":   {"h"},
		"openid.signed":         {"signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"},
		"openid.sig":            {"s"},
	}
	cb := "/auth/steam/callback?" + q.Encode()

	// Without the login cookie (someone else's link): refused.
	if res := e.req("GET", cb, "", "", nil); !strings.Contains(res.Header.Get("Location"), "login=falhou") {
		t.Fatalf("callback without cookie: %s", res.Header.Get("Location"))
	}
	res = e.req("GET", cb, "", login.Name+"="+login.Value, nil)
	sess := cookieOf(res, sessionCookie)
	if res.Header.Get("Location") != web+"/sala/l1" || sess == nil {
		t.Fatalf("callback: %d %s", res.StatusCode, res.Header.Get("Location"))
	}
	v := e.me(sess.Name + "=" + sess.Value)
	if v.User == nil || v.User.ID != "76561198000000042" || v.User.Name != "Jogador 0042" {
		t.Fatalf("me after steam: %+v", v.User)
	}
	// The same response cannot be used twice.
	if res := e.req("GET", cb, "", login.Name+"="+login.Value, nil); !strings.Contains(res.Header.Get("Location"), "login=falhou") {
		t.Fatalf("replay: %s", res.Header.Get("Location"))
	}
}

func TestWebSocketOriginAndAuth(t *testing.T) {
	e := newTestEnv(t, true)
	for _, o := range []string{"", "https://evil.example", "http://localhost:5198"} {
		if _, res, err := e.dial(o, ""); err == nil || res == nil || res.StatusCode != http.StatusForbidden {
			t.Fatalf("origin %q: err=%v", o, err)
		}
	}
	anon, _, err := e.dial(web, "")
	if err != nil {
		t.Fatal(err)
	}
	if w := anon.until("welcome"); w["me"] != nil {
		t.Fatalf("anonymous welcome: %v", w)
	}
	anon.send(map[string]any{"type": "join", "lobbyId": "x", "req": 1})
	if m := anon.until("error"); m["code"] != "auth_required" {
		t.Fatalf("anonymous intent: %v", m)
	}
}

func TestWebSocketRoomFlow(t *testing.T) {
	e := newTestEnv(t, true)
	a, _, err := e.dial(web, e.devSignIn("Ana"))
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := e.dial(web, e.devSignIn("Bia"))
	if err != nil {
		t.Fatal(err)
	}
	if w := a.until("welcome"); w["me"].(map[string]any)["name"] != "Ana" {
		t.Fatalf("welcome: %v", w)
	}
	a.send(map[string]any{"type": "create", "req": 1, "lobby": map[string]any{"name": "Duelo", "modeSlug": "duelo-meia-noite", "region": "BR", "slots": 8, "minPlayers": 2}})
	ack := a.until("ack")
	id, _ := ack["lobbyId"].(string)
	if id == "" || ack["req"] != float64(1) {
		t.Fatalf("create ack: %v", ack)
	}
	// b and a are dev users, so friends: b sees a host.
	if f := b.until("friend"); f["friend"].(map[string]any)["name"] != "Ana" {
		t.Fatalf("presence: %v", f)
	}
	b.send(map[string]any{"type": "join", "req": 2, "lobbyId": id})
	b.until("ack")
	b.send(map[string]any{"type": "ready", "req": 3, "ready": true})
	b.until("ack")
	a.send(map[string]any{"type": "start", "req": 2})
	for {
		m := b.until("lobby")
		if l := m["lobby"].(map[string]any); l["phase"] == "countdown" {
			if l["countdownMs"].(float64) <= 0 {
				t.Fatalf("countdown: %v", l)
			}
			break
		}
	}
	// handoff_progress decodes its step; during the countdown there is no match yet.
	b.send(map[string]any{"type": "handoff_progress", "req": 4, "step": 0})
	if m := b.until("error"); m["code"] != "not_in_match" || m["req"].(float64) != 4 {
		t.Fatalf("handoff_progress before the match: %v", m)
	}
	// Unknown fields are refused, not ignored.
	b.send(map[string]any{"type": "ready", "ready": false, "admin": true})
	if m := b.until("error"); m["code"] != "bad_request" {
		t.Fatalf("unknown field: %v", m)
	}

	// The REST list sees it too, with the same filters as the site.
	res := e.req("GET", "/api/lobbies?regiao=BR&vagas=1", web, "", nil)
	var list struct{ Lobbies []lobby.View }
	_ = json.NewDecoder(res.Body).Decode(&list)
	if len(list.Lobbies) != 1 || list.Lobbies[0].ID != id || list.Lobbies[0].JoinCode != "" {
		t.Fatalf("list: %+v", list)
	}
	if res := e.req("GET", "/api/lobbies?regiao=EU", web, "", nil); res.StatusCode != 200 {
		t.Fatal(res.StatusCode)
	}
}

func TestLogoutClosesSockets(t *testing.T) {
	e := newTestEnv(t, true)
	cookie := e.devSignIn("Caio")
	w, _, err := e.dial(web, cookie)
	if err != nil {
		t.Fatal(err)
	}
	w.until("welcome")
	if res := e.req("POST", "/auth/logout", "https://evil.example", cookie, nil); res.StatusCode != http.StatusForbidden {
		t.Fatalf("logout from a foreign origin: %d", res.StatusCode)
	}
	if res := e.req("POST", "/auth/logout", web, cookie, nil); res.StatusCode != http.StatusNoContent {
		t.Fatalf("logout: %d", res.StatusCode)
	}
	if v := e.me(cookie); v.User != nil {
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

func TestWebSocketRateLimit(t *testing.T) {
	e := newTestEnv(t, true)
	w, _, err := e.dial(web, e.devSignIn("Duda"))
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 40; i++ {
		w.send(map[string]any{"type": "ping", "req": i})
	}
	if m := w.until("error"); m["code"] != "rate_limited" {
		t.Fatalf("rate limit: %v", m)
	}
}

func TestLimiterRefills(t *testing.T) {
	now := time.Unix(0, 0)
	l := newLimiter(1, 2, func() time.Time { return now })
	if !l.allow("k") || !l.allow("k") || l.allow("k") {
		t.Fatal("burst")
	}
	now = now.Add(time.Second)
	if !l.allow("k") || l.allow("k") {
		t.Fatal("refill")
	}
}
