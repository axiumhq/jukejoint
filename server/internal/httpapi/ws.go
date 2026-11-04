package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"

	"hyperline/server/internal/lobby"
)

const (
	maxMessage    = 4 << 10
	sendBuffer    = 256
	pingEvery     = 25 * time.Second
	writeTimeout  = 10 * time.Second
	maxConnsUser  = 6
	maxConnsIP    = 12
	maxBadPerConn = 20
	// wsProtocol is the subprotocol the app offers next to "auth.<token>"; the
	// token itself is never echoed back.
	wsProtocol = "jukejoint"
)

// wsClient is one WebSocket connection, as the hub sees it.
type wsClient struct {
	uid    string
	send   chan []byte
	cancel context.CancelFunc
	once   sync.Once
}

func (c *wsClient) UserID() string { return c.uid }

// Send queues a message; a client too slow to keep up is disconnected
// instead of holding the hub.
func (c *wsClient) Send(m lobby.Msg) {
	data, err := json.Marshal(m)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
		c.once.Do(c.cancel)
	}
}

func (s *Server) acquire(key string, max int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.perKey[key] >= max {
		return false
	}
	s.perKey[key]++
	return true
}

func (s *Server) release(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.perKey[key]--; s.perKey[key] <= 0 {
		delete(s.perKey, key)
	}
}

func (s *Server) track(sid string, c *wsClient, on bool) {
	if sid == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	set := s.bySess[sid]
	if on {
		if set == nil {
			set = map[*wsClient]struct{}{}
			s.bySess[sid] = set
		}
		set[c] = struct{}{}
		return
	}
	delete(set, c)
	if len(set) == 0 {
		delete(s.bySess, sid)
	}
}

// closeSession drops every socket opened with a session (on logout).
func (s *Server) closeSession(sid string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for c := range s.bySess[sid] {
		c.once.Do(c.cancel)
	}
}

func (s *Server) ws(w http.ResponseWriter, r *http.Request) {
	// Exact origin match before the upgrade: the cookie rides along on a
	// cross-site socket, so this is the CSRF guard of every intent.
	if o := r.Header.Get("Origin"); o == "" || !s.allowed[strings.ToLower(o)] {
		s.cfg.Log.Warn("ws origin refused", "origin", o)
		http.Error(w, "origem não permitida", http.StatusForbidden)
		return
	}
	user, sid := s.sessionFromToken(r.Context(), tokenFrom(r, true))
	key, max := "ip:"+s.clientIP(r), maxConnsIP
	if user != nil {
		key, max = "user:"+user.ID, maxConnsUser
	}
	if !s.acquire(key, max) {
		http.Error(w, "conexões demais", http.StatusTooManyRequests)
		return
	}
	defer s.release(key)

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: s.patterns, Subprotocols: []string{wsProtocol}})
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(maxMessage)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c := &wsClient{send: make(chan []byte, sendBuffer), cancel: cancel}
	var ref *lobby.UserRef
	if user != nil {
		c.uid = user.ID
		ref = &lobby.UserRef{ID: user.ID, Name: user.Name}
	}
	s.track(sid, c, true)
	defer s.track(sid, c, false)

	go s.writeLoop(ctx, conn, c)
	s.cfg.Hub.Connect(c, ref)
	defer s.cfg.Hub.Disconnect(c)

	bad := 0
	for {
		typ, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if typ != websocket.MessageText {
			conn.Close(websocket.StatusUnsupportedData, "só texto")
			return
		}
		var in lobby.Intent
		dec := json.NewDecoder(bytes.NewReader(data))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&in); err != nil {
			bad++
			c.Send(lobby.Msg{"type": "error", "code": "bad_request", "message": "Mensagem inválida."})
		} else if !s.wsRate.allow(key) {
			bad++
			c.Send(lobby.Msg{"type": "error", "req": in.Req, "code": "rate_limited", "message": "Calma: pedidos demais em pouco tempo."})
		} else if ack, herr := s.cfg.Hub.Handle(c.uid, in); herr != nil {
			c.Send(lobby.Msg{"type": "error", "req": in.Req, "code": herr.Code, "message": herr.Message})
		} else {
			m := lobby.Msg{"type": "ack", "req": in.Req}
			for k, v := range ack {
				m[k] = v
			}
			c.Send(m)
		}
		if bad > maxBadPerConn {
			conn.Close(websocket.StatusPolicyViolation, "pedidos inválidos demais")
			return
		}
	}
}

func (s *Server) writeLoop(ctx context.Context, conn *websocket.Conn, c *wsClient) {
	defer c.once.Do(c.cancel)
	ping := time.NewTicker(pingEvery)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case data := <-c.send:
			wctx, done := context.WithTimeout(ctx, writeTimeout)
			err := conn.Write(wctx, websocket.MessageText, data)
			done()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, done := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pctx)
			done()
			if err != nil {
				return
			}
		}
	}
}
