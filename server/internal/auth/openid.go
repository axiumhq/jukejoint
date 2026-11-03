// Package auth is the Steam sign-in (OpenID 2.0), the signed session cookie
// and the optional Steam Web API calls for name, avatar and friends.
package auth

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	// SteamOpenID is Steam's OpenID 2.0 provider endpoint.
	SteamOpenID = "https://steamcommunity.com/openid/login"
	openIDNS    = "http://specs.openid.net/auth/2.0"
	identSelect = "http://specs.openid.net/auth/2.0/identifier_select"
	// NonceSkew is how far a response nonce's timestamp may be from our clock.
	NonceSkew = 5 * time.Minute
	// maxField caps every openid.* value we accept.
	maxField = 512
)

// claimedRe is the only claimed_id format accepted: Steam's, with a SteamID64
// of an individual account (they all start with 7656119).
var claimedRe = regexp.MustCompile(`^https://steamcommunity\.com/openid/id/(7656119[0-9]{10})$`)

var nonceRe = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)[\x21-\x7e]{0,200}$`)

// Fields every positive assertion must have signed.
var mustSign = []string{"op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"}

// ErrCancelled is returned when the user cancelled on Steam's page.
var ErrCancelled = errors.New("openid: sign-in cancelled")

// NonceStore remembers used response nonces (store.Store satisfies it).
type NonceStore interface {
	UseNonce(ctx context.Context, nonce string, until time.Time) (bool, error)
}

// Steam signs users in with Steam's OpenID 2.0 provider.
type Steam struct {
	// Endpoint is the provider (SteamOpenID; a mock in tests).
	Endpoint string
	// Realm is our public origin, e.g. https://example.com.
	Realm string
	// Callback is the absolute callback URL, under Realm.
	Callback string
	Client   *http.Client
	Nonces   NonceStore
	Now      func() time.Time
}

// ReturnTo is the return_to sent to Steam for a login state.
func (s *Steam) ReturnTo(state string) string {
	return s.Callback + "?s=" + url.QueryEscape(state)
}

// LoginURL is where the browser goes to sign in.
func (s *Steam) LoginURL(state string) string {
	q := url.Values{
		"openid.ns":         {openIDNS},
		"openid.mode":       {"checkid_setup"},
		"openid.return_to":  {s.ReturnTo(state)},
		"openid.realm":      {s.Realm},
		"openid.identity":   {identSelect},
		"openid.claimed_id": {identSelect},
	}
	return s.Endpoint + "?" + q.Encode()
}

// Verify checks a callback's query (strictly, field by field) and then asks
// Steam to confirm the signature with check_authentication. It returns the
// SteamID64. state is the login state from our own cookie.
func (s *Steam) Verify(ctx context.Context, q url.Values, state string) (string, error) {
	get := func(k string) string { return q.Get("openid." + k) }
	for k, vs := range q {
		if !strings.HasPrefix(k, "openid.") {
			continue
		}
		if len(vs) != 1 {
			return "", fmt.Errorf("openid: %s repeated", k)
		}
		if len(vs[0]) > maxField {
			return "", fmt.Errorf("openid: %s too long", k)
		}
	}
	if get("mode") == "cancel" {
		return "", ErrCancelled
	}
	if get("mode") != "id_res" {
		return "", fmt.Errorf("openid: mode %q", get("mode"))
	}
	if get("ns") != openIDNS {
		return "", errors.New("openid: wrong ns")
	}
	if get("op_endpoint") != s.Endpoint {
		return "", errors.New("openid: wrong op_endpoint")
	}
	if state == "" || get("return_to") != s.ReturnTo(state) || q.Get("s") != state {
		return "", errors.New("openid: return_to does not match this login")
	}
	claimed := get("claimed_id")
	m := claimedRe.FindStringSubmatch(claimed)
	if m == nil || get("identity") != claimed {
		return "", errors.New("openid: claimed_id is not a Steam ID")
	}
	steamID := m[1]
	nonce := get("response_nonce")
	nm := nonceRe.FindStringSubmatch(nonce)
	if nm == nil {
		return "", errors.New("openid: bad response_nonce")
	}
	at, err := time.Parse(time.RFC3339, nm[1])
	if err != nil {
		return "", errors.New("openid: bad response_nonce time")
	}
	now := s.Now()
	if d := now.Sub(at); d > NonceSkew || d < -NonceSkew {
		return "", errors.New("openid: response_nonce outside the time window")
	}
	if get("assoc_handle") == "" || get("sig") == "" {
		return "", errors.New("openid: unsigned response")
	}
	signed := map[string]bool{}
	for _, f := range strings.Split(get("signed"), ",") {
		signed[f] = true
	}
	for _, f := range mustSign {
		if !signed[f] {
			return "", fmt.Errorf("openid: %s not signed", f)
		}
	}
	// Spend the nonce before asking Steam, so two copies of one response
	// racing each other cannot both get through.
	fresh, err := s.Nonces.UseNonce(ctx, s.Endpoint+"|"+nonce, at.Add(2*NonceSkew))
	if err != nil {
		return "", err
	}
	if !fresh {
		return "", errors.New("openid: response_nonce replayed")
	}
	if err := s.checkAuthentication(ctx, q); err != nil {
		return "", err
	}
	return steamID, nil
}

func (s *Steam) checkAuthentication(ctx context.Context, q url.Values) error {
	form := url.Values{}
	for k, vs := range q {
		if strings.HasPrefix(k, "openid.") {
			form[k] = vs
		}
	}
	form.Set("openid.mode", "check_authentication")
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.Endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := s.Client
	if client == nil {
		client = http.DefaultClient
	}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("openid: check_authentication: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("openid: check_authentication status %d", res.StatusCode)
	}
	kv := map[string]string{}
	sc := bufio.NewScanner(io.LimitReader(res.Body, 4096))
	for sc.Scan() {
		k, v, ok := strings.Cut(sc.Text(), ":")
		if ok {
			kv[k] = strings.TrimSpace(v)
		}
	}
	if kv["ns"] != openIDNS || kv["is_valid"] != "true" {
		return errors.New("openid: Steam did not confirm the signature")
	}
	return nil
}
