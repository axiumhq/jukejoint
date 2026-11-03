package httpapi

import (
	"sync"
	"time"
)

// limiter is a token bucket per key (a user ID or a client IP).
type limiter struct {
	mu    sync.Mutex
	rate  float64 // tokens per second
	burst float64
	now   func() time.Time
	m     map[string]*bucket
}

type bucket struct {
	tokens float64
	last   time.Time
}

const maxBuckets = 20_000

func newLimiter(rate, burst float64, now func() time.Time) *limiter {
	return &limiter{rate: rate, burst: burst, now: now, m: map[string]*bucket{}}
}

// allow spends one token for key, or reports false when none is left.
func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	b := l.m[key]
	if b == nil {
		if len(l.m) >= maxBuckets {
			l.prune(now)
		}
		b = &bucket{tokens: l.burst, last: now}
		l.m[key] = b
	}
	b.tokens = min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// prune drops buckets that have refilled (they carry no information).
func (l *limiter) prune(now time.Time) {
	for k, b := range l.m {
		if b.tokens+now.Sub(b.last).Seconds()*l.rate >= l.burst {
			delete(l.m, k)
		}
	}
}
