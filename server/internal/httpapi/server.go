// Package httpapi is the HTTP side of the API: Steam sign-in, the session
// cookie, the read-only lobby list and the WebSocket that carries intents and
// live updates.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"hyperline/server/internal/auth"
	"hyperline/server/internal/lobby"
	"hyperline/server/internal/store"
)

const (
	sessionCookie = "hl_session"
	loginCookie   = "hl_login"
	sessionTTL    = 30 * 24 * time.Hour
	loginTTL      = 10 * time.Minute
	maxBody       = 16 << 10
	// sessionPurpose separates session tokens from other signed values.
	sessionPurpose = "session"
)

// Config wires the server.
type Config struct {
	// PublicURL is this server's own public origin (realm and callback base).
	PublicURL *url.URL
	// WebOrigins are the site origins allowed to call the API; the first one
	// is where the browser goes back after signing in.
	WebOrigins []string
	// DevLogin enables the fake test users (only from localhost).
	DevLogin bool
	Store    store.Store
	Hub      *lobby.Hub
	Signer   auth.Signer
	Steam    *auth.Steam
	// SteamAPI is nil without STEAM_API_KEY: names fall back to a neutral one.
	SteamAPI *auth.SteamAPI
	Log      *slog.Logger
	Now      func() time.Time
	// AppScheme is the deep link scheme of the desktop app ("jukejoint" when
	// empty): the app sign-in page sends the browser to <scheme>://auth/<code>.
	AppScheme string
	// AppName is how the app is called on that page ("Jukejoint" when empty).
	AppName string
}

// Server serves the API.
type Server struct {
	cfg      Config
	self     string
	allowed  map[string]bool
	patterns []string
	authRate *limiter
	wsRate   *limiter

	// Desktop-app sign-in: one-time codes waiting for their token exchange.
	appMu     sync.Mutex
	appCodes  map[string]appCode
	appScheme string
	appName   string

	mu      sync.Mutex
	bySess  map[string]map[*wsClient]struct{}
	perKey  map[string]int
	secure  bool
	webBase string
}

// Friendship is the friend check the hub uses: what the store knows (Steam
// friend lists) plus, for the dev login, every dev user is a friend of every
// other dev user, so two test browsers can invite each other.
type Friendship struct{ Store store.Store }

func (f Friendship) AreFriends(a, b string) bool {
	if a != b && strings.HasPrefix(a, "dev:") && strings.HasPrefix(b, "dev:") {
		return true
	}
	return f.Store.AreFriends(a, b)
}

// New checks the config and builds the server.
func New(cfg Config) (*Server, error) {
	if cfg.PublicURL == nil || cfg.PublicURL.Host == "" {
		return nil, errors.New("PUBLIC_URL is required")
	}
	if len(cfg.WebOrigins) == 0 {
		return nil, errors.New("at least one WEB_ORIGIN is required")
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	if cfg.Log == nil {
		cfg.Log = slog.Default()
	}
	s := &Server{
		cfg:      cfg,
		self:     origin(cfg.PublicURL),
		allowed:  map[string]bool{},
		authRate: newLimiter(0.5, 10, cfg.Now),
		wsRate:   newLimiter(8, 20, cfg.Now),
		appCodes: map[string]appCode{},
		bySess:   map[string]map[*wsClient]struct{}{},
		perKey:   map[string]int{},
		secure:   cfg.PublicURL.Scheme == "https",
		webBase:  strings.TrimRight(cfg.WebOrigins[0], "/"),
	}
	for _, o := range append([]string{s.self}, cfg.WebOrigins...) {
		u, err := url.Parse(o)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || strings.ContainsAny(o, "*?[]") {
			return nil, fmt.Errorf("bad origin %q", o)
		}
		o = origin(u)
		if !s.allowed[o] {
			s.allowed[o] = true
			s.patterns = append(s.patterns, o)
		}
	}
	s.appScheme = cfg.AppScheme
	if s.appScheme == "" {
		s.appScheme = "jukejoint"
	}
	if !appSchemeRe.MatchString(s.appScheme) {
		return nil, fmt.Errorf("bad APP_SCHEME %q: lowercase letters and digits, starting with a letter", s.appScheme)
	}
	s.appName = lobby.CleanText(cfg.AppName, 40)
	if s.appName == "" {
		s.appName = "Jukejoint"
	}
	if cfg.DevLogin && !isLocalHost(cfg.PublicURL.Hostname()) {
		return nil, errors.New("DEV_LOGIN=1 only runs with a localhost PUBLIC_URL")
	}
	return s, nil
}

func origin(u *url.URL) string { return strings.ToLower(u.Scheme + "://" + u.Host) }

func isLocalHost(h string) bool {
	return h == "localhost" || h == "127.0.0.1" || h == "::1"
}

// Handler returns the routes, wrapped in the common headers and CORS.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte("ok\n")) })
	mux.HandleFunc("GET /api/me", s.me)
	mux.HandleFunc("GET /api/lobbies", s.listLobbies)
	mux.HandleFunc("GET /api/lobbies/{id}", s.getLobby)
	mux.HandleFunc("GET /api/ws", s.ws)
	mux.HandleFunc("GET /auth/steam/login", s.steamLogin)
	mux.HandleFunc("GET /auth/steam/callback", s.steamCallback)
	mux.HandleFunc("POST /auth/app/token", s.appToken)
	mux.HandleFunc("POST /auth/logout", s.logout)
	mux.HandleFunc("GET /auth/dev", s.devPage)
	mux.HandleFunc("POST /auth/dev/login", s.devLogin)
	mux.HandleFunc("POST /auth/dev/token", s.devToken)
	return s.wrap(mux)
}

func (s *Server) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("Cache-Control", "no-store")
		if o := r.Header.Get("Origin"); o != "" && s.allowed[strings.ToLower(o)] {
			h.Set("Access-Control-Allow-Origin", o)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Add("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			if h.Get("Access-Control-Allow-Origin") == "" {
				http.Error(w, "origem não permitida", http.StatusForbidden)
				return
			}
			h.Set("Access-Control-Allow-Methods", "GET, POST")
			h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			h.Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxBody)
		next.ServeHTTP(w, r)
	})
}

/* ───────── Helpers ───────── */

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// requireOrigin guards state-changing requests: the Origin header must be one
// of ours. Browsers always send it on POST, so a missing one is refused too.
func (s *Server) requireOrigin(w http.ResponseWriter, r *http.Request) bool {
	if o := r.Header.Get("Origin"); o == "" || !s.allowed[strings.ToLower(o)] {
		s.cfg.Log.Warn("origin refused", "path", r.URL.Path, "origin", o)
		http.Error(w, "origem não permitida", http.StatusForbidden)
		return false
	}
	return true
}

// tokenFrom finds the session token of a request: the cookie, then
// "Authorization: Bearer", then (only on the WebSocket, where browsers cannot
// set headers) an "auth.<token>" entry of Sec-WebSocket-Protocol.
func tokenFrom(r *http.Request, allowSubprotocol bool) string {
	if ck, err := r.Cookie(sessionCookie); err == nil {
		return ck.Value
	}
	if h := r.Header.Get("Authorization"); len(h) > 7 && strings.EqualFold(h[:7], "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	if allowSubprotocol {
		for _, h := range r.Header.Values("Sec-WebSocket-Protocol") {
			for _, p := range strings.Split(h, ",") {
				if tok, ok := strings.CutPrefix(strings.TrimSpace(p), "auth."); ok && tok != "" {
					return tok
				}
			}
		}
	}
	return ""
}

// session returns the signed-in user, if any, and the session ID.
func (s *Server) session(r *http.Request) (*store.User, string) {
	return s.sessionFromToken(r.Context(), tokenFrom(r, false))
}

// sessionFromToken checks a signed session token (Verify caps its length).
func (s *Server) sessionFromToken(ctx context.Context, token string) (*store.User, string) {
	if token == "" {
		return nil, ""
	}
	sid, ok := s.cfg.Signer.Verify(sessionPurpose, token)
	if !ok {
		return nil, ""
	}
	sess, ok, err := s.cfg.Store.Session(ctx, sid)
	if err != nil || !ok {
		return nil, ""
	}
	u, ok, err := s.cfg.Store.User(ctx, sess.UserID)
	if err != nil || !ok {
		return nil, ""
	}
	return &u, sid
}

// newSession stores a fresh session for uid and returns its ID and the signed
// token (the cookie value, or the Bearer token of the app).
func (s *Server) newSession(ctx context.Context, uid string) (sid, token string, err error) {
	sid = auth.RandomToken(32)
	if err := s.cfg.Store.PutSession(ctx, store.Session{ID: sid, UserID: uid, Expires: s.cfg.Now().Add(sessionTTL)}); err != nil {
		return "", "", err
	}
	return sid, s.cfg.Signer.Sign(sessionPurpose, sid), nil
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, uid string) error {
	if _, old := s.session(r); old != "" {
		_ = s.cfg.Store.DeleteSession(r.Context(), old)
	}
	_, token, err := s.newSession(r.Context(), uid)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

func (s *Server) clearCookie(w http.ResponseWriter, name, path string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: path, MaxAge: -1, HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode})
}

func (s *Server) toWeb(w http.ResponseWriter, r *http.Request, path string) {
	http.Redirect(w, r, s.webBase+auth.SafeReturn(path), http.StatusSeeOther)
}

// devAllowed: DEV_LOGIN=1, a loopback client, a localhost Host header (no DNS
// rebinding) and no proxy headers (a local reverse proxy would make every
// visitor look like localhost).
func (s *Server) devAllowed(r *http.Request) bool {
	if !s.cfg.DevLogin {
		return false
	}
	ip := net.ParseIP(clientIP(r))
	if ip == nil || !ip.IsLoopback() {
		return false
	}
	for _, h := range []string{"X-Forwarded-For", "X-Forwarded-Host", "X-Real-Ip", "Forwarded"} {
		if r.Header.Get(h) != "" {
			return false
		}
	}
	host := r.Host
	if h, _, err := net.SplitHostPort(r.Host); err == nil {
		host = h
	}
	return isLocalHost(strings.Trim(host, "[]"))
}

/* ───────── Read-only API ───────── */

type meView struct {
	User       *store.User `json:"user"`
	DevLogin   bool        `json:"devLogin"`
	SteamLogin bool        `json:"steamLogin"`
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u, _ := s.session(r)
	writeJSON(w, http.StatusOK, meView{User: u, DevLogin: s.devAllowed(r), SteamLogin: true})
}

func parseFilter(q url.Values) lobby.Filter {
	f := lobby.Filter{
		Q:           lobby.CleanText(q.Get("q"), 60),
		Mode:        q.Get("modo"),
		SlotsOnly:   q.Get("vagas") == "1",
		FriendsOnly: q.Get("amigos") == "1",
		Beginners:   q.Get("iniciantes") == "1",
		Playing:     q.Get("partida") == "1",
		LowPing:     q.Get("ping") == fmt.Sprint(lobby.LowPingMs),
		Sort:        q.Get("ordem"),
	}
	for _, r := range strings.Split(q.Get("regiao"), ",") {
		for _, ok := range lobby.Regions {
			if r == ok {
				f.Regions = append(f.Regions, r)
			}
		}
	}
	return f
}

func (s *Server) listLobbies(w http.ResponseWriter, r *http.Request) {
	viewer := ""
	if u, _ := s.session(r); u != nil {
		viewer = u.ID
	}
	writeJSON(w, http.StatusOK, map[string]any{"lobbies": s.cfg.Hub.List(parseFilter(r.URL.Query()), viewer)})
}

func (s *Server) getLobby(w http.ResponseWriter, r *http.Request) {
	viewer := ""
	if u, _ := s.session(r); u != nil {
		viewer = u.ID
	}
	v, ok := s.cfg.Hub.Get(r.PathValue("id"), viewer)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"code": "not_found", "message": "Esse lobby não existe mais."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lobby": v})
}

/* ───────── Steam sign-in ───────── */

func (s *Server) steamLogin(w http.ResponseWriter, r *http.Request) {
	if !s.authRate.allow("ip:" + clientIP(r)) {
		http.Error(w, "muitas tentativas, espere um pouco", http.StatusTooManyRequests)
		return
	}
	app := r.URL.Query().Get("app")
	if app != "" && !challengeRe.MatchString(app) {
		http.Error(w, "pedido de login do app inválido", http.StatusBadRequest)
		return
	}
	state := auth.RandomToken(18)
	ls := auth.LoginState{State: state, Return: auth.SafeReturn(r.URL.Query().Get("return")), App: app, Expires: s.cfg.Now().Add(loginTTL)}
	http.SetCookie(w, &http.Cookie{
		Name:     loginCookie,
		Value:    s.cfg.Signer.SealLogin(ls),
		Path:     "/auth/steam",
		MaxAge:   int(loginTTL.Seconds()),
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, s.cfg.Steam.LoginURL(state), http.StatusFound)
}

func (s *Server) steamCallback(w http.ResponseWriter, r *http.Request) {
	if !s.authRate.allow("ip:" + clientIP(r)) {
		http.Error(w, "muitas tentativas, espere um pouco", http.StatusTooManyRequests)
		return
	}
	ck, err := r.Cookie(loginCookie)
	if err != nil {
		s.cfg.Log.Warn("steam callback without login cookie")
		s.toWeb(w, r, "/?login=falhou")
		return
	}
	s.clearCookie(w, loginCookie, "/auth/steam")
	ls, ok := s.cfg.Signer.OpenLogin(ck.Value, s.cfg.Now())
	if !ok {
		s.cfg.Log.Warn("steam callback with a bad or expired login cookie")
		s.toWeb(w, r, "/?login=falhou")
		return
	}
	steamID, err := s.cfg.Steam.Verify(r.Context(), r.URL.Query(), ls.State)
	if errors.Is(err, auth.ErrCancelled) {
		if ls.App != "" {
			s.appFailedPage(w, http.StatusOK)
			return
		}
		s.toWeb(w, r, ls.Return)
		return
	}
	if err != nil {
		s.cfg.Log.Warn("steam sign-in refused", "reason", err)
		if ls.App != "" {
			s.appFailedPage(w, http.StatusBadRequest)
			return
		}
		s.toWeb(w, r, "/?login=falhou")
		return
	}
	u := s.steamUser(r.Context(), steamID)
	if err := s.cfg.Store.PutUser(r.Context(), u); err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if ls.App != "" {
		s.appLoginDone(w, u.ID, ls.App)
		return
	}
	if err := s.startSession(w, r, u.ID); err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	s.cfg.Log.Info("signed in", "user", u.ID)
	s.toWeb(w, r, ls.Return)
}

// steamUser builds the profile: a neutral name without STEAM_API_KEY, the
// persona name, avatar and friend list with it (best effort).
func (s *Server) steamUser(ctx context.Context, steamID string) store.User {
	u := store.User{ID: steamID, Name: "Jogador " + steamID[len(steamID)-4:]}
	if old, ok, _ := s.cfg.Store.User(ctx, steamID); ok {
		u = old
	}
	if s.cfg.SteamAPI == nil {
		return u
	}
	if p, err := s.cfg.SteamAPI.Summary(ctx, steamID); err != nil {
		s.cfg.Log.Warn("GetPlayerSummaries failed", "user", steamID, "err", err)
	} else {
		if name := lobby.CleanText(p.Name, 32); name != "" {
			u.Name = name
		}
		u.Avatar = p.Avatar
	}
	if ids, err := s.cfg.SteamAPI.Friends(ctx, steamID); err != nil {
		s.cfg.Log.Info("GetFriendList unavailable (private list?)", "user", steamID, "err", err)
	} else {
		_ = s.cfg.Store.SetFriends(ctx, steamID, ids)
	}
	return u
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if !s.requireOrigin(w, r) {
		return
	}
	if _, sid := s.session(r); sid != "" {
		_ = s.cfg.Store.DeleteSession(r.Context(), sid)
		s.closeSession(sid)
	}
	s.clearCookie(w, sessionCookie, "/")
	w.WriteHeader(http.StatusNoContent)
}

/* ───────── Dev login (DEV_LOGIN=1, localhost only) ───────── */

var devNameRe = regexp.MustCompile(`^[\p{L}\p{N}_.\-]{2,20}$`)

var devTmpl = template.Must(template.New("dev").Parse(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login de teste</title>
<style>body{font:16px system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#222}
input,button{font:inherit;padding:.5rem .75rem}button{margin:.25rem .25rem 0 0}code{background:#eee;padding:0 .25rem}</style>
</head><body>
<h1>Login de teste</h1>
<p>Só para desenvolvimento (<code>DEV_LOGIN=1</code>, só de localhost). Cria um usuário falso, sem Steam.</p>
<form method="post" action="/auth/dev/login">
<input type="hidden" name="return" value="{{.Return}}">
<label>Nome <input name="name" required minlength="2" maxlength="20" value="Teste_A" autofocus></label>
<button type="submit">Entrar</button>
</form>
<p>Ou: {{range .Names}}<button form="q" name="name" value="{{.}}">{{.}}</button>{{end}}</p>
<form id="q" method="post" action="/auth/dev/login"><input type="hidden" name="return" value="{{.Return}}"></form>
</body></html>`))

func (s *Server) devPage(w http.ResponseWriter, r *http.Request) {
	if !s.devAllowed(r) {
		http.NotFound(w, r)
		return
	}
	// form-action covers the redirect back to the site, so the site is listed.
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' "+s.webBase+"; frame-ancestors 'none'")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = devTmpl.Execute(w, map[string]any{"Return": auth.SafeReturn(r.URL.Query().Get("return")), "Names": []string{"Teste_A", "Teste_B", "Teste_C"}})
}

func (s *Server) devLogin(w http.ResponseWriter, r *http.Request) {
	if !s.devAllowed(r) {
		http.NotFound(w, r)
		return
	}
	if !s.requireOrigin(w, r) {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "formulário inválido", http.StatusBadRequest)
		return
	}
	name := lobby.CleanText(r.PostForm.Get("name"), 20)
	if !devNameRe.MatchString(name) {
		http.Error(w, "nome inválido: 2 a 20 letras, números, _ . ou -", http.StatusBadRequest)
		return
	}
	u, err := s.putDevUser(r.Context(), name)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if err := s.startSession(w, r, u.ID); err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	s.cfg.Log.Info("dev sign-in", "user", u.ID)
	s.toWeb(w, r, r.PostForm.Get("return"))
}

func (s *Server) putDevUser(ctx context.Context, name string) (store.User, error) {
	u := store.User{ID: "dev:" + strings.ToLower(name), Name: name, Dev: true}
	return u, s.cfg.Store.PutUser(ctx, u)
}

// devToken is the dev login for the desktop app, which cannot use the cookie:
// the same fake user, but the session token comes back in the body.
func (s *Server) devToken(w http.ResponseWriter, r *http.Request) {
	if !s.devAllowed(r) {
		http.NotFound(w, r)
		return
	}
	if !s.requireOrigin(w, r) {
		return
	}
	var in struct {
		Name string `json:"name"`
	}
	if !decodeJSON(r, &in) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "bad_request", "message": "Pedido inválido."})
		return
	}
	name := lobby.CleanText(in.Name, 20)
	if !devNameRe.MatchString(name) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "bad_name", "message": "Nome inválido: 2 a 20 letras, números, _ . ou -"})
		return
	}
	u, err := s.putDevUser(r.Context(), name)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "internal", "message": "Erro interno."})
		return
	}
	_, token, err := s.newSession(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "internal", "message": "Erro interno."})
		return
	}
	s.cfg.Log.Info("dev token sign-in", "user", u.ID)
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}
