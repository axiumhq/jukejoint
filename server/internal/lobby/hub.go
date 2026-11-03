package lobby

import (
	"crypto/rand"
	"encoding/base32"
	"sort"
	"strings"
	"sync"
	"time"
)

// Error is a refused intent. Code is stable for clients; Message is PT-BR
// copy the web can show as is.
type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func errBad(msg string) *Error { return &Error{"bad_request", msg} }

var (
	errAuth      = &Error{"auth_required", "Entre com a Steam para fazer isso."}
	errNotFound  = &Error{"not_found", "Esse lobby não existe mais."}
	errNotIn     = &Error{"not_in_lobby", "Você não está em nenhum lobby."}
	errNotHost   = &Error{"not_host", "Só quem abriu o lobby pode fazer isso."}
	errFull      = &Error{"full", "O lobby lotou."}
	errLocked    = &Error{"locked", "Esse lobby é só com convite. Bata na porta."}
	errKicked    = &Error{"kicked", "Você foi removido desse lobby."}
	errPlaying   = &Error{"playing", "A partida já começou e não aceita entrada no meio."}
	errCannot    = &Error{"cannot_start", "Ainda falta gente confirmar para começar."}
	errTooMany   = &Error{"too_many_lobbies", "Muitos lobbies abertos agora. Tente de novo em instantes."}
	errNotFriend = &Error{"not_friend", "Só dá para chamar amigos."}
	errOffline   = &Error{"offline", "Essa pessoa não está online agora."}
	errCooldown  = &Error{"rate_limited", "Espere um pouco antes de chamar de novo."}
	errBusy      = &Error{"busy", "Muita gente batendo na porta agora. Tente daqui a pouco."}
	errUnknown   = errBad("Pedido desconhecido.")
)

// Intent is what a client asks for. The server validates it against the
// current state and decides; nothing in it is trusted.
type Intent struct {
	Type    string       `json:"type"`
	Req     int64        `json:"req,omitempty"`
	LobbyID string       `json:"lobbyId,omitempty"`
	UserID  string       `json:"userId,omitempty"`
	Ready   *bool        `json:"ready,omitempty"`
	Accept  *bool        `json:"accept,omitempty"`
	Message string       `json:"message,omitempty"`
	Code    string       `json:"code,omitempty"`
	Lobby   *CreateLobby `json:"lobby,omitempty"`
}

// Msg is a server message: a "type" plus its fields.
type Msg map[string]any

// Client is one connection. Send must never block: a slow client is dropped
// by its implementation, not waited on.
type Client interface {
	// UserID is "" for a signed-out viewer (read only).
	UserID() string
	Send(m Msg)
}

// Friends answers whether two users are friends.
type Friends interface {
	AreFriends(a, b string) bool
}

type invite struct {
	from UserRef
	at   time.Time
}

// person is a user the hub knows: connected, or holding a seat during the
// reconnect grace.
type person struct {
	user     UserRef
	conns    int
	lobbyID  string
	grace    Timer
	graceGen int
	invites  map[string]*invite   // by lobby ID
	knocks   map[string]string    // lobby ID → "pending" | "accepted"
	invited  map[string]time.Time // target user ID → last invite
}

// Hub owns every lobby and presence. All state lives behind one mutex: the
// scale of a community platform does not need more, and it keeps every
// transition atomic.
type Hub struct {
	mu      sync.Mutex
	clock   Clock
	friends Friends
	newID   func() string
	lobbies map[string]*Lobby
	people  map[string]*person
	clients map[Client]struct{}
	byUser  map[string]map[Client]struct{}
}

// New returns an empty hub.
func New(clock Clock, friends Friends) *Hub {
	if clock == nil {
		clock = RealClock{}
	}
	return &Hub{
		clock:   clock,
		friends: friends,
		newID:   randomID,
		lobbies: map[string]*Lobby{},
		people:  map[string]*person{},
		clients: map[Client]struct{}{},
		byUser:  map[string]map[Client]struct{}{},
	}
}

var idEnc = base32.NewEncoding("abcdefghijkmnpqrstuvwxyz23456789").WithPadding(base32.NoPadding)

func randomID() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return "l" + idEnc.EncodeToString(b)
}

func (h *Hub) areFriends(a, b string) bool {
	return h.friends != nil && h.friends.AreFriends(a, b)
}

/* ───────── Connections ───────── */

// Connect registers a connection. u is nil for a signed-out viewer, who gets
// the lobby list and its updates but cannot send intents.
func (h *Hub) Connect(c Client, u *UserRef) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = struct{}{}
	now := h.clock.Now()
	welcome := Msg{"type": "welcome", "serverNow": now.UnixMilli(), "me": nil, "here": nil}
	var p *person
	if u != nil {
		p = h.person(*u)
		p.conns++
		p.graceGen++
		if p.grace != nil {
			p.grace.Stop()
			p.grace = nil
		}
		set := h.byUser[u.ID]
		if set == nil {
			set = map[Client]struct{}{}
			h.byUser[u.ID] = set
		}
		set[c] = struct{}{}
		welcome["me"] = p.user
		if p.lobbyID != "" {
			welcome["here"] = p.lobbyID
		}
		welcome["knocks"] = p.knocks
		welcome["invites"] = h.inviteViews(p)
	}
	c.Send(welcome)
	views := make([]View, 0, len(h.lobbies))
	for _, l := range h.lobbies {
		views = append(views, l.view(c.UserID(), now))
	}
	c.Send(Msg{"type": "lobbies", "lobbies": views})
	if p != nil {
		c.Send(Msg{"type": "friends", "friends": h.friendList(p.user.ID)})
		if p.conns == 1 {
			h.pushPresence(p)
		}
	}
}

// Disconnect drops a connection. A member who loses their last connection
// keeps the seat for ReconnectGrace; after that they leave the lobby.
func (h *Hub) Disconnect(c Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
	uid := c.UserID()
	if uid == "" {
		return
	}
	if set := h.byUser[uid]; set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.byUser, uid)
		}
	}
	p := h.people[uid]
	if p == nil {
		return
	}
	p.conns--
	if p.conns > 0 {
		return
	}
	h.pushPresence(p)
	if p.lobbyID == "" {
		h.forget(p)
		return
	}
	p.graceGen++
	gen := p.graceGen
	p.grace = h.clock.AfterFunc(ReconnectGrace, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if p.graceGen != gen || p.conns > 0 {
			return
		}
		p.grace = nil
		if l := h.lobbies[p.lobbyID]; l != nil {
			h.removeMember(l, p.user.ID)
		}
		h.forget(p)
	})
}

func (h *Hub) person(u UserRef) *person {
	p := h.people[u.ID]
	if p == nil {
		p = &person{user: u, invites: map[string]*invite{}, knocks: map[string]string{}, invited: map[string]time.Time{}}
		h.people[u.ID] = p
	}
	p.user.Name = u.Name
	return p
}

func (h *Hub) forget(p *person) {
	if p.conns == 0 && p.lobbyID == "" && h.people[p.user.ID] == p {
		delete(h.people, p.user.ID)
	}
}

/* ───────── Sending ───────── */

func (h *Hub) sendTo(uid string, m Msg) {
	for c := range h.byUser[uid] {
		c.Send(m)
	}
}

func (h *Hub) pushLobby(l *Lobby) {
	now := h.clock.Now()
	for c := range h.clients {
		c.Send(Msg{"type": "lobby", "lobby": l.view(c.UserID(), now)})
	}
}

func (h *Hub) sendLobbyTo(l *Lobby, uid string) {
	h.sendTo(uid, Msg{"type": "lobby", "lobby": l.view(uid, h.clock.Now())})
}

// FriendView is a friend online, and the lobby they are in when the viewer may
// see it (a locked lobby stays private to its members).
type FriendView struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	LobbyID string `json:"lobbyId,omitempty"`
	Host    bool   `json:"host,omitempty"`
}

func (h *Hub) friendView(p *person, viewer string) FriendView {
	v := FriendView{ID: p.user.ID, Name: p.user.Name}
	if l := h.lobbies[p.lobbyID]; l != nil && (!l.Locked || l.member(viewer) != nil) {
		v.LobbyID = l.ID
		v.Host = l.HostID == p.user.ID
	}
	return v
}

func (h *Hub) friendList(uid string) []FriendView {
	out := []FriendView{}
	for id, q := range h.people {
		if q.conns > 0 && h.areFriends(uid, id) {
			out = append(out, h.friendView(q, uid))
		}
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	return out
}

// pushPresence tells p's online friends where p is now (or that p left).
func (h *Hub) pushPresence(p *person) {
	for id, q := range h.people {
		if q == p || q.conns == 0 || !h.areFriends(p.user.ID, id) {
			continue
		}
		if p.conns == 0 {
			h.sendTo(id, Msg{"type": "friend_gone", "id": p.user.ID})
		} else {
			h.sendTo(id, Msg{"type": "friend", "friend": h.friendView(p, id)})
		}
	}
}

// InviteView is an invite to a lobby, as the invited friend sees it.
type InviteView struct {
	FromID    string `json:"fromId"`
	FromName  string `json:"fromName"`
	LobbyID   string `json:"lobbyId"`
	LobbyName string `json:"lobbyName"`
	At        int64  `json:"at"`
}

func (h *Hub) inviteViews(p *person) []InviteView {
	out := []InviteView{}
	for id, inv := range p.invites {
		if l := h.lobbies[id]; l != nil {
			out = append(out, InviteView{inv.from.ID, inv.from.Name, id, l.Name, ms(inv.at)})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].At < out[j].At })
	return out
}

func (h *Hub) setLobby(p *person, id string) {
	p.lobbyID = id
	var here any
	if id != "" {
		here = id
	}
	h.sendTo(p.user.ID, Msg{"type": "here", "lobbyId": here})
	h.pushPresence(p)
	if p.conns > 0 {
		h.sendTo(p.user.ID, Msg{"type": "friends", "friends": h.friendList(p.user.ID)})
	}
}

/* ───────── Reading ───────── */

// List returns the lobbies matching f, sorted, as viewer sees them.
func (h *Hub) List(f Filter, viewer string) []View {
	h.mu.Lock()
	defer h.mu.Unlock()
	hasFriends := func(l *Lobby) bool {
		for _, m := range l.members {
			if h.areFriends(viewer, m.user.ID) {
				return true
			}
		}
		return false
	}
	if viewer == "" {
		hasFriends = nil
	}
	list := make([]*Lobby, 0, len(h.lobbies))
	for _, l := range h.lobbies {
		if f.match(l, hasFriends) {
			list = append(list, l)
		}
	}
	sortLobbies(list, f.Sort)
	now := h.clock.Now()
	out := make([]View, len(list))
	for i, l := range list {
		out[i] = l.view(viewer, now)
	}
	return out
}

// Get returns one lobby as viewer sees it.
func (h *Hub) Get(id, viewer string) (View, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	l := h.lobbies[id]
	if l == nil {
		return View{}, false
	}
	return l.view(viewer, h.clock.Now()), true
}

/* ───────── Intents ───────── */

// Handle applies one intent from uid. The returned fields go in the ack.
func (h *Hub) Handle(uid string, in Intent) (Msg, *Error) {
	if uid == "" {
		return nil, errAuth
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	p := h.people[uid]
	if p == nil || p.conns == 0 {
		return nil, errAuth
	}
	switch in.Type {
	case "create":
		return h.create(p, in.Lobby)
	case "join":
		return h.join(p, in.LobbyID)
	case "leave":
		l := h.lobbies[p.lobbyID]
		if l == nil {
			return nil, errNotIn
		}
		h.removeMember(l, p.user.ID)
		return nil, nil
	case "ready":
		return h.ready(p, in.Ready)
	case "start":
		return h.start(p)
	case "cancel_start":
		return h.cancelStart(p)
	case "end_match":
		return h.endMatch(p)
	case "kick":
		return h.kick(p, in.UserID)
	case "close":
		l, err := h.hosted(p)
		if err != nil {
			return nil, err
		}
		h.dropLobby(l, "closed")
		return nil, nil
	case "knock":
		return h.knock(p, in.LobbyID, in.Message)
	case "answer_knock":
		return h.answerKnock(p, in.UserID, in.Accept != nil && *in.Accept)
	case "invite":
		return h.invite(p, in.UserID)
	case "decline_invite":
		delete(p.invites, in.LobbyID)
		return nil, nil
	case "set_join_code":
		return h.setJoinCode(p, in.Code)
	case "ping":
		return nil, nil
	}
	return nil, errUnknown
}

func (h *Hub) hosted(p *person) (*Lobby, *Error) {
	l := h.lobbies[p.lobbyID]
	if l == nil {
		return nil, errNotIn
	}
	if l.HostID != p.user.ID {
		return nil, errNotHost
	}
	return l, nil
}

func (h *Hub) create(p *person, in *CreateLobby) (Msg, *Error) {
	if in == nil {
		return nil, errBad("Faltam os dados do lobby.")
	}
	c, err := in.validate()
	if err != nil {
		return nil, err
	}
	if cur := h.lobbies[p.lobbyID]; cur != nil {
		h.removeMember(cur, p.user.ID)
	}
	if len(h.lobbies) >= MaxLobbies {
		return nil, errTooMany
	}
	now := h.clock.Now()
	jip := true
	if c.JoinInProgress != nil {
		jip = *c.JoinInProgress
	}
	l := &Lobby{
		ID:             h.newID(),
		Name:           c.Name,
		Mode:           c.ModeSlug,
		Region:         c.Region,
		Slots:          c.Slots,
		MinPlayers:     c.MinPlayers,
		Locked:         c.Locked,
		Beginners:      c.Beginners,
		JoinInProgress: jip,
		HostID:         p.user.ID,
		OpenedAt:       now,
		members:        []*member{{user: p.user, ready: true, readyAt: now, joinedAt: now}},
		phase:          PhaseOpen,
		joins:          []joinEvent{{p.user, now}},
		allowed:        map[string]bool{},
		kicked:         map[string]bool{},
		knocks:         map[string]*knock{},
	}
	if l.players() >= l.Slots {
		l.fullSince = now
	}
	h.lobbies[l.ID] = l
	h.pushLobby(l)
	h.setLobby(p, l.ID)
	return Msg{"lobbyId": l.ID}, nil
}

func (h *Hub) join(p *person, id string) (Msg, *Error) {
	l := h.lobbies[id]
	if l == nil {
		return nil, errNotFound
	}
	uid := p.user.ID
	if l.member(uid) != nil {
		return Msg{"lobbyId": l.ID}, nil
	}
	switch {
	case l.kicked[uid]:
		return nil, errKicked
	case l.Locked && !l.allowed[uid]:
		return nil, errLocked
	case l.players() >= l.Slots:
		return nil, errFull
	case l.inMatch() && !l.JoinInProgress:
		return nil, errPlaying
	}
	if cur := h.lobbies[p.lobbyID]; cur != nil {
		h.removeMember(cur, uid)
	}
	now := h.clock.Now()
	m := &member{user: p.user, joinedAt: now}
	if l.inMatch() {
		m.ready, m.readyAt = true, now
	}
	l.members = append(l.members, m)
	l.joins = append(l.joins, joinEvent{p.user, now})
	if len(l.joins) > maxJoins {
		l.joins = l.joins[len(l.joins)-maxJoins:]
	}
	if l.players() >= l.Slots {
		l.fullSince = now
	}
	delete(p.invites, l.ID)
	delete(p.knocks, l.ID)
	delete(l.knocks, uid)
	h.pushLobby(l)
	h.setLobby(p, l.ID)
	return Msg{"lobbyId": l.ID}, nil
}

// removeMember takes uid out of l: the next member becomes host if the host
// left, the countdown is cancelled if the quorum is lost and an empty lobby
// closes.
func (h *Hub) removeMember(l *Lobby, uid string) {
	idx := -1
	for i, m := range l.members {
		if m.user.ID == uid {
			idx = i
		}
	}
	if idx < 0 {
		return
	}
	l.members = append(l.members[:idx], l.members[idx+1:]...)
	if p := h.people[uid]; p != nil && p.lobbyID == l.ID {
		h.setLobby(p, "")
	}
	if len(l.members) == 0 {
		h.dropLobby(l, "empty")
		return
	}
	if l.HostID == uid {
		next := l.members[0]
		l.HostID = next.user.ID
		next.ready, next.readyAt = true, h.clock.Now()
		// The pending knocks stay on the lobby, so the new host sees them in
		// the next push; friends see the new host flag.
		if np := h.people[next.user.ID]; np != nil {
			h.pushPresence(np)
		}
	}
	if l.phase == PhaseCountdown && (l.players() < l.MinPlayers || l.readyCount() < l.MinPlayers) {
		h.cancelCountdown(l)
	}
	if l.players() < l.Slots {
		l.fullSince = time.Time{}
	}
	h.pushLobby(l)
}

func (h *Hub) dropLobby(l *Lobby, reason string) {
	l.stopTimer()
	delete(h.lobbies, l.ID)
	members := l.members
	l.members = nil
	for _, m := range members {
		p := h.people[m.user.ID]
		if p == nil {
			continue
		}
		if p.lobbyID == l.ID {
			h.setLobby(p, "")
		}
		if reason == "closed" && m.user.ID != l.HostID {
			h.sendTo(p.user.ID, Msg{"type": "lobby_closed", "lobbyId": l.ID, "name": l.Name})
		}
		h.forget(p)
	}
	for _, p := range h.people {
		if _, ok := p.invites[l.ID]; ok {
			delete(p.invites, l.ID)
			h.sendTo(p.user.ID, Msg{"type": "invite_gone", "lobbyId": l.ID})
		}
		delete(p.knocks, l.ID)
	}
	for c := range h.clients {
		c.Send(Msg{"type": "lobby_removed", "lobbyId": l.ID, "reason": reason})
	}
}

func (h *Hub) ready(p *person, v *bool) (Msg, *Error) {
	if v == nil {
		return nil, errBad("Falta o pronto.")
	}
	l := h.lobbies[p.lobbyID]
	if l == nil {
		return nil, errNotIn
	}
	if l.inMatch() {
		return nil, &Error{"playing", "A partida já começou."}
	}
	if l.HostID == p.user.ID {
		return nil, nil // the host is always ready
	}
	m := l.member(p.user.ID)
	if m.ready == *v {
		return nil, nil
	}
	m.ready = *v
	m.readyAt = time.Time{}
	if *v {
		m.readyAt = h.clock.Now()
	}
	// Anyone un-confirming during the countdown cancels it.
	if !*v && l.phase == PhaseCountdown {
		h.cancelCountdown(l)
	}
	h.pushLobby(l)
	return nil, nil
}

// schedule runs f after d unless the lobby's timer is replaced or stopped (or
// the lobby is gone) first.
func (h *Hub) schedule(l *Lobby, d time.Duration, f func()) {
	l.stopTimer()
	gen := l.gen
	l.timer = h.clock.AfterFunc(d, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if l.gen != gen || h.lobbies[l.ID] != l {
			return
		}
		l.timer = nil
		f()
	})
}

func (h *Hub) start(p *person) (Msg, *Error) {
	l, err := h.hosted(p)
	if err != nil {
		return nil, err
	}
	switch l.phase {
	case PhaseCountdown:
		return nil, nil
	case PhaseHandoff, PhasePlaying:
		return nil, &Error{"playing", "A partida já começou."}
	}
	if l.players() < l.MinPlayers || l.readyCount() < l.MinPlayers {
		return nil, errCannot
	}
	l.phase = PhaseCountdown
	l.countdownEnds = h.clock.Now().Add(StartCountdown)
	h.schedule(l, StartCountdown, func() {
		if l.players() < l.MinPlayers || l.readyCount() < l.MinPlayers {
			h.cancelCountdown(l)
			h.pushLobby(l)
			return
		}
		h.beginHandoff(l)
	})
	h.pushLobby(l)
	return nil, nil
}

func (h *Hub) cancelCountdown(l *Lobby) {
	l.stopTimer()
	l.phase = PhaseOpen
	l.countdownEnds = time.Time{}
}

func (h *Hub) cancelStart(p *person) (Msg, *Error) {
	l, err := h.hosted(p)
	if err != nil {
		return nil, err
	}
	if l.phase == PhaseCountdown {
		h.cancelCountdown(l)
		h.pushLobby(l)
	}
	return nil, nil
}

func (h *Hub) beginHandoff(l *Lobby) {
	l.phase = PhaseHandoff
	l.handoffStep = 0
	l.startedAt = h.clock.Now()
	l.countdownEnds = time.Time{}
	l.fullSince = time.Time{}
	h.pushLobby(l)
	h.advanceHandoff(l)
}

func (h *Hub) advanceHandoff(l *Lobby) {
	h.schedule(l, HandoffSteps[l.handoffStep], func() {
		l.handoffStep++
		if l.handoffStep >= len(HandoffSteps) {
			l.phase = PhasePlaying
			h.pushLobby(l)
			return
		}
		h.pushLobby(l)
		h.advanceHandoff(l)
	})
}

func (h *Hub) endMatch(p *person) (Msg, *Error) {
	l, err := h.hosted(p)
	if err != nil {
		return nil, err
	}
	if !l.inMatch() {
		return nil, nil
	}
	l.stopTimer()
	l.phase = PhaseOpen
	l.handoffStep = 0
	l.startedAt = time.Time{}
	for _, m := range l.members {
		if m.user.ID != l.HostID {
			m.ready, m.readyAt = false, time.Time{}
		}
	}
	if l.players() >= l.Slots {
		l.fullSince = h.clock.Now()
	}
	h.pushLobby(l)
	return nil, nil
}

func (h *Hub) kick(p *person, target string) (Msg, *Error) {
	l, err := h.hosted(p)
	if err != nil {
		return nil, err
	}
	if target == p.user.ID {
		return nil, errBad("Para sair do seu lobby, feche ou saia.")
	}
	if l.member(target) == nil {
		return nil, &Error{"not_found", "Essa pessoa não está no lobby."}
	}
	l.kicked[target] = true
	delete(l.allowed, target)
	h.removeMember(l, target)
	h.sendTo(target, Msg{"type": "kicked", "lobbyId": l.ID, "name": l.Name})
	return nil, nil
}

func (h *Hub) knock(p *person, id, message string) (Msg, *Error) {
	l := h.lobbies[id]
	if l == nil {
		return nil, errNotFound
	}
	uid := p.user.ID
	switch {
	case !l.Locked:
		return nil, errBad("Esse lobby é aberto: é só entrar.")
	case l.member(uid) != nil:
		return nil, nil
	case l.kicked[uid]:
		return nil, errKicked
	case l.allowed[uid]:
		p.knocks[l.ID] = "accepted"
		h.sendTo(uid, Msg{"type": "knock", "lobbyId": l.ID, "lobbyName": l.Name, "status": "accepted"})
		return nil, nil
	}
	if _, again := l.knocks[uid]; !again && len(l.knocks) >= MaxKnocks {
		return nil, errBusy
	}
	l.knocks[uid] = &knock{from: p.user, message: CleanText(message, MaxKnockLen), at: h.clock.Now()}
	p.knocks[l.ID] = "pending"
	h.sendTo(uid, Msg{"type": "knock", "lobbyId": l.ID, "lobbyName": l.Name, "status": "pending"})
	h.sendLobbyTo(l, l.HostID)
	return nil, nil
}

func (h *Hub) answerKnock(p *person, target string, accept bool) (Msg, *Error) {
	l, err := h.hosted(p)
	if err != nil {
		return nil, err
	}
	if l.knocks[target] == nil {
		return nil, &Error{"not_found", "Esse pedido não existe mais."}
	}
	delete(l.knocks, target)
	status := "declined"
	kp := h.people[target]
	if accept {
		status = "accepted"
		l.allowed[target] = true
		if kp != nil {
			kp.knocks[l.ID] = status
		}
	} else if kp != nil {
		delete(kp.knocks, l.ID)
	}
	h.sendTo(target, Msg{"type": "knock", "lobbyId": l.ID, "lobbyName": l.Name, "status": status})
	h.sendLobbyTo(l, l.HostID)
	return nil, nil
}

func (h *Hub) invite(p *person, target string) (Msg, *Error) {
	l := h.lobbies[p.lobbyID]
	if l == nil {
		return nil, &Error{"not_in_lobby", "Abra ou entre num lobby para chamar alguém."}
	}
	uid := p.user.ID
	isHost := l.HostID == uid
	switch {
	case target == uid || target == "":
		return nil, errBad("Convite inválido.")
	case !h.areFriends(uid, target):
		return nil, errNotFriend
	case l.Locked && !isHost:
		return nil, errNotHost
	case l.member(target) != nil:
		return nil, &Error{"already_in", "Essa pessoa já está no lobby."}
	case l.kicked[target] && !isHost:
		return nil, &Error{"kicked", "Essa pessoa foi removida desse lobby."}
	}
	tp := h.people[target]
	if tp == nil || tp.conns == 0 {
		return nil, errOffline
	}
	now := h.clock.Now()
	if last, ok := p.invited[target]; ok && now.Sub(last) < InviteCooldown {
		return nil, errCooldown
	}
	p.invited[target] = now
	delete(l.kicked, target)
	l.allowed[target] = true
	tp.invites[l.ID] = &invite{from: p.user, at: now}
	h.sendTo(target, Msg{"type": "invite", "invite": InviteView{uid, p.user.Name, l.ID, l.Name, ms(now)}})
	return nil, nil
}

func (h *Hub) setJoinCode(p *person, code string) (Msg, *Error) {
	l, err := h.hosted(p)
	if err != nil {
		return nil, err
	}
	if code != "" && !joinCodeRe.MatchString(code) {
		return nil, errBad("Código de entrada inválido.")
	}
	l.joinCode = code
	h.pushLobby(l)
	return nil, nil
}
