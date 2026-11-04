// Command server is the platform's lobby API: Steam sign-in, the lobby list
// and a WebSocket with server-authoritative rooms, presence and invites.
//
// Configuration comes from the environment (see README.md):
//
//	ADDR           listen address (127.0.0.1:8090)
//	PUBLIC_URL     this server's public origin (http://localhost:8090)
//	WEB_ORIGIN     allowed site origins, comma separated; the first one is
//	               where the browser returns after signing in (http://localhost:5173)
//	DATA_DIR       where the session signing key lives (.data)
//	STEAM_API_KEY  optional: real names, avatars and friend lists
//	               (or the file <DATA_DIR>/steam-api-key, kept out of git)
//	DEV_LOGIN=1    optional, dev only: fake test users from localhost
//	APP_SCHEME     deep link scheme of the desktop app (jukejoint)
//	APP_NAME       app name shown on the app sign-in page (Jukejoint)
//	TRUSTED_PROXIES  optional: CIDRs or IPs of the reverse proxy (a Cloudflare
//	               Tunnel) whose Cf-Connecting-Ip names the client for the
//	               per-IP limits; empty trusts no header
//
// "server healthcheck" asks this server's own /healthz and exits 0 when it
// answers, for container health checks (the image has no shell or curl).
package main

import (
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"hyperline/server/internal/auth"
	"hyperline/server/internal/httpapi"
	"hyperline/server/internal/lobby"
	"hyperline/server/internal/store"
)

func env(k, def string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return def
}

// steamKey reads STEAM_API_KEY, or else the first line of <dataDir>/steam-api-key
// (server/.data is gitignored, so the key stays off the repository).
func steamKey(dataDir string) string {
	if k := strings.TrimSpace(os.Getenv("STEAM_API_KEY")); k != "" {
		return k
	}
	b, err := os.ReadFile(filepath.Join(dataDir, "steam-api-key"))
	if err != nil {
		return ""
	}
	k, _, _ := strings.Cut(strings.TrimSpace(string(b)), "\n")
	return strings.TrimSpace(k)
}

// healthcheck GETs /healthz on the port ADDR listens on, over loopback.
func healthcheck(addr string) error {
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("bad ADDR %q: %w", addr, err)
	}
	c := &http.Client{Timeout: 3 * time.Second}
	res, err := c.Get("http://" + net.JoinHostPort("127.0.0.1", port) + "/healthz")
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1<<10))
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz answered %d", res.StatusCode)
	}
	return nil
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := healthcheck(env("ADDR", "127.0.0.1:8090")); err != nil {
			fmt.Fprintln(os.Stderr, "unhealthy:", err)
			os.Exit(1)
		}
		return
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	fail := func(msg string, args ...any) {
		log.Error(msg, args...)
		os.Exit(1)
	}

	addr := env("ADDR", "127.0.0.1:8090")
	public, err := url.Parse(strings.TrimRight(env("PUBLIC_URL", "http://localhost:8090"), "/"))
	if err != nil {
		fail("bad PUBLIC_URL", "err", err)
	}
	var origins []string
	for _, o := range strings.Split(env("WEB_ORIGIN", "http://localhost:5173"), ",") {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" {
			origins = append(origins, o)
		}
	}

	key, err := auth.LoadOrCreateKey(filepath.Join(env("DATA_DIR", ".data"), "session.key"))
	if err != nil {
		fail("session key", "err", err)
	}

	st := store.NewMemory(nil)
	httpClient := &http.Client{Timeout: 15 * time.Second}
	steam := &auth.Steam{
		Endpoint: auth.SteamOpenID,
		Realm:    public.Scheme + "://" + public.Host,
		Callback: public.Scheme + "://" + public.Host + "/auth/steam/callback",
		Client:   httpClient,
		Nonces:   st,
		Now:      time.Now,
	}
	var api *auth.SteamAPI
	if k := steamKey(env("DATA_DIR", ".data")); k != "" {
		api = &auth.SteamAPI{Key: k, Base: "https://api.steampowered.com", Client: httpClient}
	} else {
		log.Info("no STEAM_API_KEY: users get a neutral name and no friend list")
	}
	proxies, err := httpapi.ParseProxies(os.Getenv("TRUSTED_PROXIES"))
	if err != nil {
		fail("bad TRUSTED_PROXIES", "err", err)
	}
	dev := os.Getenv("DEV_LOGIN") == "1"
	if dev {
		log.Warn("DEV_LOGIN=1: fake test users are enabled for localhost. Never use this in production.")
	}

	srv, err := httpapi.New(httpapi.Config{
		PublicURL:  public,
		WebOrigins: origins,
		DevLogin:   dev,
		Store:      st,
		Hub:        lobby.New(lobby.RealClock{}, httpapi.Friendship{Store: st}),
		Signer:     auth.NewSigner(key),
		Steam:      steam,
		SteamAPI:   api,
		Log:        log,
		AppScheme:  env("APP_SCHEME", "jukejoint"),
		AppName:    env("APP_NAME", "Jukejoint"),

		TrustedProxies: proxies,
	})
	if err != nil {
		fail("config", "err", err)
	}

	hs := &http.Server{
		Addr:              addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       90 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	log.Info("listening", "addr", addr, "public", public.String(), "web", strings.Join(origins, ","))
	if err := hs.ListenAndServe(); err != nil {
		fail("serve", "err", err)
	}
}
