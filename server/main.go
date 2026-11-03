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
//	DEV_LOGIN=1    optional, dev only: fake test users from localhost
package main

import (
	"log/slog"
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

func main() {
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
	if k := os.Getenv("STEAM_API_KEY"); k != "" {
		api = &auth.SteamAPI{Key: k, Base: "https://api.steampowered.com", Client: httpClient}
	} else {
		log.Info("no STEAM_API_KEY: users get a neutral name and no friend list")
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
