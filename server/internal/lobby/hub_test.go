package lobby

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

/* ───────── Fakes ───────── */

type fakeClock struct {
	mu     sync.Mutex
	now    time.Time
	timers []*fakeTimer
}

type fakeTimer struct {
	at             time.Time
	f              func()
	stopped, fired bool
}

func (t *fakeTimer) Stop() bool {
	was := !t.stopped && !t.fired
	t.stopped = true
	return was
}

func newClock() *fakeClock { return &fakeClock{now: time.UnixMilli(1_800_000_000_000)} }

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) AfterFunc(d time.Duration, f func()) Timer {
	c.mu.Lock()
	defer c.mu.Unlock()
	t := &fakeTimer{at: c.now.Add(d), f: f}
	c.timers = append(c.timers, t)
	return t
}

// Advance moves time forward, firing due timers in order (outside the clock's
// lock, as the real ones run on their own goroutine).
func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	target := c.now.Add(d)
	c.mu.Unlock()
	for {
		c.mu.Lock()
		var next *fakeTimer
		for _, t := range c.timers {
			if !t.stopped && !t.fired && !t.at.After(target) && (next == nil || t.at.Before(next.at)) {
				next = t
			}
		}
		if next == nil {
			c.now = target
			c.mu.Unlock()
			return
		}
		c.now = next.at
		next.fired = true
		c.mu.Unlock()
		next.f()
	}
}

type fakeClient struct {
	id   string
	msgs []Msg
}

func (c *fakeClient) UserID() string { return c.id }
func (c *fakeClient) Send(m Msg)     { c.msgs = append(c.msgs, m) }

func (c *fakeClient) count(typ string) int {
	n := 0
	for _, m := range c.msgs {
		if m["type"] == typ {
			n++
		}
	}
	return n
}

func (c *fakeClient) last(typ string) Msg {
	for i := len(c.msgs) - 1; i >= 0; i-- {
		if c.msgs[i]["type"] == typ {
			return c.msgs[i]
		}
	}
	return nil
}

// view is the latest view of lobby id this client received.
func (c *fakeClient) view(t *testing.T, id string) View {
	t.Helper()
	for i := len(c.msgs) - 1; i >= 0; i-- {
		m := c.msgs[i]
		switch m["type"] {
		case "lobby":
			if v := m["lobby"].(View); v.ID == id {
				return v
			}
		case "lobby_removed":
			if m["lobbyId"] == id {
				t.Fatalf("%s: lobby %s was removed", c.id, id)
			}
		case "lobbies":
			for _, v := range m["lobbies"].([]View) {
				if v.ID == id {
					return v
				}
			}
		}
	}
	t.Fatalf("%s never saw lobby %s", c.id, id)
	return View{}
}

type friendSet map[string]bool

func (f friendSet) AreFriends(a, b string) bool { return f[a+"|"+b] || f[b+"|"+a] }

type env struct {
	t     *testing.T
	clock *fakeClock
	hub   *Hub
	ids   int
}

func newEnv(t *testing.T, friends friendSet) *env {
	e := &env{t: t, clock: newClock()}
	e.hub = New(e.clock, friends)
	e.hub.newID = func() string { e.ids++; return fmt.Sprintf("l%d", e.ids) }
	return e
}

func (e *env) connect(id string) *fakeClient {
	c := &fakeClient{id: id}
	var u *UserRef
	if id != "" {
		u = &UserRef{ID: id, Name: "Nome " + id}
	}
	e.hub.Connect(c, u)
	return c
}

func (e *env) do(uid string, in Intent) Msg {
	e.t.Helper()
	ack, err := e.hub.Handle(uid, in)
	if err != nil {
		e.t.Fatalf("%s %s: %v", uid, in.Type, err)
	}
	return ack
}

func (e *env) refuse(uid string, in Intent, code string) {
	e.t.Helper()
	_, err := e.hub.Handle(uid, in)
	if err == nil || err.Code != code {
		e.t.Fatalf("%s %s: got %v, want %s", uid, in.Type, err, code)
	}
}

func (e *env) create(uid string, c CreateLobby) string {
	e.t.Helper()
	if c.Name == "" {
		c.Name = "Sala de teste"
	}
	if c.ModeSlug == "" {
		c.ModeSlug, c.Region, c.Slots, c.MinPlayers = "duelo-meia-noite", "BR", 8, 2
	}
	return e.do(uid, Intent{Type: "create", Lobby: &c})["lobbyId"].(string)
}

func ptr[T any](v T) *T { return &v }

/* ───────── Room state machine ───────── */

func TestCreateSeatsHostReady(t *testing.T) {
	e := newEnv(t, nil)
	a := e.connect("a")
	id := e.create("a", CreateLobby{})
	v := a.view(t, id)
	if v.HostID != "a" || v.Players != 1 || v.Status != "aberto" || v.Phase != PhaseOpen {
		t.Fatalf("bad view: %+v", v)
	}
	if len(v.Seats) != 1 || !v.Seats[0].Ready || !v.Seats[0].Host {
		t.Fatalf("host seat should be ready: %+v", v.Seats)
	}
	if a.last("here")["lobbyId"] != id {
		t.Fatalf("host did not get here: %v", a.last("here"))
	}
}

func TestCreateValidation(t *testing.T) {
	e := newEnv(t, nil)
	e.connect("a")
	bad := []CreateLobby{
		{Name: "  ", ModeSlug: "neblina", Region: "BR", Slots: 10, MinPlayers: 5},
		{Name: "x", ModeSlug: "nao-existe", Region: "BR", Slots: 10, MinPlayers: 5},
		{Name: "x", ModeSlug: "neblina", Region: "XX", Slots: 10, MinPlayers: 5},
		{Name: "x", ModeSlug: "neblina", Region: "BR", Slots: 11, MinPlayers: 5},
		{Name: "x", ModeSlug: "neblina", Region: "BR", Slots: 10, MinPlayers: 4},
		{Name: "x", ModeSlug: "neblina", Region: "BR", Slots: 6, MinPlayers: 7},
	}
	for i, c := range bad {
		c := c
		e.refuse("a", Intent{Type: "create", Lobby: &c}, "bad_request")
		_ = i
	}
	e.refuse("a", Intent{Type: "create"}, "bad_request")
	e.refuse("", Intent{Type: "create"}, "auth_required")
	e.refuse("ghost", Intent{Type: "create"}, "auth_required")
	e.refuse("a", Intent{Type: "teleport"}, "bad_request")
}

func TestCleanText(t *testing.T) {
	cases := map[string]string{
		"  Sala ‮teste‬  ": "Sala teste",
		"a\x00b\nc":        "abc",
		"um    dois":       "um dois",
		"\xff\xfeok":       "ok",
	}
	for in, want := range cases {
		if got := CleanText(in, 40); got != want {
			t.Errorf("CleanText(%q) = %q, want %q", in, got, want)
		}
	}
	if got := CleanText("ááááá", 3); got != "ááá" {
		t.Errorf("cap by runes: %q", got)
	}
}

func TestFullFlowCountdownHandoff(t *testing.T) {
	e := newEnv(t, nil)
	a, b := e.connect("a"), e.connect("b")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})
	if v := a.view(t, id); v.Players != 2 || v.Seats[1].UserID != "b" || v.Seats[1].Ready {
		t.Fatalf("b should be seated, not ready: %+v", v.Seats)
	}
	// Quorum is 2: b still has to confirm.
	e.refuse("a", Intent{Type: "start"}, "cannot_start")
	e.refuse("b", Intent{Type: "start"}, "not_host")

	e.do("b", Intent{Type: "ready", Ready: ptr(true)})
	e.do("a", Intent{Type: "start"})
	v := b.view(t, id)
	if v.Phase != PhaseCountdown || v.CountdownMs != StartCountdown.Milliseconds() {
		t.Fatalf("countdown not shown to b: %+v", v)
	}

	// Un-confirming during the countdown cancels it.
	e.clock.Advance(2 * time.Second)
	e.do("b", Intent{Type: "ready", Ready: ptr(false)})
	if v := a.view(t, id); v.Phase != PhaseOpen {
		t.Fatalf("unready should cancel: %s", v.Phase)
	}
	e.clock.Advance(10 * time.Second)
	if v := a.view(t, id); v.Phase != PhaseOpen {
		t.Fatalf("cancelled countdown fired anyway: %s", v.Phase)
	}

	// Again, to the end.
	e.do("b", Intent{Type: "ready", Ready: ptr(true)})
	e.do("a", Intent{Type: "start"})
	e.clock.Advance(StartCountdown - time.Millisecond)
	if v := a.view(t, id); v.Phase != PhaseCountdown {
		t.Fatalf("started early: %s", v.Phase)
	}
	e.clock.Advance(time.Millisecond)
	for _, c := range []*fakeClient{a, b} {
		v := c.view(t, id)
		if v.Phase != PhaseHandoff || v.HandoffStep == nil || *v.HandoffStep != 0 || v.Status != "em-partida" {
			t.Fatalf("%s: handoff not started: %+v", c.id, v)
		}
	}
	for step := 1; step <= len(HandoffSteps); step++ {
		e.clock.Advance(HandoffSteps[step-1])
		v := b.view(t, id)
		if *v.HandoffStep != step {
			t.Fatalf("step %d: got %d", step, *v.HandoffStep)
		}
	}
	if v := b.view(t, id); v.Phase != PhasePlaying {
		t.Fatalf("should be playing: %s", v.Phase)
	}
	e.refuse("b", Intent{Type: "ready", Ready: ptr(false)}, "playing")

	e.do("a", Intent{Type: "end_match"})
	if v := b.view(t, id); v.Phase != PhaseOpen || v.Seats[1].Ready {
		t.Fatalf("end_match should reopen and reset ready: %+v", v)
	}
}

func TestHostCancelsAndLeaveBelowQuorum(t *testing.T) {
	e := newEnv(t, nil)
	a, _ := e.connect("a"), e.connect("b")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.do("b", Intent{Type: "ready", Ready: ptr(true)})

	e.do("a", Intent{Type: "start"})
	e.do("a", Intent{Type: "cancel_start"})
	if v := a.view(t, id); v.Phase != PhaseOpen {
		t.Fatalf("host cancel: %s", v.Phase)
	}
	e.refuse("b", Intent{Type: "cancel_start"}, "not_host")

	e.do("a", Intent{Type: "start"})
	e.do("b", Intent{Type: "leave"})
	if v := a.view(t, id); v.Phase != PhaseOpen || v.Players != 1 {
		t.Fatalf("leaving below quorum should cancel: %+v", v)
	}
	e.clock.Advance(time.Minute)
	if v := a.view(t, id); v.Phase != PhaseOpen {
		t.Fatalf("timer survived: %s", v.Phase)
	}
}

func TestHostLeavesThenEmptyCloses(t *testing.T) {
	e := newEnv(t, nil)
	a, b := e.connect("a"), e.connect("b")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.do("a", Intent{Type: "leave"})
	v := b.view(t, id)
	if v.HostID != "b" || v.Players != 1 || !v.Seats[0].Ready {
		t.Fatalf("host should pass to b: %+v", v)
	}
	if a.last("here")["lobbyId"] != nil {
		t.Fatalf("a still here: %v", a.last("here"))
	}
	e.do("b", Intent{Type: "leave"})
	if m := a.last("lobby_removed"); m == nil || m["lobbyId"] != id || m["reason"] != "empty" {
		t.Fatalf("empty lobby should close: %v", m)
	}
	if _, ok := e.hub.Get(id, ""); ok {
		t.Fatal("lobby still listed")
	}
}

func TestCloseByHost(t *testing.T) {
	e := newEnv(t, nil)
	_, b := e.connect("a"), e.connect("b")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.refuse("b", Intent{Type: "close"}, "not_host")
	e.do("a", Intent{Type: "close"})
	if b.last("lobby_closed")["lobbyId"] != id || b.last("here")["lobbyId"] != nil {
		t.Fatalf("b not told: %v %v", b.last("lobby_closed"), b.last("here"))
	}
}

func TestKick(t *testing.T) {
	e := newEnv(t, nil)
	a, b := e.connect("a"), e.connect("b")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.refuse("b", Intent{Type: "kick", UserID: "a"}, "not_host")
	e.refuse("a", Intent{Type: "kick", UserID: "a"}, "bad_request")
	e.do("a", Intent{Type: "kick", UserID: "b"})
	if b.last("kicked")["lobbyId"] != id {
		t.Fatalf("b not told: %v", b.last("kicked"))
	}
	if v := a.view(t, id); v.Players != 1 {
		t.Fatalf("b still seated: %+v", v)
	}
	e.refuse("b", Intent{Type: "join", LobbyID: id}, "kicked")
}

func TestFullAndJoinInProgress(t *testing.T) {
	e := newEnv(t, nil)
	for _, id := range []string{"a", "b", "c"} {
		e.connect(id)
	}
	id := e.create("a", CreateLobby{Name: "Treino", ModeSlug: "campo-de-treino", Region: "BR", Slots: 2, MinPlayers: 1, JoinInProgress: ptr(false)})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.refuse("c", Intent{Type: "join", LobbyID: id}, "full")
	if v, _ := e.hub.Get(id, ""); v.Status != "cheio" || v.FullSince == 0 {
		t.Fatalf("should be full: %+v", v)
	}
	e.do("b", Intent{Type: "leave"})
	e.do("a", Intent{Type: "start"})
	e.clock.Advance(StartCountdown)
	e.refuse("c", Intent{Type: "join", LobbyID: id}, "playing")
	e.refuse("c", Intent{Type: "join", LobbyID: "nope"}, "not_found")
}

func TestSwitchLobby(t *testing.T) {
	e := newEnv(t, nil)
	e.connect("a")
	e.connect("b")
	c := e.connect("c")
	la := e.create("a", CreateLobby{})
	lb := e.create("b", CreateLobby{})
	e.do("c", Intent{Type: "join", LobbyID: la})
	e.do("c", Intent{Type: "join", LobbyID: lb})
	if v := c.view(t, la); v.Players != 1 {
		t.Fatalf("c should have left la: %+v", v)
	}
	if v := c.view(t, lb); v.Players != 2 {
		t.Fatalf("c should be in lb: %+v", v)
	}
	// Creating a lobby while hosting another alone closes the old one.
	e.do("c", Intent{Type: "leave"})
	nl := e.create("a", CreateLobby{Name: "Outra"})
	if _, ok := e.hub.Get(la, ""); ok {
		t.Fatal("old lobby should close when its only member opens another")
	}
	if _, ok := e.hub.Get(nl, ""); !ok {
		t.Fatal("new lobby missing")
	}
}

func TestLockedKnock(t *testing.T) {
	e := newEnv(t, nil)
	a, b, c := e.connect("a"), e.connect("b"), e.connect("")
	id := e.create("a", CreateLobby{Name: "Clã", ModeSlug: "neblina", Region: "BR", Slots: 10, MinPlayers: 5, Locked: true})

	// Private: outsiders see only the count.
	for _, cl := range []*fakeClient{b, c} {
		if v := cl.view(t, id); !v.Hidden || v.Seats != nil || v.Joins != nil || v.Players != 1 {
			t.Fatalf("%q should see a hidden lobby: %+v", cl.id, v)
		}
	}
	e.refuse("b", Intent{Type: "join", LobbyID: id}, "locked")
	e.do("b", Intent{Type: "knock", LobbyID: id, Message: "oi, ‮sou eu"})
	if b.last("knock")["status"] != "pending" {
		t.Fatalf("knock status: %v", b.last("knock"))
	}
	v := a.view(t, id)
	if len(v.Knocks) != 1 || v.Knocks[0].UserID != "b" || v.Knocks[0].Message != "oi, sou eu" {
		t.Fatalf("host should see the knock: %+v", v.Knocks)
	}
	if v := c.view(t, id); v.Knocks != nil {
		t.Fatal("knocks leaked to a viewer")
	}
	e.refuse("b", Intent{Type: "answer_knock", UserID: "b", Accept: ptr(true)}, "not_in_lobby")
	e.do("a", Intent{Type: "answer_knock", UserID: "b", Accept: ptr(true)})
	if b.last("knock")["status"] != "accepted" {
		t.Fatalf("knock not accepted: %v", b.last("knock"))
	}
	e.do("b", Intent{Type: "join", LobbyID: id})
	if v := b.view(t, id); v.Hidden || len(v.Seats) != 2 {
		t.Fatalf("member should see seats: %+v", v)
	}
	e.refuse("b", Intent{Type: "knock", LobbyID: "nope"}, "not_found")
}

func TestKnockDeclined(t *testing.T) {
	e := newEnv(t, nil)
	e.connect("a")
	b := e.connect("b")
	id := e.create("a", CreateLobby{Name: "Clã", ModeSlug: "neblina", Region: "BR", Slots: 10, MinPlayers: 5, Locked: true})
	e.do("b", Intent{Type: "knock", LobbyID: id})
	e.do("a", Intent{Type: "answer_knock", UserID: "b", Accept: ptr(false)})
	if b.last("knock")["status"] != "declined" {
		t.Fatalf("got %v", b.last("knock"))
	}
	e.refuse("b", Intent{Type: "join", LobbyID: id}, "locked")
}

func TestInvite(t *testing.T) {
	e := newEnv(t, friendSet{"a|b": true})
	a, b := e.connect("a"), e.connect("b")
	e.connect("c")
	// Friends see each other online.
	if fl := a.last("friend"); fl == nil || fl["friend"].(FriendView).ID != "b" {
		t.Fatalf("a should see b come online: %v", fl)
	}
	e.refuse("a", Intent{Type: "invite", UserID: "b"}, "not_in_lobby")
	id := e.create("a", CreateLobby{Name: "Clã", ModeSlug: "neblina", Region: "BR", Slots: 10, MinPlayers: 5, Locked: true})
	if fl := b.last("friend"); fl["friend"].(FriendView).LobbyID != "" {
		t.Fatalf("locked lobby leaked in presence: %v", fl)
	}
	e.refuse("a", Intent{Type: "invite", UserID: "c"}, "not_friend")
	e.do("a", Intent{Type: "invite", UserID: "b"})
	inv := b.last("invite")["invite"].(InviteView)
	if inv.FromID != "a" || inv.LobbyID != id {
		t.Fatalf("invite: %+v", inv)
	}
	e.refuse("a", Intent{Type: "invite", UserID: "b"}, "rate_limited")
	// The invite opens the locked door.
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.refuse("a", Intent{Type: "invite", UserID: "b"}, "already_in")

	// Closing the lobby withdraws pending invites.
	e.do("b", Intent{Type: "leave"})
	e.clock.Advance(InviteCooldown)
	e.do("a", Intent{Type: "invite", UserID: "b"})
	e.do("a", Intent{Type: "close"})
	if b.last("invite_gone")["lobbyId"] != id {
		t.Fatalf("invite not withdrawn: %v", b.last("invite_gone"))
	}
}

func TestInviteOfflineAndNonHostLocked(t *testing.T) {
	e := newEnv(t, friendSet{"a|b": true, "b|c": true})
	e.connect("a")
	e.connect("b")
	id := e.create("a", CreateLobby{Name: "Clã", ModeSlug: "neblina", Region: "BR", Slots: 10, MinPlayers: 5, Locked: true})
	e.do("a", Intent{Type: "invite", UserID: "b"})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.connect("c")
	e.refuse("b", Intent{Type: "invite", UserID: "c"}, "not_host")
	e.do("b", Intent{Type: "leave"})
	open := e.create("b", CreateLobby{})
	_ = open
	cl := &fakeClient{id: "z"}
	e.hub.Connect(cl, &UserRef{ID: "z", Name: "Z"})
	e.hub.Disconnect(cl)
	e.refuse("b", Intent{Type: "invite", UserID: "z"}, "not_friend")
}

func TestReconnectGrace(t *testing.T) {
	e := newEnv(t, friendSet{"a|b": true})
	a, b := e.connect("a"), e.connect("b")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})

	e.hub.Disconnect(b)
	if a.last("friend_gone")["id"] != "b" {
		t.Fatalf("a should see b go offline: %v", a.last("friend_gone"))
	}
	e.clock.Advance(ReconnectGrace - time.Second)
	b2 := e.connect("b")
	if b2.last("welcome")["here"] != id {
		t.Fatalf("reconnect should land back in the lobby: %v", b2.last("welcome"))
	}
	e.clock.Advance(time.Minute)
	if v := a.view(t, id); v.Players != 2 {
		t.Fatalf("grace timer removed a reconnected member: %+v", v)
	}

	e.hub.Disconnect(b2)
	e.clock.Advance(ReconnectGrace)
	if v := a.view(t, id); v.Players != 1 {
		t.Fatalf("seat should be freed after the grace: %+v", v)
	}
	// Host gone too: the lobby closes.
	e.hub.Disconnect(a)
	e.clock.Advance(ReconnectGrace)
	if _, ok := e.hub.Get(id, ""); ok {
		t.Fatal("abandoned lobby should close")
	}
}

func TestJoinCodeMembersOnly(t *testing.T) {
	e := newEnv(t, nil)
	a, b, c := e.connect("a"), e.connect("b"), e.connect("c")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.refuse("b", Intent{Type: "set_join_code", Code: "x"}, "not_host")
	e.refuse("a", Intent{Type: "set_join_code", Code: "tem espaço"}, "bad_request")
	e.do("a", Intent{Type: "set_join_code", Code: "peer:12D3KooWabc"})
	if a.view(t, id).JoinCode != "peer:12D3KooWabc" || b.view(t, id).JoinCode != "peer:12D3KooWabc" {
		t.Fatal("members should get the join code")
	}
	if c.view(t, id).JoinCode != "" {
		t.Fatal("join code leaked to an outsider")
	}
}

/* ───────── The desktop app's progress (handoff_progress) ───────── */

// matchOf seats a (host) and the given guests, confirms them and runs the
// countdown until the handoff starts.
func matchOf(e *env, guests ...string) string {
	e.t.Helper()
	id := e.create("a", CreateLobby{})
	for _, g := range guests {
		e.do(g, Intent{Type: "join", LobbyID: id})
		e.do(g, Intent{Type: "ready", Ready: ptr(true)})
	}
	e.do("a", Intent{Type: "start"})
	e.clock.Advance(StartCountdown)
	return id
}

func seatStep(t *testing.T, v View, uid string) *int {
	t.Helper()
	for _, s := range v.Seats {
		if s.UserID == uid {
			return s.Step
		}
	}
	t.Fatalf("no seat for %s", uid)
	return nil
}

func TestWelcomeHasProtocol(t *testing.T) {
	e := newEnv(t, nil)
	if w := e.connect("a").last("welcome"); w["protocol"] != Protocol || Protocol < 2 {
		t.Fatalf("welcome without protocol: %v", w)
	}
}

func TestHandoffProgressValidation(t *testing.T) {
	e := newEnv(t, nil)
	e.connect("a")
	e.connect("b")
	e.connect("c")
	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})
	e.refuse("a", Intent{Type: "handoff_progress", Step: ptr(0)}, "not_in_match")
	e.do("b", Intent{Type: "ready", Ready: ptr(true)})
	e.do("a", Intent{Type: "start"})
	e.refuse("b", Intent{Type: "handoff_progress", Step: ptr(0)}, "not_in_match") // countdown is not the match
	e.clock.Advance(StartCountdown)

	e.refuse("c", Intent{Type: "handoff_progress", Step: ptr(0)}, "not_in_lobby") // not seated
	e.refuse("b", Intent{Type: "handoff_progress"}, "bad_request")
	e.refuse("b", Intent{Type: "handoff_progress", Step: ptr(-1)}, "bad_request")
	e.refuse("b", Intent{Type: "handoff_progress", Step: ptr(len(HandoffSteps) + 1)}, "bad_request")
	e.do("b", Intent{Type: "handoff_progress", Step: ptr(2)})
	e.do("b", Intent{Type: "handoff_progress", Step: ptr(2)}) // same step: nothing to do
	e.refuse("b", Intent{Type: "handoff_progress", Step: ptr(1)}, "bad_request")
	e.refuse("", Intent{Type: "handoff_progress", Step: ptr(3)}, "auth_required")
}

func TestHandoffFollowsHostApp(t *testing.T) {
	e := newEnv(t, nil)
	a, b := e.connect("a"), e.connect("b")
	id := matchOf(e, "b")
	if v := b.view(t, id); v.Phase != PhaseHandoff || *v.HandoffStep != 0 || seatStep(t, v, "a") != nil {
		t.Fatalf("handoff should start with no reports: %+v", v)
	}

	// A guest's report moves only their seat; the room timer keeps going.
	e.do("b", Intent{Type: "handoff_progress", Step: ptr(1)})
	if v := a.view(t, id); *seatStep(t, v, "b") != 1 || *v.HandoffStep != 0 {
		t.Fatalf("guest report: %+v", v.Seats)
	}
	e.clock.Advance(HandoffSteps[0])
	if v := a.view(t, id); *v.HandoffStep != 1 {
		t.Fatalf("timer should still drive the room before the host reports: %d", *v.HandoffStep)
	}

	// The host's app reports: the timer stops for good and the room follows the app.
	e.do("a", Intent{Type: "handoff_progress", Step: ptr(0)})
	if v := a.view(t, id); *v.HandoffStep != 1 || *seatStep(t, v, "a") != 0 {
		t.Fatalf("the room step never goes back: %+v", v)
	}
	e.clock.Advance(time.Minute)
	if v := b.view(t, id); *v.HandoffStep != 1 || v.Phase != PhaseHandoff {
		t.Fatalf("timer kept going after the app reported: %+v", v)
	}
	e.do("a", Intent{Type: "handoff_progress", Step: ptr(2)})
	if v := b.view(t, id); *v.HandoffStep != 2 || v.Phase != PhaseHandoff {
		t.Fatalf("host step 2: %+v", v)
	}
	e.do("a", Intent{Type: "handoff_progress", Step: ptr(len(HandoffSteps))})
	if v := b.view(t, id); v.Phase != PhasePlaying || *v.HandoffStep != len(HandoffSteps) {
		t.Fatalf("host inside should mean playing: %+v", v)
	}
	// The guest is still on their own way in, and gets there later.
	e.do("b", Intent{Type: "handoff_progress", Step: ptr(len(HandoffSteps))})
	if v := a.view(t, id); *seatStep(t, v, "b") != len(HandoffSteps) {
		t.Fatalf("guest inside: %+v", v.Seats)
	}
}

func TestEndMatchClearsCodeAndSteps(t *testing.T) {
	e := newEnv(t, nil)
	a, b := e.connect("a"), e.connect("b")
	id := matchOf(e, "b")
	e.do("a", Intent{Type: "set_join_code", Code: "k7Qx29zz"})
	e.do("a", Intent{Type: "handoff_progress", Step: ptr(3)})
	e.do("b", Intent{Type: "handoff_progress", Step: ptr(1)})
	if v := b.view(t, id); v.JoinCode != "k7Qx29zz" || v.Phase != PhasePlaying {
		t.Fatalf("before end_match: %+v", v)
	}
	e.do("a", Intent{Type: "end_match"})
	v := b.view(t, id)
	if v.Phase != PhaseOpen || v.JoinCode != "" || v.HandoffStep != nil || seatStep(t, v, "b") != nil {
		t.Fatalf("end_match should clear the code and the steps: %+v", v)
	}
	e.refuse("b", Intent{Type: "handoff_progress", Step: ptr(2)}, "not_in_match")

	// Next match: no reports yet, so the timer is the fallback again.
	e.do("b", Intent{Type: "ready", Ready: ptr(true)})
	e.do("a", Intent{Type: "start"})
	e.clock.Advance(StartCountdown)
	for _, d := range HandoffSteps {
		e.clock.Advance(d)
	}
	if v := a.view(t, id); v.Phase != PhasePlaying {
		t.Fatalf("timer fallback after a reset: %+v", v)
	}
}

func TestHostLeavingEndsTheMatch(t *testing.T) {
	e := newEnv(t, nil)
	e.connect("a")
	b, _ := e.connect("b"), e.connect("c")
	id := matchOf(e, "b", "c")
	e.do("a", Intent{Type: "set_join_code", Code: "k7Qx29zz"})
	e.do("a", Intent{Type: "handoff_progress", Step: ptr(1)})
	e.do("a", Intent{Type: "leave"})
	v := b.view(t, id)
	if v.HostID != "b" || v.Phase != PhaseOpen || v.JoinCode != "" || v.Status != "aberto" {
		t.Fatalf("host left mid-match: %+v", v)
	}
	if seatStep(t, v, "b") != nil {
		t.Fatalf("steps should reset: %+v", v.Seats)
	}
	// The old host's code never comes back, not even outside a match.
	e.do("b", Intent{Type: "set_join_code", Code: "novo-codigo"})
	e.do("b", Intent{Type: "leave"})
	if v := e.hub.lobbies[id]; v.joinCode != "" {
		t.Fatalf("code survived the host change: %q", v.joinCode)
	}
}

func TestAnonymousIsReadOnly(t *testing.T) {
	e := newEnv(t, nil)
	e.connect("a")
	v := e.connect("")
	e.create("a", CreateLobby{})
	if v.count("lobby") == 0 {
		t.Fatal("anonymous viewer should get lobby updates")
	}
	e.refuse("", Intent{Type: "join", LobbyID: "l1"}, "auth_required")
}

func TestListFilters(t *testing.T) {
	e := newEnv(t, friendSet{"x|b": true})
	for _, id := range []string{"a", "b", "c", "x"} {
		e.connect(id)
	}
	br := e.create("a", CreateLobby{Name: "Duelo BR", ModeSlug: "duelo-meia-noite", Region: "BR", Slots: 8, MinPlayers: 2, Beginners: true})
	na := e.create("b", CreateLobby{Name: "Neblina NA", ModeSlug: "neblina", Region: "NA", Slots: 10, MinPlayers: 5})
	eu := e.create("c", CreateLobby{Name: "Treino EU", ModeSlug: "campo-de-treino", Region: "EU", Slots: 1, MinPlayers: 1})
	ids := func(f Filter, viewer string) []string {
		var out []string
		for _, v := range e.hub.List(f, viewer) {
			out = append(out, v.ID)
		}
		return out
	}
	eq := func(name string, got []string, want ...string) {
		t.Helper()
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Errorf("%s: got %v, want %v", name, got, want)
		}
	}
	eq("regions", ids(Filter{Regions: []string{"NA", "EU"}, Sort: "ping"}, ""), na, eu)
	eq("mode", ids(Filter{Mode: "neblina"}, ""), na)
	eq("beginners", ids(Filter{Beginners: true}, ""), br)
	eq("lowPing", ids(Filter{LowPing: true}, ""), br)
	eq("slots", ids(Filter{SlotsOnly: true, Sort: "ping"}, ""), br, na)
	eq("q", ids(Filter{Q: "nome c"}, ""), eu)
	eq("friends", ids(Filter{FriendsOnly: true}, "x"), na)
	e.do("c", Intent{Type: "start"})
	e.clock.Advance(StartCountdown)
	eq("playing", ids(Filter{Playing: true}, ""), eu)
}
