package httpapi

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"html/template"
	"net/http"
	"regexp"
	"time"

	"hyperline/server/internal/auth"
)

// Desktop-app sign-in (RFC 8252 + PKCE): the app opens the system browser at
// /auth/steam/login?app=<challenge>; after Steam, the callback hands the
// browser a one-time code through a deep link, and the app trades the code and
// its verifier for a session token at /auth/app/token.

const (
	appCodeTTL = 2 * time.Minute
	maxAppCode = 1000
)

var (
	challengeRe = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
	verifierRe  = regexp.MustCompile(`^[A-Za-z0-9_-]{43,128}$`)
	appSchemeRe = regexp.MustCompile(`^[a-z][a-z0-9]{1,30}$`)
)

// appCode is a pending one-time code, bound to the PKCE challenge.
type appCode struct {
	userID    string
	challenge string
	expires   time.Time
}

var appTmpl = template.Must(template.New("app").Parse(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
{{if .Link}}<meta http-equiv="refresh" content="0;url={{.Link}}">{{end}}
<title>{{.Title}}</title>
<style>body{font:16px system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#222}
a.b{display:inline-block;margin:.5rem 0;padding:.6rem 1rem;background:#222;color:#fff;border-radius:.4rem;text-decoration:none}</style>
</head><body>
<h1>{{.Title}}</h1>
{{if .Link}}<p>O navegador vai pedir para abrir o {{.App}}. Aceite para continuar.</p>
<p><a class="b" href="{{.Link}}">Voltar para o {{.App}}</a></p>
<p>Depois disso, pode fechar esta aba.</p>
{{else}}<p>{{.Message}}</p>{{end}}
</body></html>`))

type appView struct {
	Title, Message, App string
	Link                template.URL
}

func (s *Server) appPage(w http.ResponseWriter, status int, v appView) {
	v.App = s.appName
	h := w.Header()
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
	h.Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_ = appTmpl.Execute(w, v)
}

func (s *Server) appFailedPage(w http.ResponseWriter, status int) {
	s.appPage(w, status, appView{
		Title:   "Não deu para entrar",
		Message: "Não deu para entrar com a Steam. Volte para o " + s.appName + " e tente de novo.",
	})
}

// appLoginDone issues the one-time code and shows the page that opens the app.
func (s *Server) appLoginDone(w http.ResponseWriter, uid, challenge string) {
	now := s.cfg.Now()
	code := auth.RandomToken(32)
	s.appMu.Lock()
	for k, c := range s.appCodes {
		if !now.Before(c.expires) {
			delete(s.appCodes, k)
		}
	}
	full := len(s.appCodes) >= maxAppCode
	if !full {
		s.appCodes[code] = appCode{userID: uid, challenge: challenge, expires: now.Add(appCodeTTL)}
	}
	s.appMu.Unlock()
	if full {
		s.cfg.Log.Warn("app code table full")
		s.appPage(w, http.StatusServiceUnavailable, appView{Title: "Tente de novo", Message: "Muita gente entrando agora. Volte para o " + s.appName + " e tente de novo em instantes."})
		return
	}
	s.cfg.Log.Info("app sign-in code issued", "user", uid)
	// Both parts are validated (scheme at startup, code just made), so the URL
	// is safe to mark as such; html/template would otherwise reject the scheme.
	s.appPage(w, http.StatusOK, appView{Title: "Login feito", Link: template.URL(s.appScheme + "://auth/" + code)})
}

// takeAppCode removes and returns a code; a code is never valid twice.
func (s *Server) takeAppCode(code string) (appCode, bool) {
	s.appMu.Lock()
	defer s.appMu.Unlock()
	c, ok := s.appCodes[code]
	delete(s.appCodes, code)
	return c, ok
}

// decodeJSON reads one JSON object, refusing unknown fields.
func decodeJSON(r *http.Request, v any) bool {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v) == nil
}

func (s *Server) appToken(w http.ResponseWriter, r *http.Request) {
	if !s.requireOrigin(w, r) {
		return
	}
	if !s.authRate.allow("ip:" + s.clientIP(r)) {
		http.Error(w, "muitas tentativas, espere um pouco", http.StatusTooManyRequests)
		return
	}
	bad := func(reason string) {
		s.cfg.Log.Warn("app token refused", "reason", reason)
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "bad_code", "message": "O login expirou ou já foi usado. Tente de novo."})
	}
	var in struct {
		Code     string `json:"code"`
		Verifier string `json:"verifier"`
	}
	if !decodeJSON(r, &in) {
		bad("bad body")
		return
	}
	// Taken first, whatever happens next: a wrong verifier burns the code.
	c, ok := s.takeAppCode(in.Code)
	switch {
	case !ok:
		bad("unknown or used code")
		return
	case !s.cfg.Now().Before(c.expires):
		bad("expired code")
		return
	case !verifierRe.MatchString(in.Verifier):
		bad("bad verifier format")
		return
	}
	sum := sha256.Sum256([]byte(in.Verifier))
	if subtle.ConstantTimeCompare([]byte(base64.RawURLEncoding.EncodeToString(sum[:])), []byte(c.challenge)) != 1 {
		bad("verifier does not match")
		return
	}
	u, ok, err := s.cfg.Store.User(r.Context(), c.userID)
	if err != nil || !ok {
		bad("user gone")
		return
	}
	_, token, err := s.newSession(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "internal", "message": "Erro interno."})
		return
	}
	s.cfg.Log.Info("app signed in", "user", u.ID)
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}
