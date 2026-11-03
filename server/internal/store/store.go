// Package store holds what the API keeps between requests: users, sessions,
// the OpenID nonces already seen and who is friends with whom.
//
// Everything goes through the Store interface so the in-memory implementation
// used now can be swapped for Postgres later without touching the handlers.
package store

import (
	"context"
	"sync"
	"time"
)

// User is a signed-in account. ID is the SteamID64, or "dev:<name>" for the
// fake users of the dev login.
type User struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Avatar string `json:"avatar,omitempty"`
	// Dev marks a fake user created by the dev login (never by Steam).
	Dev bool `json:"dev,omitempty"`
}

// Session ties a random session ID (carried, signed, in the cookie) to a user.
type Session struct {
	ID      string
	UserID  string
	Expires time.Time
}

// Store is the persistence the API needs. Implementations must be safe for
// concurrent use.
type Store interface {
	PutUser(ctx context.Context, u User) error
	User(ctx context.Context, id string) (User, bool, error)

	PutSession(ctx context.Context, s Session) error
	// Session returns the session if it exists and has not expired.
	Session(ctx context.Context, id string) (Session, bool, error)
	DeleteSession(ctx context.Context, id string) error

	// UseNonce records an OpenID response nonce until the given time. It
	// returns false when the nonce was already used (a replay).
	UseNonce(ctx context.Context, nonce string, until time.Time) (bool, error)

	// SetFriends replaces the friend list fetched for a user.
	SetFriends(ctx context.Context, userID string, friendIDs []string) error
	// AreFriends reports whether either user lists the other as a friend.
	AreFriends(a, b string) bool
}

// Memory is the in-memory Store. Nothing survives a restart: users sign in
// again, which is acceptable until Postgres arrives.
type Memory struct {
	mu       sync.Mutex
	now      func() time.Time
	users    map[string]User
	sessions map[string]Session
	nonces   map[string]time.Time
	friends  map[string]map[string]bool
}

// maxNonces bounds the replay cache; expired entries are pruned before this.
const maxNonces = 100_000

// NewMemory returns an empty in-memory store. now may be nil (time.Now).
func NewMemory(now func() time.Time) *Memory {
	if now == nil {
		now = time.Now
	}
	return &Memory{
		now:      now,
		users:    map[string]User{},
		sessions: map[string]Session{},
		nonces:   map[string]time.Time{},
		friends:  map[string]map[string]bool{},
	}
}

func (m *Memory) PutUser(_ context.Context, u User) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.users[u.ID] = u
	return nil
}

func (m *Memory) User(_ context.Context, id string) (User, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	return u, ok, nil
}

func (m *Memory) PutSession(_ context.Context, s Session) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Drop expired sessions now and then so the map cannot grow forever.
	if len(m.sessions)%256 == 0 {
		now := m.now()
		for id, old := range m.sessions {
			if now.After(old.Expires) {
				delete(m.sessions, id)
			}
		}
	}
	m.sessions[s.ID] = s
	return nil
}

func (m *Memory) Session(_ context.Context, id string) (Session, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[id]
	if !ok {
		return Session{}, false, nil
	}
	if m.now().After(s.Expires) {
		delete(m.sessions, id)
		return Session{}, false, nil
	}
	return s, true, nil
}

func (m *Memory) DeleteSession(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, id)
	return nil
}

func (m *Memory) UseNonce(_ context.Context, nonce string, until time.Time) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	if exp, seen := m.nonces[nonce]; seen && now.Before(exp) {
		return false, nil
	}
	if len(m.nonces) >= maxNonces {
		for n, exp := range m.nonces {
			if !now.Before(exp) {
				delete(m.nonces, n)
			}
		}
		// Still full of live nonces: refuse rather than forget one (fail closed).
		if len(m.nonces) >= maxNonces {
			return false, nil
		}
	}
	m.nonces[nonce] = until
	return true, nil
}

func (m *Memory) SetFriends(_ context.Context, userID string, friendIDs []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	set := make(map[string]bool, len(friendIDs))
	for _, id := range friendIDs {
		if id != userID {
			set[id] = true
		}
	}
	m.friends[userID] = set
	return nil
}

func (m *Memory) AreFriends(a, b string) bool {
	if a == b {
		return false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.friends[a][b] || m.friends[b][a]
}
