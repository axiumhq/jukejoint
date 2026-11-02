package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	websocket "github.com/aperturerobotics/go-websocket"
	api "github.com/s4wave/spacewave/core/provider/spacewave/api"
	"github.com/s4wave/spacewave/core/transport"
	"github.com/s4wave/spacewave/net/crypto"
	"github.com/s4wave/spacewave/net/peer"
	"github.com/sirupsen/logrus"
)

// testEnv is the env prefix the test server and its signers share.
const testEnv = "hyperline"

// testSecret is the ticket key the test servers share.
var testSecret = bytes.Repeat([]byte{7}, secretSize)

// newTestPeer generates a fresh Ed25519 key and the peer ID derived from it.
func newTestPeer(t *testing.T) (crypto.PrivKey, peer.ID) {
	t.Helper()
	priv, _, err := crypto.GenerateEd25519Key(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	pid, err := peer.IDFromPrivateKey(priv)
	if err != nil {
		t.Fatal(err)
	}
	return priv, pid
}

// newTestServer serves the handler with the given clock and quiet logs.
func newTestServer(t *testing.T, secret []byte, now func() time.Time) *httptest.Server {
	t.Helper()
	logger := logrus.New()
	logger.SetOutput(&bytes.Buffer{})
	h, err := newHandler(logrus.NewEntry(logger), testEnv, secret, now)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv
}

// signedTicketRequest builds a ticket request signed by Spacewave's own client
// signer, the same call the Modlock daemon makes.
func signedTicketRequest(t *testing.T, srv *httptest.Server, priv crypto.PrivKey, pid peer.ID, body []byte) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/signal/ticket", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if err := transport.SignHTTPRequest(req, body, priv, pid, testEnv); err != nil {
		t.Fatal(err)
	}
	return req
}

// do sends req and returns the status and body.
func do(t *testing.T, req *http.Request) (int, []byte) {
	t.Helper()
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var buf bytes.Buffer
	_, _ = buf.ReadFrom(resp.Body)
	return resp.StatusCode, buf.Bytes()
}

// fetchTicket asks the server for pid's ticket and returns the token.
func fetchTicket(t *testing.T, srv *httptest.Server, priv crypto.PrivKey, pid peer.ID) string {
	t.Helper()
	status, data := do(t, signedTicketRequest(t, srv, priv, pid, nil))
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	var resp api.SignalTicketResponse
	if err := resp.UnmarshalVT(data); err != nil {
		t.Fatal(err)
	}
	return resp.GetToken()
}

// wsStatus dials the signaling websocket with tk and returns the HTTP status of
// the handshake: 101 when the socket opened, the refusal's status otherwise.
func wsStatus(t *testing.T, srv *httptest.Server, tk string) int {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/signal/ws?tk=" + url.QueryEscape(tk)
	conn, resp, err := websocket.Dial(ctx, u, nil)
	if err == nil {
		conn.CloseNow()
		return resp.StatusCode
	}
	if resp == nil {
		t.Fatalf("dial: %v", err)
	}
	return resp.StatusCode
}

func TestTicketValid(t *testing.T) {
	srv := newTestServer(t, testSecret, time.Now)
	priv, pid := newTestPeer(t)

	// The ticket is opaque: not the public peer ID, and URL-safe as is.
	tk := fetchTicket(t, srv, priv, pid)
	if tk == pid.String() || strings.Contains(tk, pid.String()) {
		t.Fatalf("ticket %q exposes the peer id", tk)
	}
	if tk != url.QueryEscape(tk) {
		t.Fatalf("ticket %q is not URL-safe", tk)
	}

	// It round-trips to the same peer, and opens the websocket.
	got, err := verifyTicket(testSecret, tk, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if got != pid {
		t.Fatalf("ticket peer = %q, want %q", got, pid)
	}
	if status := wsStatus(t, srv, tk); status != http.StatusSwitchingProtocols {
		t.Fatalf("ws status = %d, want 101", status)
	}
}

func TestVerifyTicket(t *testing.T) {
	_, pid := newTestPeer(t)
	_, other := newTestPeer(t)
	now := time.Now()
	tk := issueTicket(testSecret, pid, now)

	// Valid until the ten minutes are up, exactly.
	for name, at := range map[string]time.Time{
		"now":    now,
		"almost": now.Add(ticketTTL - time.Second),
	} {
		if got, err := verifyTicket(testSecret, tk, at); err != nil || got != pid {
			t.Fatalf("%s: got %q, %v; want %q", name, got, err, pid)
		}
	}
	got, err := verifyTicket(testSecret, tk, now.Add(ticketTTL))
	if err == nil {
		t.Fatal("ticket at its expiry verified")
	}
	if got != pid {
		t.Fatalf("expired ticket peer = %q, want %q for the log", got, pid)
	}

	// A ticket from another key does not verify.
	if _, err := verifyTicket(bytes.Repeat([]byte{8}, secretSize), tk, now); err == nil {
		t.Fatal("ticket verified under a foreign secret")
	}

	// Tampering with either half breaks it: a longer expiry, or another peer's
	// ID under peer A's MAC.
	msgPart, macPart, _ := strings.Cut(tk, ".")
	msg, err := base64.RawURLEncoding.DecodeString(msgPart)
	if err != nil {
		t.Fatal(err)
	}
	later := append([]byte(nil), msg...)
	later[len(later)-1] ^= 0x01
	swapped := append([]byte(other), msg[len(pid):]...)
	for name, m := range map[string][]byte{"expiry": later, "peer": swapped} {
		forged := base64.RawURLEncoding.EncodeToString(m) + "." + macPart
		if _, err := verifyTicket(testSecret, forged, now); err == nil {
			t.Fatalf("%s tampered ticket verified", name)
		}
	}

	// A MAC over a message too short to hold an expiry is refused too, as is junk.
	short := base64.RawURLEncoding.EncodeToString([]byte("abc"))
	shortTk := short + "." + base64.RawURLEncoding.EncodeToString(ticketMAC(testSecret, []byte("abc")))
	for _, bad := range []string{"", ".", "abc", "a.b", shortTk, tk + ".x", pid.String()} {
		if _, err := verifyTicket(testSecret, bad, now); err == nil {
			t.Fatalf("ticket %q verified", bad)
		}
	}
}

func TestWebSocketRefusesBadTickets(t *testing.T) {
	srv := newTestServer(t, testSecret, time.Now)
	priv, pid := newTestPeer(t)
	_, other := newTestPeer(t)
	now := time.Now()
	good := fetchTicket(t, srv, priv, pid)

	// Tamper with a genuine ticket: peer B's ID under peer A's MAC.
	msgPart, macPart, _ := strings.Cut(good, ".")
	msg, err := base64.RawURLEncoding.DecodeString(msgPart)
	if err != nil {
		t.Fatal(err)
	}
	claimB := base64.RawURLEncoding.EncodeToString(append([]byte(other), msg[len(pid):]...)) + "." + macPart

	for name, tk := range map[string]string{
		"missing":       "",
		"bare peer id":  pid.String(),
		"other peer id": other.String(),
		"garbage":       "not.a-ticket",
		"claim peer B":  claimB,
		"foreign key":   issueTicket(bytes.Repeat([]byte{8}, secretSize), pid, now),
		"expired":       issueTicket(testSecret, pid, now.Add(-2*ticketTTL)),
		"truncated":     good[:len(good)-4],
	} {
		if status := wsStatus(t, srv, tk); status != http.StatusForbidden {
			t.Fatalf("%s: status = %d, want 403", name, status)
		}
	}
}

func TestLoadOrCreateSecret(t *testing.T) {
	path := filepath.Join(t.TempDir(), "secret")

	// A missing file is created with a fresh key, and read back the same.
	first, err := loadOrCreateSecret(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != secretSize || bytes.Equal(first, make([]byte, secretSize)) {
		t.Fatalf("created secret = %x, want %d random bytes", first, secretSize)
	}
	again, err := loadOrCreateSecret(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first, again) {
		t.Fatal("secret changed between loads")
	}

	// A file of the wrong size is refused, not replaced.
	bad := filepath.Join(t.TempDir(), "bad")
	if err := os.WriteFile(bad, []byte("short"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadOrCreateSecret(bad); err == nil {
		t.Fatal("short secret file accepted")
	}
	if data, _ := os.ReadFile(bad); string(data) != "short" {
		t.Fatalf("bad secret file was overwritten with %q", data)
	}
}

func TestTicketTamperedBody(t *testing.T) {
	srv := newTestServer(t, testSecret, time.Now)
	priv, pid := newTestPeer(t)

	// Sign one body, send another, keeping the original hash header.
	req := signedTicketRequest(t, srv, priv, pid, []byte("signed body"))
	req.Body = http.NoBody
	req2, err := http.NewRequest(http.MethodPost, req.URL.String(), bytes.NewReader([]byte("other body")))
	if err != nil {
		t.Fatal(err)
	}
	req2.Header = req.Header
	if status, _ := do(t, req2); status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", status)
	}

	// A body that matches a forged hash header still fails the signature.
	body := []byte("other body")
	req3 := signedTicketRequest(t, srv, priv, pid, []byte("signed body"))
	req3.Body = http.NoBody
	req4, err := http.NewRequest(http.MethodPost, req3.URL.String(), bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req4.Header = req3.Header
	req4.Header.Set("X-Sw-Hash", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
	if status, _ := do(t, req4); status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", status)
	}
}

func TestTicketWrongPeerID(t *testing.T) {
	srv := newTestServer(t, testSecret, time.Now)
	priv, _ := newTestPeer(t)
	_, otherID := newTestPeer(t)

	// Signed by one key but claiming another peer's ID.
	req := signedTicketRequest(t, srv, priv, otherID, nil)
	if status, _ := do(t, req); status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", status)
	}

	// The header swapped after signing fails the same way.
	priv2, pid2 := newTestPeer(t)
	req = signedTicketRequest(t, srv, priv2, pid2, nil)
	req.Header.Set("X-Peer-ID", otherID.String())
	if status, _ := do(t, req); status != http.StatusForbidden {
		t.Fatalf("swapped header: status = %d, want 403", status)
	}

	// Garbage and missing IDs are refused too, never with a 401.
	for _, id := range []string{"", "not-a-peer-id"} {
		req = signedTicketRequest(t, srv, priv, otherID, nil)
		req.Header.Set("X-Peer-ID", id)
		if status, _ := do(t, req); status != http.StatusForbidden {
			t.Fatalf("peer id %q: status = %d, want 403", id, status)
		}
	}
}

func TestTicketStaleTimestamp(t *testing.T) {
	priv, pid := newTestPeer(t)

	// The signer stamps the real time, so move the server's clock instead; the
	// signature itself stays genuine.
	for name, offset := range map[string]time.Duration{
		"stale":  10 * time.Minute,
		"future": -10 * time.Minute,
	} {
		t.Run(name, func(t *testing.T) {
			srv := newTestServer(t, testSecret, func() time.Time { return time.Now().Add(offset) })
			if status, _ := do(t, signedTicketRequest(t, srv, priv, pid, nil)); status != http.StatusForbidden {
				t.Fatalf("status = %d, want 403", status)
			}
		})
	}

	// A rewritten timestamp breaks the signature even when it is in range.
	srv := newTestServer(t, testSecret, time.Now)
	req := signedTicketRequest(t, srv, priv, pid, nil)
	req.Header.Set("X-Timestamp", strconv.FormatInt(time.Now().Add(time.Second).UnixMilli(), 10))
	if status, _ := do(t, req); status != http.StatusForbidden {
		t.Fatalf("rewritten timestamp: status = %d, want 403", status)
	}
}

func TestTicketMissingHeaders(t *testing.T) {
	srv := newTestServer(t, testSecret, time.Now)
	priv, pid := newTestPeer(t)

	for _, h := range []string{"X-Timestamp", "X-Sw-Hash", "X-Signature"} {
		req := signedTicketRequest(t, srv, priv, pid, nil)
		req.Header.Del(h)
		if status, _ := do(t, req); status != http.StatusForbidden {
			t.Fatalf("without %s: status = %d, want 403", h, status)
		}
	}

	// A signature of the wrong env prefix does not verify.
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/signal/ticket", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := transport.SignHTTPRequest(req, nil, priv, pid, "other"); err != nil {
		t.Fatal(err)
	}
	if status, _ := do(t, req); status != http.StatusForbidden {
		t.Fatalf("wrong env: status = %d, want 403", status)
	}

	// Garbage base64 is refused.
	req = signedTicketRequest(t, srv, priv, pid, nil)
	req.Header.Set("X-Signature", base64.StdEncoding.EncodeToString([]byte("short")))
	if status, _ := do(t, req); status != http.StatusForbidden {
		t.Fatalf("bad signature: status = %d, want 403", status)
	}
}
