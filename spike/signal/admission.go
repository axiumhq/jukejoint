package main

import (
	"errors"
	"math"
	"time"

	"golang.org/x/time/rate"
)

// admission bounds work and open sockets without trusting forwarded IP headers
// or allocating state for attacker-supplied peer IDs.
type admission struct {
	tickets *rate.Limiter
	sockets *rate.Limiter
	open    chan struct{}
	now     func() time.Time
}

type admissionConfig struct {
	ticketRate  float64
	ticketBurst int
	socketRate  float64
	socketBurst int
	maxSockets  int
}

func (c admissionConfig) validate() error {
	if c.ticketRate <= 0 || math.IsNaN(c.ticketRate) || math.IsInf(c.ticketRate, 0) ||
		c.ticketBurst < 1 || c.socketRate <= 0 || math.IsNaN(c.socketRate) || math.IsInf(c.socketRate, 0) ||
		c.socketBurst < 1 || c.maxSockets < 1 {
		return errors.New("admission rates must be finite and positive; bursts and socket limit must be positive")
	}
	return nil
}

func newAdmission(config admissionConfig, now func() time.Time) *admission {
	return &admission{
		tickets: rate.NewLimiter(rate.Limit(config.ticketRate), config.ticketBurst),
		sockets: rate.NewLimiter(rate.Limit(config.socketRate), config.socketBurst),
		open:    make(chan struct{}, config.maxSockets),
		now:     now,
	}
}

func (a *admission) allowTicket() bool { return a.tickets.AllowN(a.now(), 1) }

func (a *admission) allowSocket() bool { return a.sockets.AllowN(a.now(), 1) }

func (a *admission) acquire() bool {
	select {
	case a.open <- struct{}{}:
		return true
	default:
		return false
	}
}

func (a *admission) release() { <-a.open }
