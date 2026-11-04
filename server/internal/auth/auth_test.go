package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"hyperline/server/internal/store"
)

const testSteamID = "76561198000000001"

// mockSteam answers check_authentication like steamcommunity.com does.
type mockSteam struct {
	*httptest.Server
	valid atomic.Bool
	calls atomic.Int32
}

func newMockSteam(t *testing.T) *mockSteam {
	m := &mockSteam{}
	m.valid.Store(true)
	m.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.calls.Add(1)
		if err := r.ParseForm(); err != nil || r.Method != http.MethodPost {
			http.Error(w, "bad", http.StatusBadRequest)
			return
		}
		if r.PostForm.Get("openid.mode") != "check_authentication" || r.PostForm.Get("openid.sig") == "" {
			t.Errorf("check_authentication request: %v", r.PostForm)
		}
		fmt.Fprintf(w, "ns:%s\nis_valid:%v\n", openIDNS, m.valid.Load())
	}))
	t.Cleanup(m.Close)
	return m
}

func newSteam(endpoint string, now time.Time) *Steam {
	return &Steam{
		Endpoint: endpoint,
		Realm:    "http://localhost:8090",
		Callback: "http://localhost:8090/auth/steam/callback",
		Nonces:   store.NewMemory(func() time.Time { return now }),
		Now:      func() time.Time { return now },
	}
}

// assertion builds the query Steam would redirect back with.
func assertion(s *Steam, state string, now time.Time) url.Values {
	claimed := "https://steamcommunity.com/openid/id/" + testSteamID
	return url.Values{
		"s":                     {state},
		"openid.ns":             {openIDNS},
		"openid.mode":           {"id_res"},
		"openid.op_endpoint":    {s.Endpoint},
		"openid.claimed_id":     {claimed},
		"openid.identity":       {claimed},
		"openid.return_to":      {s.ReturnTo(state)},
		"openid.response_nonce": {now.UTC().Format(time.RFC3339) + "Xy12"},
		"openid.assoc_handle":   {"1234567890"},
		"openid.signed":         {"signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"},
		"openid.sig":            {"c2lnbmF0dXJl"},
	}
}

func TestOpenIDValid(t *testing.T) {
	m := newMockSteam(t)
	now := time.Now()
	s := newSteam(m.URL, now)
	id, err := s.Verify(context.Background(), assertion(s, "st4te", now), "st4te")
	if err != nil || id != testSteamID {
		t.Fatalf("got %q, %v", id, err)
	}
	// The same response again is a replay, refused before calling Steam.
	calls := m.calls.Load()
	if _, err := s.Verify(context.Background(), assertion(s, "st4te", now), "st4te"); err == nil || !strings.Contains(err.Error(), "replayed") {
		t.Fatalf("replay accepted: %v", err)
	}
	if m.calls.Load() != calls {
		t.Fatal("replay reached Steam")
	}
}

func TestOpenIDRejects(t *testing.T) {
	m := newMockSteam(t)
	now := time.Now()
	cases := map[string]func(q url.Values, s *Steam){
		"cancel":      func(q url.Values, _ *Steam) { q.Set("openid.mode", "cancel") },
		"mode":        func(q url.Values, _ *Steam) { q.Set("openid.mode", "checkid_setup") },
		"ns":          func(q url.Values, _ *Steam) { q.Set("openid.ns", "http://openid.net/signon/1.1") },
		"op_endpoint": func(q url.Values, _ *Steam) { q.Set("openid.op_endpoint", "https://evil.example/openid/login") },
		"return_to other": func(q url.Values, _ *Steam) {
			q.Set("openid.return_to", "http://evil.example/auth/steam/callback?s=st4te")
		},
		"return_to state": func(q url.Values, s *Steam) { q.Set("openid.return_to", s.ReturnTo("other")) },
		"query state":     func(q url.Values, _ *Steam) { q.Set("s", "other") },
		"claimed domain": func(q url.Values, _ *Steam) {
			setClaimed(q, "https://steamcommunity.com.evil.example/openid/id/"+testSteamID)
		},
		"claimed http":      func(q url.Values, _ *Steam) { setClaimed(q, "http://steamcommunity.com/openid/id/"+testSteamID) },
		"claimed not steam": func(q url.Values, _ *Steam) { setClaimed(q, "https://steamcommunity.com/openid/id/12345") },
		"claimed trailing":  func(q url.Values, _ *Steam) { setClaimed(q, "https://steamcommunity.com/openid/id/"+testSteamID+"/") },
		"identity differs": func(q url.Values, _ *Steam) {
			q.Set("openid.identity", "https://steamcommunity.com/openid/id/76561198000000002")
		},
		"nonce old": func(q url.Values, _ *Steam) {
			q.Set("openid.response_nonce", now.Add(-10*time.Minute).UTC().Format(time.RFC3339)+"a")
		},
		"nonce future": func(q url.Values, _ *Steam) {
			q.Set("openid.response_nonce", now.Add(10*time.Minute).UTC().Format(time.RFC3339)+"a")
		},
		"nonce garbage": func(q url.Values, _ *Steam) { q.Set("openid.response_nonce", "ontem") },
		"unsigned claimed": func(q url.Values, _ *Steam) {
			q.Set("openid.signed", "signed,op_endpoint,identity,return_to,response_nonce,assoc_handle")
		},
		"no sig":   func(q url.Values, _ *Steam) { q.Del("openid.sig") },
		"no assoc": func(q url.Values, _ *Steam) { q.Del("openid.assoc_handle") },
		"repeated": func(q url.Values, _ *Steam) {
			q.Add("openid.claimed_id", "https://steamcommunity.com/openid/id/76561198000000002")
		},
		"too long":           func(q url.Values, _ *Steam) { q.Set("openid.assoc_handle", strings.Repeat("a", 600)) },
		"steam says invalid": func(_ url.Values, _ *Steam) { m.valid.Store(false) },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			m.valid.Store(true)
			s := newSteam(m.URL, now)
			q := assertion(s, "st4te", now)
			mutate(q, s)
			id, err := s.Verify(context.Background(), q, "st4te")
			if err == nil {
				t.Fatalf("accepted as %q", id)
			}
			if name == "cancel" && !errors.Is(err, ErrCancelled) {
				t.Fatalf("cancel: %v", err)
			}
		})
	}
	t.Run("empty state", func(t *testing.T) {
		s := newSteam(m.URL, now)
		q := assertion(s, "", now)
		if _, err := s.Verify(context.Background(), q, ""); err == nil {
			t.Fatal("empty state accepted")
		}
	})
	t.Run("steam down", func(t *testing.T) {
		down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "x", http.StatusInternalServerError)
		}))
		defer down.Close()
		s := newSteam(down.URL, now)
		if _, err := s.Verify(context.Background(), assertion(s, "st4te", now), "st4te"); err == nil {
			t.Fatal("accepted with Steam down")
		}
	})
}

func setClaimed(q url.Values, v string) {
	q.Set("openid.claimed_id", v)
	q.Set("openid.identity", v)
}

func TestLoginURL(t *testing.T) {
	s := newSteam(SteamOpenID, time.Now())
	u, err := url.Parse(s.LoginURL("abc"))
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	if u.Host != "steamcommunity.com" || q.Get("openid.mode") != "checkid_setup" || q.Get("openid.realm") != s.Realm ||
		q.Get("openid.return_to") != s.Callback+"?s=abc" || q.Get("openid.claimed_id") != identSelect {
		t.Fatalf("login url: %s", u)
	}
}

func TestSigner(t *testing.T) {
	s := NewSigner([]byte(strings.Repeat("k", KeySize)))
	tok := s.Sign("session", "sid-123")
	if v, ok := s.Verify("session", tok); !ok || v != "sid-123" {
		t.Fatalf("round trip: %q %v", v, ok)
	}
	if _, ok := s.Verify("login-state", tok); ok {
		t.Fatal("token valid for another purpose")
	}
	other := NewSigner([]byte(strings.Repeat("x", KeySize)))
	if _, ok := other.Verify("session", tok); ok {
		t.Fatal("token valid under another key")
	}
	forged := b64.EncodeToString([]byte("sid-999")) + tok[strings.Index(tok, "."):]
	if _, ok := s.Verify("session", forged); ok {
		t.Fatal("swapped value accepted")
	}
	for _, bad := range []string{"", ".", "abc", "a.b.c", strings.Repeat("a", 2000)} {
		if _, ok := s.Verify("session", bad); ok {
			t.Fatalf("garbage %q accepted", bad)
		}
	}
	now := time.Now()
	sealed := s.SealLogin(LoginState{State: "st", Return: "/sala/x|y", App: "chal-lenge_1", Expires: now.Add(time.Minute)})
	if l, ok := s.OpenLogin(sealed, now); !ok || l.State != "st" || l.Return != "/sala/x|y" || l.App != "chal-lenge_1" {
		t.Fatalf("login state: %+v %v", l, ok)
	}
	if _, ok := s.OpenLogin(sealed, now.Add(2*time.Minute)); ok {
		t.Fatal("expired login state accepted")
	}
}

func TestSafeReturn(t *testing.T) {
	cases := map[string]string{
		"/sala/l1?x=1":           "/sala/l1?x=1",
		"":                       "/",
		"https://evil.example/":  "/",
		"//evil.example/":        "/",
		"/\\evil.example":        "/",
		"/ok\r\nSet-Cookie: a=b": "/",
		"sala":                   "/",
	}
	for in, want := range cases {
		if got := SafeReturn(in); got != want {
			t.Errorf("SafeReturn(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestLoadOrCreateKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "session.key")
	k1, err := LoadOrCreateKey(path)
	if err != nil || len(k1) != KeySize {
		t.Fatalf("create: %v", err)
	}
	k2, err := LoadOrCreateKey(path)
	if err != nil || string(k1) != string(k2) {
		t.Fatalf("reread: %v", err)
	}
	if err := os.WriteFile(path, []byte("short"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadOrCreateKey(path); err == nil {
		t.Fatal("wrong size accepted")
	}
	if b, _ := os.ReadFile(path); string(b) != "short" {
		t.Fatal("wrong-size key was overwritten")
	}
}

func TestSteamAPI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("key") != "test-key" {
			http.Error(w, "no", http.StatusForbidden)
			return
		}
		switch r.URL.Path {
		case "/ISteamUser/GetPlayerSummaries/v2/":
			fmt.Fprintf(w, `{"response":{"players":[{"steamid":%q,"personaname":"Corvo","avatarfull":"https://avatars.example/a.jpg"}]}}`, testSteamID)
		case "/ISteamUser/GetFriendList/v1/":
			fmt.Fprint(w, `{"friendslist":{"friends":[{"steamid":"76561198000000002"},{"steamid":"lixo"}]}}`)
		}
	}))
	defer srv.Close()
	api := &SteamAPI{Key: "test-key", Base: srv.URL}
	p, err := api.Summary(context.Background(), testSteamID)
	if err != nil || p.Name != "Corvo" || p.Avatar == "" {
		t.Fatalf("summary: %+v %v", p, err)
	}
	ids, err := api.Friends(context.Background(), testSteamID)
	if err != nil || len(ids) != 1 || ids[0] != "76561198000000002" {
		t.Fatalf("friends: %v %v", ids, err)
	}
	// Errors never carry the key.
	bad := &SteamAPI{Key: "secret-key", Base: "http://127.0.0.1:1"}
	if _, err := bad.Summary(context.Background(), testSteamID); err == nil || strings.Contains(err.Error(), "secret-key") {
		t.Fatalf("error leaks the key or is nil: %v", err)
	}
}
