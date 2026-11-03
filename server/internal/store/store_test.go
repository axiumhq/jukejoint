package store

import (
	"context"
	"testing"
	"time"
)

func TestMemory(t *testing.T) {
	ctx := context.Background()
	now := time.Unix(1_800_000_000, 0)
	m := NewMemory(func() time.Time { return now })

	_ = m.PutSession(ctx, Session{ID: "s1", UserID: "u1", Expires: now.Add(time.Hour)})
	if s, ok, _ := m.Session(ctx, "s1"); !ok || s.UserID != "u1" {
		t.Fatal("session missing")
	}
	now = now.Add(2 * time.Hour)
	if _, ok, _ := m.Session(ctx, "s1"); ok {
		t.Fatal("expired session returned")
	}

	if fresh, _ := m.UseNonce(ctx, "n", now.Add(time.Minute)); !fresh {
		t.Fatal("first use")
	}
	if fresh, _ := m.UseNonce(ctx, "n", now.Add(time.Minute)); fresh {
		t.Fatal("replay accepted")
	}

	_ = m.SetFriends(ctx, "a", []string{"b", "a"})
	if !m.AreFriends("a", "b") || !m.AreFriends("b", "a") || m.AreFriends("a", "a") || m.AreFriends("a", "c") {
		t.Fatal("friendship")
	}
}
