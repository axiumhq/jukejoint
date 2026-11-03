package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"time"
)

// SteamAPI calls the Steam Web API. It is only used when STEAM_API_KEY is set.
type SteamAPI struct {
	Key    string
	Base   string // https://api.steampowered.com (a mock in tests)
	Client *http.Client
}

var steamIDRe = regexp.MustCompile(`^7656119[0-9]{10}$`)

// Profile is the public part of a Steam profile we show.
type Profile struct {
	Name   string
	Avatar string
}

// get fetches a JSON document. Errors never carry the URL, which has the key.
func (a *SteamAPI) get(ctx context.Context, path string, q url.Values, out any) error {
	q.Set("key", a.Key)
	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.Base+path+"?"+q.Encode(), nil)
	if err != nil {
		return errors.New("steam api: bad request")
	}
	client := a.Client
	if client == nil {
		client = http.DefaultClient
	}
	res, err := client.Do(req)
	if err != nil {
		var ue *url.Error
		if errors.As(err, &ue) {
			err = ue.Err // drop the URL (and the key in it)
		}
		return fmt.Errorf("steam api %s: %w", path, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("steam api %s: status %d", path, res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out)
}

// Summary returns the persona name and avatar of a SteamID64.
func (a *SteamAPI) Summary(ctx context.Context, steamID string) (Profile, error) {
	var out struct {
		Response struct {
			Players []struct {
				SteamID     string `json:"steamid"`
				PersonaName string `json:"personaname"`
				AvatarFull  string `json:"avatarfull"`
			} `json:"players"`
		} `json:"response"`
	}
	if err := a.get(ctx, "/ISteamUser/GetPlayerSummaries/v2/", url.Values{"steamids": {steamID}}, &out); err != nil {
		return Profile{}, err
	}
	for _, p := range out.Response.Players {
		if p.SteamID == steamID {
			avatar := p.AvatarFull
			if u, err := url.Parse(avatar); err != nil || u.Scheme != "https" {
				avatar = ""
			}
			return Profile{Name: p.PersonaName, Avatar: avatar}, nil
		}
	}
	return Profile{}, errors.New("steam api: player not found")
}

// Friends returns the SteamID64s on a user's friend list. A private list is
// an error from Steam (401); callers treat it as "no friends known".
func (a *SteamAPI) Friends(ctx context.Context, steamID string) ([]string, error) {
	var out struct {
		FriendsList struct {
			Friends []struct {
				SteamID string `json:"steamid"`
			} `json:"friends"`
		} `json:"friendslist"`
	}
	if err := a.get(ctx, "/ISteamUser/GetFriendList/v1/", url.Values{"steamid": {steamID}, "relationship": {"friend"}}, &out); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(out.FriendsList.Friends))
	for _, f := range out.FriendsList.Friends {
		if steamIDRe.MatchString(f.SteamID) {
			ids = append(ids, f.SteamID)
		}
	}
	return ids, nil
}
