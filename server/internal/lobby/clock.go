package lobby

import "time"

// Timer is a scheduled callback that can be cancelled.
type Timer interface {
	Stop() bool
}

// Clock is the hub's source of time. Tests use a fake one to drive the
// countdown and the handoff without sleeping.
type Clock interface {
	Now() time.Time
	AfterFunc(d time.Duration, f func()) Timer
}

// RealClock is the wall clock.
type RealClock struct{}

func (RealClock) Now() time.Time { return time.Now() }

func (RealClock) AfterFunc(d time.Duration, f func()) Timer { return time.AfterFunc(d, f) }
