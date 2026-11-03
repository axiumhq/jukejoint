// Package lobby is the server-authoritative lobby and room state: who sits
// where, who confirmed, the host's cancellable start countdown and the handoff
// phases. Clients only send intents; every transition is decided here.
//
// The server never launches the game. It holds the lobby state and hands the
// members what they need to host or join (the host's join code, filled later by
// the desktop app through the EngineAdapter).
package lobby

import (
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Phase is where a lobby is in its life.
type Phase string

const (
	// PhaseOpen: gathering players and confirmations.
	PhaseOpen Phase = "open"
	// PhaseCountdown: the host started; the match begins when the countdown ends
	// unless someone un-confirms, the host cancels or the quorum is lost.
	PhaseCountdown Phase = "countdown"
	// PhaseHandoff: the match started and the members' apps are getting the
	// game ready (download the mode, open the game, join the session).
	PhaseHandoff Phase = "handoff"
	// PhasePlaying: everyone is in the game.
	PhasePlaying Phase = "playing"
)

const (
	// StartCountdown is the host start countdown (HOST_START_MS in the web).
	StartCountdown = 5 * time.Second
	// ReconnectGrace keeps a disconnected member's seat this long.
	ReconnectGrace = 30 * time.Second
	// MaxLobbies caps how many lobbies can be open at once.
	MaxLobbies = 500
	// MaxNameLen and MaxKnockLen match the web inputs' maxLength.
	MaxNameLen  = 40
	MaxKnockLen = 80
	// MaxKnocks caps pending knocks per lobby.
	MaxKnocks = 20
	// InviteCooldown is how often one user may invite the same friend.
	InviteCooldown = 15 * time.Second
	maxJoins       = 6
)

// HandoffSteps is how long each handoff step lasts (HANDOFF_MS in the web).
// It stands in for the desktop app's events until the EngineAdapter reports
// real progress: download the mode, open the game, join the session.
var HandoffSteps = []time.Duration{900 * time.Millisecond, 1700 * time.Millisecond, 1500 * time.Millisecond}

// Mode is what the server needs to know about a game mode to validate a lobby.
type Mode struct {
	Min, Max int
}

// Modes mirrors web/src/data/modes.ts (slug, minPlayers, maxPlayers).
var Modes = map[string]Mode{
	"circulo-profano":  {6, 12},
	"ultimo-bonde":     {8, 12},
	"neblina":          {5, 10},
	"duelo-meia-noite": {2, 8},
	"cerco-ao-cofre":   {6, 10},
	"campo-de-treino":  {1, 6},
}

// Regions a lobby can be in.
var Regions = []string{"BR", "NA", "EU"}

// EstimatedPing is the ping the web shows until the app measures it: a player
// in São Paulo to a host in each region.
var EstimatedPing = map[string]int{"BR": 11, "NA": 124, "EU": 196}

// UserRef identifies a member by ID and display name.
type UserRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type member struct {
	user     UserRef
	ready    bool
	readyAt  time.Time
	joinedAt time.Time
}

type joinEvent struct {
	user UserRef
	at   time.Time
}

type knock struct {
	from    UserRef
	message string
	at      time.Time
}

// Lobby is one lobby and its room. Only the hub touches it, under its lock.
type Lobby struct {
	ID             string
	Name           string
	Mode           string
	Region         string
	Slots          int
	MinPlayers     int
	Locked         bool
	Beginners      bool
	JoinInProgress bool
	HostID         string
	OpenedAt       time.Time

	members       []*member
	phase         Phase
	countdownEnds time.Time
	handoffStep   int
	startedAt     time.Time
	fullSince     time.Time
	joins         []joinEvent
	joinCode      string
	allowed       map[string]bool
	kicked        map[string]bool
	knocks        map[string]*knock
	timer         Timer
	gen           int
}

func (l *Lobby) member(id string) *member {
	for _, m := range l.members {
		if m.user.ID == id {
			return m
		}
	}
	return nil
}

func (l *Lobby) players() int { return len(l.members) }

func (l *Lobby) readyCount() int {
	n := 0
	for _, m := range l.members {
		if m.ready || m.user.ID == l.HostID {
			n++
		}
	}
	return n
}

func (l *Lobby) inMatch() bool { return l.phase == PhaseHandoff || l.phase == PhasePlaying }

func (l *Lobby) status() string {
	switch {
	case l.inMatch():
		return "em-partida"
	case l.players() >= l.Slots:
		return "cheio"
	default:
		return "aberto"
	}
}

// hasRoom: a free seat and a match that takes people now (web lib/lobbies.ts).
func (l *Lobby) hasRoom() bool {
	if l.players() >= l.Slots {
		return false
	}
	return !l.inMatch() || l.JoinInProgress
}

func (l *Lobby) stopTimer() {
	l.gen++
	if l.timer != nil {
		l.timer.Stop()
		l.timer = nil
	}
}

/* ───────── Input ───────── */

// CreateLobby is the payload of the create intent (HostDraft in the web).
type CreateLobby struct {
	Name           string `json:"name"`
	ModeSlug       string `json:"modeSlug"`
	Region         string `json:"region"`
	Slots          int    `json:"slots"`
	MinPlayers     int    `json:"minPlayers"`
	Locked         bool   `json:"locked"`
	Beginners      bool   `json:"beginners"`
	JoinInProgress *bool  `json:"joinInProgress,omitempty"`
}

// CleanText trims, drops control and format characters (including bidi
// overrides) and caps the length in runes. It never returns invalid UTF-8.
func CleanText(s string, max int) string {
	if !utf8.ValidString(s) {
		s = strings.ToValidUTF8(s, "")
	}
	var b strings.Builder
	n := 0
	space := false
	for _, r := range strings.TrimSpace(s) {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) {
			continue
		}
		if unicode.IsSpace(r) {
			if space {
				continue
			}
			space = true
			r = ' '
		} else {
			space = false
		}
		if n >= max {
			break
		}
		b.WriteRune(r)
		n++
	}
	return strings.TrimSpace(b.String())
}

func (c CreateLobby) validate() (CreateLobby, *Error) {
	c.Name = CleanText(c.Name, MaxNameLen)
	if c.Name == "" {
		return c, errBad("Dê um nome ao lobby.")
	}
	mode, ok := Modes[c.ModeSlug]
	if !ok {
		return c, errBad("Modo desconhecido.")
	}
	if !validRegion(c.Region) {
		return c, errBad("Região inválida.")
	}
	if c.Slots < mode.Min || c.Slots > mode.Max {
		return c, errBad("Número de vagas fora do que o modo aceita.")
	}
	if c.MinPlayers < mode.Min || c.MinPlayers > c.Slots {
		return c, errBad("Mínimo para começar fora do que o modo aceita.")
	}
	return c, nil
}

func validRegion(r string) bool {
	for _, x := range Regions {
		if x == r {
			return true
		}
	}
	return false
}

var joinCodeRe = regexp.MustCompile(`^[A-Za-z0-9._:\-]{1,128}$`)

/* ───────── Views (what goes on the wire) ───────── */

// SeatView is one occupied seat.
type SeatView struct {
	UserID  string `json:"userId"`
	Name    string `json:"name"`
	Host    bool   `json:"host,omitempty"`
	Ready   bool   `json:"ready"`
	ReadyAt int64  `json:"readyAt,omitempty"`
}

// JoinView is a recent arrival ("entrou agora").
type JoinView struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	At     int64  `json:"at"`
}

// KnockView is a pending knock, shown to the host only.
type KnockView struct {
	UserID  string `json:"userId"`
	Name    string `json:"name"`
	Message string `json:"message,omitempty"`
	At      int64  `json:"at"`
}

// View is a lobby as one viewer sees it. A locked lobby hides its seats and
// arrivals from non-members (only the count is public); the join code goes to
// members only and the knocks to the host only.
type View struct {
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	ModeSlug       string      `json:"modeSlug"`
	Region         string      `json:"region"`
	HostID         string      `json:"hostId"`
	HostName       string      `json:"hostName"`
	Players        int         `json:"players"`
	Slots          int         `json:"slots"`
	MinPlayers     int         `json:"minPlayers"`
	Locked         bool        `json:"locked"`
	Beginners      bool        `json:"beginners"`
	JoinInProgress bool        `json:"joinInProgress"`
	Status         string      `json:"status"`
	Phase          Phase       `json:"phase"`
	CountdownMs    int64       `json:"countdownMs,omitempty"`
	HandoffStep    *int        `json:"handoffStep,omitempty"`
	OpenedAt       int64       `json:"openedAt"`
	StartedAt      int64       `json:"startedAt,omitempty"`
	FullSince      int64       `json:"fullSince,omitempty"`
	Seats          []SeatView  `json:"seats,omitempty"`
	Joins          []JoinView  `json:"joins,omitempty"`
	Hidden         bool        `json:"hidden,omitempty"`
	JoinCode       string      `json:"joinCode,omitempty"`
	Knocks         []KnockView `json:"knocks,omitempty"`
}

func ms(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.UnixMilli()
}

func (l *Lobby) view(viewer string, now time.Time) View {
	host := l.member(l.HostID)
	v := View{
		ID:             l.ID,
		Name:           l.Name,
		ModeSlug:       l.Mode,
		Region:         l.Region,
		HostID:         l.HostID,
		Players:        l.players(),
		Slots:          l.Slots,
		MinPlayers:     l.MinPlayers,
		Locked:         l.Locked,
		Beginners:      l.Beginners,
		JoinInProgress: l.JoinInProgress,
		Status:         l.status(),
		Phase:          l.phase,
		OpenedAt:       ms(l.OpenedAt),
		StartedAt:      ms(l.startedAt),
		FullSince:      ms(l.fullSince),
	}
	if host != nil {
		v.HostName = host.user.Name
	}
	if l.phase == PhaseCountdown {
		v.CountdownMs = max(0, l.countdownEnds.Sub(now).Milliseconds())
	}
	if l.inMatch() {
		step := l.handoffStep
		v.HandoffStep = &step
	}
	isMember := viewer != "" && l.member(viewer) != nil
	if l.Locked && !isMember {
		v.Hidden = true
		return v
	}
	for _, m := range l.members {
		host := m.user.ID == l.HostID
		v.Seats = append(v.Seats, SeatView{UserID: m.user.ID, Name: m.user.Name, Host: host, Ready: m.ready || host || l.inMatch(), ReadyAt: ms(m.readyAt)})
	}
	for _, j := range l.joins {
		v.Joins = append(v.Joins, JoinView{UserID: j.user.ID, Name: j.user.Name, At: ms(j.at)})
	}
	if isMember {
		v.JoinCode = l.joinCode
	}
	if viewer != "" && viewer == l.HostID {
		for _, k := range l.knocks {
			v.Knocks = append(v.Knocks, KnockView{UserID: k.from.ID, Name: k.from.Name, Message: k.message, At: ms(k.at)})
		}
		sort.Slice(v.Knocks, func(i, j int) bool { return v.Knocks[i].At < v.Knocks[j].At })
	}
	return v
}

/* ───────── Filters (the same rules as web/src/lib/lobbies.ts) ───────── */

// LowPingMs is the "Ping < 30" chip.
const LowPingMs = 30

// Filter is the lobby list query. The query string uses the same names as the
// web URL: q, modo, regiao (comma separated), vagas, amigos, iniciantes,
// partida, ping=30 and ordem.
type Filter struct {
	Q           string
	Mode        string
	Regions     []string
	SlotsOnly   bool
	FriendsOnly bool
	Beginners   bool
	Playing     bool
	LowPing     bool
	Sort        string
}

func (f Filter) match(l *Lobby, hasFriends func(*Lobby) bool) bool {
	if f.Mode != "" && l.Mode != f.Mode {
		return false
	}
	if len(f.Regions) > 0 {
		ok := false
		for _, r := range f.Regions {
			ok = ok || r == l.Region
		}
		if !ok {
			return false
		}
	}
	if f.SlotsOnly && !l.hasRoom() {
		return false
	}
	if f.FriendsOnly && hasFriends != nil && !hasFriends(l) {
		return false
	}
	if f.Beginners && !l.Beginners {
		return false
	}
	if f.Playing && !l.inMatch() {
		return false
	}
	if f.LowPing && EstimatedPing[l.Region] >= LowPingMs {
		return false
	}
	if q := strings.ToLower(strings.TrimSpace(f.Q)); q != "" {
		host := ""
		if m := l.member(l.HostID); m != nil {
			host = m.user.Name
		}
		if !strings.Contains(strings.ToLower(l.Name+" "+host), q) {
			return false
		}
	}
	return true
}

func sortLobbies(list []*Lobby, key string) {
	joinable := func(l *Lobby) int {
		if l.hasRoom() && !l.Locked {
			return 0
		}
		if l.Locked && l.hasRoom() {
			return 1
		}
		return 2
	}
	sort.SliceStable(list, func(i, j int) bool {
		a, b := list[i], list[j]
		switch key {
		case "ping":
			return EstimatedPing[a.Region] < EstimatedPing[b.Region]
		case "vagas":
			return a.Slots-a.players() > b.Slots-b.players()
		case "recentes":
			return a.OpenedAt.After(b.OpenedAt)
		default: // ativos
			if joinable(a) != joinable(b) {
				return joinable(a) < joinable(b)
			}
			if a.players() != b.players() {
				return a.players() > b.players()
			}
			return EstimatedPing[a.Region] < EstimatedPing[b.Region]
		}
	})
}
