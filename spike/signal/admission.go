package main

import (
	"time"

	"golang.org/x/time/rate"
)

// admission bounds work and open sockets without trusting forwarded IP headers
// or allocating state for attacker-supplied peer IDs.
type admission struct {
	requests *rate.Limiter
	now      func() time.Time
	sockets  chan struct{}
}

func newAdmission(perSecond float64, burst, sockets int, now func() time.Time) *admission {
	return &admission{requests: rate.NewLimiter(rate.Limit(perSecond), burst), now: now, sockets: make(chan struct{}, sockets)}
}

func (a *admission) allowRequest() bool { return a.requests.AllowN(a.now(), 1) }

func (a *admission) acquire() bool {
	select {
	case a.sockets <- struct{}{}:
		return true
	default:
		return false
	}
}

func (a *admission) release() { <-a.sockets }
