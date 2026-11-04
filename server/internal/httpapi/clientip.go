package httpapi

import (
	"fmt"
	"net"
	"net/http"
	"strings"
)

// cfConnectingIP is the header the Cloudflare edge (and so a Cloudflare
// Tunnel) sets to the address of the client that reached it.
const cfConnectingIP = "Cf-Connecting-Ip"

// ParseProxies reads TRUSTED_PROXIES: comma separated CIDRs or bare IPs of
// the reverse proxies allowed to say who the client is (for a Cloudflare
// Tunnel: where cloudflared connects from, e.g. 127.0.0.1 on a PC or the
// Docker network on a server). Empty means none: the TCP peer is the client.
func ParseProxies(s string) ([]*net.IPNet, error) {
	var nets []*net.IPNet
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p == "" {
			continue
		}
		if !strings.Contains(p, "/") {
			ip := net.ParseIP(p)
			if ip == nil {
				return nil, fmt.Errorf("bad proxy address %q", p)
			}
			bits := 128
			if ip.To4() != nil {
				ip, bits = ip.To4(), 32
			}
			nets = append(nets, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
			continue
		}
		_, n, err := net.ParseCIDR(p)
		if err != nil {
			return nil, fmt.Errorf("bad proxy range %q", p)
		}
		nets = append(nets, n)
	}
	return nets, nil
}

// remoteIP is the TCP peer, whatever any header claims.
func remoteIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// clientIP is the key for the per-IP limits. Behind a trusted proxy every
// request arrives from the proxy, so its Cf-Connecting-Ip names the client;
// from anywhere else that header is ignored, since anyone can send it.
func (s *Server) clientIP(r *http.Request) string {
	peer := remoteIP(r)
	if len(s.cfg.TrustedProxies) == 0 {
		return peer
	}
	ip := net.ParseIP(peer)
	if ip == nil || !s.trusted(ip) {
		return peer
	}
	if c := net.ParseIP(strings.TrimSpace(r.Header.Get(cfConnectingIP))); c != nil {
		return c.String()
	}
	return peer
}

func (s *Server) trusted(ip net.IP) bool {
	for _, n := range s.cfg.TrustedProxies {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}
