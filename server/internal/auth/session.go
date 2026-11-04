package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// KeySize is the length of the cookie signing key.
const KeySize = 32

// LoadOrCreateKey reads the signing key from path, or generates one and writes
// it there (owner-only) on first run. A file of the wrong size is an error,
// never overwritten.
func LoadOrCreateKey(path string) ([]byte, error) {
	key, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			return nil, fmt.Errorf("create key dir: %w", err)
		}
		key = make([]byte, KeySize)
		if _, err := rand.Read(key); err != nil {
			return nil, err
		}
		// O_EXCL: two servers starting together cannot overwrite each other.
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
		if errors.Is(err, os.ErrExist) {
			return LoadOrCreateKey(path)
		}
		if err != nil {
			return nil, fmt.Errorf("create key file: %w", err)
		}
		if _, err := f.Write(key); err != nil {
			_ = f.Close()
			return nil, fmt.Errorf("write key file: %w", err)
		}
		return key, f.Close()
	}
	if err != nil {
		return nil, fmt.Errorf("read key file: %w", err)
	}
	if len(key) != KeySize {
		return nil, fmt.Errorf("key file %s has %d bytes, want %d", path, len(key), KeySize)
	}
	return key, nil
}

// Signer authenticates cookie values with HMAC-SHA256. Each use has its own
// purpose string, so a value signed for one cookie is useless in another.
type Signer struct {
	key []byte
}

// NewSigner wraps a key from LoadOrCreateKey.
func NewSigner(key []byte) Signer { return Signer{key: key} }

var b64 = base64.RawURLEncoding

func (s Signer) mac(purpose, value string) []byte {
	m := hmac.New(sha256.New, s.key)
	m.Write([]byte(purpose))
	m.Write([]byte{0})
	m.Write([]byte(value))
	return m.Sum(nil)
}

// Sign returns base64url(value) "." base64url(mac), safe for a cookie.
func (s Signer) Sign(purpose, value string) string {
	return b64.EncodeToString([]byte(value)) + "." + b64.EncodeToString(s.mac(purpose, value))
}

// Verify returns the value of a token made by Sign with the same purpose.
func (s Signer) Verify(purpose, token string) (string, bool) {
	if len(token) > 1024 {
		return "", false
	}
	v64, m64, ok := strings.Cut(token, ".")
	if !ok {
		return "", false
	}
	value, err := b64.DecodeString(v64)
	if err != nil {
		return "", false
	}
	mac, err := b64.DecodeString(m64)
	if err != nil {
		return "", false
	}
	if !hmac.Equal(mac, s.mac(purpose, string(value))) {
		return "", false
	}
	return string(value), true
}

// RandomToken returns n random bytes, base64url.
func RandomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return b64.EncodeToString(b)
}

// LoginState is what the login cookie carries between /auth/steam/login and
// the callback: the state echoed in return_to and where to go afterwards.
type LoginState struct {
	State  string
	Return string
	// App is the PKCE challenge of a desktop-app sign-in; empty for a normal
	// browser sign-in.
	App     string
	Expires time.Time
}

const loginPurpose = "login-state"

// SealLogin signs a login state for the login cookie.
func (s Signer) SealLogin(l LoginState) string {
	return s.Sign(loginPurpose, l.State+"|"+strconv.FormatInt(l.Expires.Unix(), 10)+"|"+l.App+"|"+l.Return)
}

// OpenLogin checks and decodes a login cookie.
func (s Signer) OpenLogin(token string, now time.Time) (LoginState, bool) {
	v, ok := s.Verify(loginPurpose, token)
	if !ok {
		return LoginState{}, false
	}
	parts := strings.SplitN(v, "|", 4)
	if len(parts) != 4 {
		return LoginState{}, false
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || now.Unix() > exp {
		return LoginState{}, false
	}
	return LoginState{State: parts[0], App: parts[2], Return: parts[3], Expires: time.Unix(exp, 0)}, true
}

// SafeReturn accepts only a local path ("/sala/x?y"), never another origin.
func SafeReturn(p string) string {
	if p == "" || len(p) > 300 || p[0] != '/' || strings.HasPrefix(p, "//") || strings.ContainsAny(p, "\\\r\n\t") {
		return "/"
	}
	for _, r := range p {
		if r < 0x20 || r == 0x7f {
			return "/"
		}
	}
	return p
}
