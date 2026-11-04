package httpapi

import (
	"net/http/httptest"
	"testing"
)

func TestParseProxies(t *testing.T) {
	nets, err := ParseProxies(" 127.0.0.1, 172.16.0.0/12 ,,::1 ")
	if err != nil {
		t.Fatal(err)
	}
	if len(nets) != 3 {
		t.Fatalf("got %d ranges, want 3", len(nets))
	}
	if got := nets[0].String(); got != "127.0.0.1/32" {
		t.Errorf("bare IPv4 became %s", got)
	}
	if got := nets[2].String(); got != "::1/128" {
		t.Errorf("bare IPv6 became %s", got)
	}
	if nets, err := ParseProxies(""); err != nil || len(nets) != 0 {
		t.Errorf("empty: %v %v", nets, err)
	}
	for _, bad := range []string{"localhost", "10.0.0.0/33", "1.2.3"} {
		if _, err := ParseProxies(bad); err == nil {
			t.Errorf("%q was accepted", bad)
		}
	}
}

func TestClientIPTrustsOnlyTheProxy(t *testing.T) {
	proxies, err := ParseProxies("172.16.0.0/12")
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{cfg: Config{TrustedProxies: proxies}}
	cases := []struct {
		name, remote, header, want string
	}{
		{"through the tunnel", "172.18.0.5:41000", "203.0.113.9", "203.0.113.9"},
		{"IPv6 client through the tunnel", "172.18.0.5:41000", "2001:db8::1", "2001:db8::1"},
		{"tunnel without the header", "172.18.0.5:41000", "", "172.18.0.5"},
		{"tunnel with a junk header", "172.18.0.5:41000", "not-an-ip", "172.18.0.5"},
		{"direct client forging the header", "198.51.100.7:5000", "203.0.113.9", "198.51.100.7"},
	}
	for _, c := range cases {
		r := httptest.NewRequest("GET", "/api/me", nil)
		r.RemoteAddr = c.remote
		if c.header != "" {
			r.Header.Set("CF-Connecting-IP", c.header)
		}
		if got := s.clientIP(r); got != c.want {
			t.Errorf("%s: got %s, want %s", c.name, got, c.want)
		}
	}

	// No proxies configured: the header never counts.
	plain := &Server{}
	r := httptest.NewRequest("GET", "/api/me", nil)
	r.RemoteAddr = "172.18.0.5:41000"
	r.Header.Set("CF-Connecting-IP", "203.0.113.9")
	if got := plain.clientIP(r); got != "172.18.0.5" {
		t.Errorf("without TRUSTED_PROXIES the header was believed: %s", got)
	}
}

func TestDevLoginRefusesTunnelledRequests(t *testing.T) {
	proxies, _ := ParseProxies("127.0.0.1")
	s := &Server{cfg: Config{DevLogin: true, TrustedProxies: proxies}}
	r := httptest.NewRequest("POST", "http://localhost:8291/auth/dev/token", nil)
	r.RemoteAddr = "127.0.0.1:50000"
	if !s.devAllowed(r) {
		t.Fatal("a plain localhost request should be allowed in dev")
	}
	// cloudflared on the same PC connects from 127.0.0.1 too: its header
	// gives it away, so the tunnel can never reach the dev login.
	r.Header.Set("CF-Connecting-IP", "203.0.113.9")
	if s.devAllowed(r) {
		t.Fatal("a request carried by the tunnel reached the dev login")
	}
}
