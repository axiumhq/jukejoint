package main

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	websocket "github.com/aperturerobotics/go-websocket"
	"github.com/sirupsen/logrus"
)

func TestAdmissionRateAndRecovery(t *testing.T) {
	now := time.Unix(100, 0)
	a := newAdmission(admissionConfig{ticketRate: 2, ticketBurst: 2, socketRate: 2, socketBurst: 2, maxSockets: 1}, func() time.Time { return now })
	if !a.allowTicket() || !a.allowTicket() || a.allowTicket() {
		t.Fatal("burst was not bounded")
	}
	now = now.Add(500 * time.Millisecond)
	if !a.allowTicket() || a.allowTicket() {
		t.Fatal("bucket did not refill at the configured rate")
	}
}

func TestAdmissionAtHTTPBoundary(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(&bytes.Buffer{})
	a := newAdmission(admissionConfig{ticketBurst: 1, socketBurst: 1, maxSockets: 1}, time.Now)
	h, err := newHandlerWithLimits(logrus.NewEntry(logger), testEnv, testSecret, time.Now, a)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	defer srv.Close()
	priv, pid := newTestPeer(t)
	token := fetchTicket(t, srv, priv, pid)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/signal/ws?tk=" + url.QueryEscape(token)
	conn, resp, err := websocket.Dial(ctx, u, nil)
	if err != nil {
		t.Fatalf("first socket: %v", err)
	}
	defer conn.CloseNow()
	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("first socket: %d", resp.StatusCode)
	}
	// The burst is exhausted; health checks must remain available.
	status, _ := do(t, signedTicketRequest(t, srv, priv, pid, nil))
	if status != http.StatusServiceUnavailable {
		t.Fatalf("rate limit: %d", status)
	}
	res, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("health: %d", res.StatusCode)
	}
}

func TestSocketCapacityReleasedOnDisconnect(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(&bytes.Buffer{})
	a := newAdmission(admissionConfig{ticketBurst: 100, socketBurst: 100, maxSockets: 1}, time.Now)
	h, err := newHandlerWithLimits(logrus.NewEntry(logger), testEnv, testSecret, time.Now, a)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	defer srv.Close()
	priv, pid := newTestPeer(t)
	token := fetchTicket(t, srv, priv, pid)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/signal/ws?tk=" + url.QueryEscape(token)
	conn, _, err := websocket.Dial(ctx, u, nil)
	if err != nil {
		t.Fatal(err)
	}
	_, resp, err := websocket.Dial(ctx, u, nil)
	if err == nil || resp == nil || resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("full capacity: response=%v error=%v", resp, err)
	}
	conn.CloseNow()
	deadline := time.Now().Add(3 * time.Second)
	for {
		conn, resp, err = websocket.Dial(ctx, u, nil)
		if err == nil {
			conn.CloseNow()
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("slot not released: %v", err)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestFailedUpgradeReleasesCapacity(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(&bytes.Buffer{})
	a := newAdmission(admissionConfig{ticketBurst: 100, socketBurst: 100, maxSockets: 1}, time.Now)
	h, err := newHandlerWithLimits(logrus.NewEntry(logger), testEnv, testSecret, time.Now, a)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	defer srv.Close()
	priv, pid := newTestPeer(t)
	token := fetchTicket(t, srv, priv, pid)
	resp, err := http.Get(srv.URL + "/api/signal/ws?tk=" + url.QueryEscape(token))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode == http.StatusSwitchingProtocols {
		t.Fatal("request without websocket upgrade succeeded")
	}
	if status := wsStatus(t, srv, token); status != http.StatusSwitchingProtocols {
		t.Fatalf("failed upgrade retained slot: %d", status)
	}
}
