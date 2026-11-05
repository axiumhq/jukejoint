package lobby

import "testing"

// connectWithAvatar is env.connect with a Steam avatar on the user.
func (e *env) connectWithAvatar(id, avatar string) *fakeClient {
	c := &fakeClient{id: id}
	e.hub.Connect(c, &UserRef{ID: id, Name: "Nome " + id, Avatar: avatar})
	return c
}

func TestAvatarReachesSeatsAndFriends(t *testing.T) {
	e := newEnv(t, friendSet{"a|b": true})
	a := e.connectWithAvatar("a", "https://avatars.steamstatic.com/a_full.jpg")
	b := e.connectWithAvatar("b", "https://avatars.steamstatic.com/b_full.jpg")

	id := e.create("a", CreateLobby{})
	e.do("b", Intent{Type: "join", LobbyID: id})

	v := b.view(t, id)
	got := map[string]string{}
	for _, s := range v.Seats {
		got[s.UserID] = s.Avatar
	}
	if got["a"] != "https://avatars.steamstatic.com/a_full.jpg" || got["b"] != "https://avatars.steamstatic.com/b_full.jpg" {
		t.Fatalf("seat avatars: %+v", v.Seats)
	}

	friends, _ := a.last("friends")["friends"].([]FriendView)
	if len(friends) != 1 || friends[0].ID != "b" || friends[0].Avatar != "https://avatars.steamstatic.com/b_full.jpg" {
		t.Fatalf("friend view avatar: %+v", friends)
	}
}

func TestAvatarHiddenInLockedLobbyFromOutside(t *testing.T) {
	e := newEnv(t, nil)
	e.connectWithAvatar("a", "https://avatars.steamstatic.com/a_full.jpg")
	out := e.connectWithAvatar("c", "")

	id := e.create("a", CreateLobby{Locked: true})
	v := out.view(t, id)
	if !v.Hidden || len(v.Seats) != 0 {
		t.Fatalf("outsider must not see seats (or avatars) of a locked lobby: %+v", v)
	}
}
