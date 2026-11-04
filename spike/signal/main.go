// Command signal is the spike's signaling origin for Modlock peers: the two
// endpoints a daemon started with `modlock daemon --origin` calls to find other
// PCs. It relays WebRTC offers between peers by ID and never sees a session or
// its secret.
//
// A ticket request is verified: X-Signature must be the Ed25519 signature of the
// peer's key (carried inside its peer ID) over the request. The ticket it returns
// is an opaque, expiring token (peer ID and expiry, authenticated with an HMAC),
// and the ws endpoint derives the peer from that token alone.
package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"flag"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	websocket "github.com/aperturerobotics/go-websocket"
	"github.com/aperturerobotics/starpc/srpc"
	"github.com/pkg/errors"
	api "github.com/s4wave/spacewave/core/provider/spacewave/api"
	"github.com/s4wave/spacewave/net/crypto"
	"github.com/s4wave/spacewave/net/peer"
	signaling_rpc "github.com/s4wave/spacewave/net/signaling/rpc"
	signaling_rpc_frame "github.com/s4wave/spacewave/net/signaling/rpc/frame"
	signaling_server "github.com/s4wave/spacewave/net/signaling/rpc/server"
	"github.com/sirupsen/logrus"
)

// maxTimestampSkew is how far a signed request's clock may be from ours.
const maxTimestampSkew = 5 * time.Minute

// maxTicketBody caps the body read for hashing; a ticket request has none.
const maxTicketBody = 64 << 10

// ticketTTL is how long a ticket can open a signaling socket. The client asks
// for a fresh ticket on every (re)connect, so a short life costs nothing.
const ticketTTL = 10 * time.Minute

// secretSize is the length in bytes of the key that authenticates tickets.
const secretSize = 32

var defaultAdmission = admissionConfig{
	ticketRate: 50, ticketBurst: 100,
	socketRate: 50, socketBurst: 100,
	maxSockets: 256,
}

// peerKey keys the caller's peer ID in a signaling stream's context.
type peerKey struct{}

func main() {
	addr := flag.String("addr", ":8080", "address to serve on")
	// Modlock v0.1.68 hardcodes "hyperline" as the prefix it signs requests with.
	env := flag.String("env", "hyperline", "env prefix the clients sign requests with")
	secretFile := flag.String("secret-file", "", "file holding the ticket HMAC key, created if missing (empty: random key per run)")
	health := flag.Bool("healthcheck", false, "ask the /healthz of a server on -addr over loopback and exit (for container health checks)")
	ticketRate := flag.Float64("ticket-rate", defaultAdmission.ticketRate, "maximum ticket requests per second")
	ticketBurst := flag.Int("ticket-burst", defaultAdmission.ticketBurst, "maximum ticket request burst")
	socketRate := flag.Float64("socket-rate", defaultAdmission.socketRate, "maximum WebSocket opens per second")
	socketBurst := flag.Int("socket-burst", defaultAdmission.socketBurst, "maximum WebSocket open burst")
	maxSockets := flag.Int("max-sockets", defaultAdmission.maxSockets, "maximum simultaneous signaling WebSockets")
	flag.Parse()

	if *health {
		if err := healthcheck(*addr); err != nil {
			log.Fatalf("unhealthy: %v", err)
		}
		return
	}
	limits := admissionConfig{
		ticketRate: *ticketRate, ticketBurst: *ticketBurst,
		socketRate: *socketRate, socketBurst: *socketBurst,
		maxSockets: *maxSockets,
	}
	if err := limits.validate(); err != nil {
		log.Fatalf("invalid admission limits: %v", err)
	}

	// Load the ticket key, or make one that dies with this process.
	var secret []byte
	var err error
	if *secretFile != "" {
		secret, err = loadOrCreateSecret(*secretFile)
	} else {
		secret, err = newSecret()
		log.Print("no -secret-file: using a random in-memory ticket key, tickets will not survive a restart")
	}
	if err != nil {
		log.Fatal(err)
	}

	handler, err := newHandlerWithLimits(logrus.NewEntry(logrus.StandardLogger()), *env, secret, time.Now, newAdmission(limits, time.Now))
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("signaling on %s (tickets %.1f/s burst %d; sockets %.1f/s burst %d; max open %d)",
		*addr, limits.ticketRate, limits.ticketBurst, limits.socketRate, limits.socketBurst, limits.maxSockets)
	server := &http.Server{
		Addr: *addr, Handler: handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		IdleTimeout:       90 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	log.Fatal(server.ListenAndServe())
}

// healthcheck GETs /healthz on the port addr listens on, over loopback. The
// container image has no shell or curl, so the binary checks itself.
func healthcheck(addr string) error {
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return errors.Wrapf(err, "bad -addr %q", addr)
	}
	c := &http.Client{Timeout: 3 * time.Second}
	res, err := c.Get("http://" + net.JoinHostPort("127.0.0.1", port) + "/healthz")
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1<<10))
	if res.StatusCode != http.StatusOK {
		return errors.Errorf("healthz answered %d", res.StatusCode)
	}
	return nil
}

// newSecret returns secretSize random bytes.
func newSecret() ([]byte, error) {
	secret := make([]byte, secretSize)
	if _, err := rand.Read(secret); err != nil {
		return nil, errors.Wrap(err, "generate ticket secret")
	}
	return secret, nil
}

// loadOrCreateSecret reads the ticket key from path. If the file does not exist
// it makes a new key and writes it there, readable by the owner only. A file of
// the wrong size is an error rather than being overwritten.
func loadOrCreateSecret(path string) ([]byte, error) {
	secret, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		if secret, err = newSecret(); err != nil {
			return nil, err
		}
		// O_EXCL so two servers starting together cannot overwrite each other's key.
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
		if errors.Is(err, os.ErrExist) {
			return loadOrCreateSecret(path)
		}
		if err != nil {
			return nil, errors.Wrap(err, "create secret file")
		}
		if _, err := f.Write(secret); err != nil {
			_ = f.Close()
			return nil, errors.Wrap(err, "write secret file")
		}
		if err := f.Close(); err != nil {
			return nil, errors.Wrap(err, "write secret file")
		}
		return secret, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, "read secret file")
	}
	if len(secret) != secretSize {
		return nil, errors.Errorf("secret file %s holds %d bytes, want %d", path, len(secret), secretSize)
	}
	return secret, nil
}

// ticketMAC returns the HMAC-SHA256 of msg under secret.
func ticketMAC(secret, msg []byte) []byte {
	m := hmac.New(sha256.New, secret)
	m.Write(msg)
	return m.Sum(nil)
}

// issueTicket returns an opaque token for pid that is good until now+ticketTTL:
// base64url(peer ID bytes || expiry as 8 byte big-endian unix ms), a dot, then
// base64url of the HMAC-SHA256 of that message. Only characters safe in a URL.
func issueTicket(secret []byte, pid peer.ID, now time.Time) string {
	msg := binary.BigEndian.AppendUint64([]byte(pid), uint64(now.Add(ticketTTL).UnixMilli()))
	enc := base64.RawURLEncoding
	return enc.EncodeToString(msg) + "." + enc.EncodeToString(ticketMAC(secret, msg))
}

// verifyTicket checks a token made by issueTicket and returns the peer it was
// issued to. The MAC is compared in constant time and checked before anything
// in the message is trusted. When the MAC is good but the ticket is expired, the
// peer is returned along with the error so the caller can log it.
func verifyTicket(secret []byte, token string, now time.Time) (peer.ID, error) {
	// Split the token and decode both halves.
	msgPart, macPart, ok := strings.Cut(token, ".")
	if !ok {
		return "", errors.New("malformed ticket")
	}
	enc := base64.RawURLEncoding
	msg, err := enc.DecodeString(msgPart)
	if err != nil {
		return "", errors.New("malformed ticket")
	}
	mac, err := enc.DecodeString(macPart)
	if err != nil {
		return "", errors.New("malformed ticket")
	}

	// Authenticate before parsing: hmac.Equal compares in constant time.
	if !hmac.Equal(mac, ticketMAC(secret, msg)) {
		return "", errors.New("ticket signature does not verify")
	}

	// Split the peer ID from the trailing expiry.
	if len(msg) <= 8 {
		return "", errors.New("malformed ticket")
	}
	pid, err := peer.IDFromBytes(msg[:len(msg)-8])
	if err != nil {
		return "", errors.Wrap(err, "ticket has bad peer id")
	}
	expiry := time.UnixMilli(int64(binary.BigEndian.Uint64(msg[len(msg)-8:])))
	if !now.Before(expiry) {
		return pid, errors.Errorf("ticket expired %s ago", now.Sub(expiry).Round(time.Second))
	}
	return pid, nil
}

// verifyTicketRequest checks that r was signed by the peer it claims to come
// from and returns that peer's ID. It rebuilds the SigningPayload the client
// signs (see core/transport.SignHTTPRequest in Spacewave) and verifies the
// Ed25519 signature with the public key embedded in the peer ID. The claimed ID
// is returned even on failure, when it parsed, so the caller can log it.
func verifyTicketRequest(r *http.Request, w http.ResponseWriter, envPrefix string, now time.Time) (peer.ID, error) {
	// Decode the claimed peer ID and the public key it embeds.
	pid, err := peer.IDB58Decode(r.Header.Get("X-Peer-ID"))
	if err != nil || pid == "" {
		return "", errors.New("bad peer id")
	}
	pub, err := pid.ExtractPublicKey()
	if err != nil {
		return pid, errors.Wrap(err, "peer id has no public key")
	}
	if pub.Type() != crypto.KeyType_Ed25519 {
		return pid, errors.New("peer key is not ed25519")
	}

	// Parse the signed headers and bound the timestamp to a window around now.
	tsMs, err := strconv.ParseInt(r.Header.Get("X-Timestamp"), 10, 64)
	if err != nil {
		return pid, errors.New("bad timestamp")
	}
	skew := now.Sub(time.UnixMilli(tsMs))
	if skew < -maxTimestampSkew || skew > maxTimestampSkew {
		return pid, errors.Errorf("timestamp out of range (skew %s)", skew.Round(time.Second))
	}
	sig, err := base64.StdEncoding.DecodeString(r.Header.Get("X-Signature"))
	if err != nil || len(sig) == 0 {
		return pid, errors.New("bad signature encoding")
	}

	// Hash the body ourselves and require it matches the hash the client claims.
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxTicketBody))
	if err != nil {
		return pid, errors.Wrap(err, "read body")
	}
	h := sha256.Sum256(body)
	bodyHash := hex.EncodeToString(h[:])
	if r.Header.Get("X-Sw-Hash") != bodyHash {
		return pid, errors.New("body hash mismatch")
	}

	// Rebuild the payload exactly as the client does and verify its signature.
	payload, err := (&api.SigningPayload{
		EnvPrefix:     envPrefix,
		Method:        r.Method,
		Path:          r.URL.Path,
		TimestampMs:   tsMs,
		ContentLength: int64(len(body)),
		BodyHashHex:   bodyHash,
	}).MarshalVT()
	if err != nil {
		return pid, errors.Wrap(err, "marshal signing payload")
	}
	ok, err := pub.Verify(payload, sig)
	if err != nil || !ok {
		return pid, errors.New("signature does not verify")
	}
	return pid, nil
}

// newHandler serves the ticket and signaling endpoints over one shared relay.
// Ticket requests must be signed with envPrefix; now is the clock used to check
// their timestamps and ticket expiries. Tickets are authenticated with secret.
func newHandler(le *logrus.Entry, envPrefix string, secret []byte, now func() time.Time) (http.Handler, error) {
	return newHandlerWithLimits(le, envPrefix, secret, now, newAdmission(defaultAdmission, now))
}

func newHandlerWithLimits(le *logrus.Entry, envPrefix string, secret []byte, now func() time.Time, admission *admission) (http.Handler, error) {
	// Relay signaling between the peers identified by their tickets.
	relay := signaling_server.NewServerWithIdentify(le, func(ctx context.Context) (peer.ID, error) {
		pid, ok := ctx.Value(peerKey{}).(peer.ID)
		if !ok {
			return "", errors.New("signaling caller has no ticket")
		}
		return pid, nil
	})
	mux := srpc.NewMux()
	if err := signaling_rpc.SRPCRegisterSignaling(mux, relay); err != nil {
		return nil, err
	}

	routes := http.NewServeMux()

	// Issue each verified peer an opaque, expiring ticket for the ws endpoint.
	// Never answer 401 here: the pinned client gives up on its peer for good
	// after one, so invalid signatures get a 403. Overload is retryable.
	routes.HandleFunc("POST /api/signal/ticket", func(w http.ResponseWriter, r *http.Request) {
		if !admission.allowTicket() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		pid, err := verifyTicketRequest(r, w, envPrefix, now())
		if err != nil {
			peerField := pid.String()
			if pid == "" {
				// Not a valid ID: log what was sent, capped to keep logs small.
				peerField = r.Header.Get("X-Peer-ID")
				if len(peerField) > 128 {
					peerField = peerField[:128]
				}
			}
			le.WithField("peer", peerField).WithError(err).Warn("ticket refused")
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		data, err := (&api.SignalTicketResponse{Token: issueTicket(secret, pid, now())}).MarshalVT()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		le.WithField("peer", pid.String()).Info("ticket issued")
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(data)
	})

	// Serve signaling calls over the WebSocket of the ticket's peer. The peer is
	// whoever the ticket was issued to; a bad, forged or expired ticket gets a 403
	// before the upgrade (the client treats any dial failure as retryable, and a
	// 401 is avoided here for the same reason as above). The expiry only gates
	// opening the socket: one already open stays open.
	routes.HandleFunc("GET /api/signal/ws", func(w http.ResponseWriter, r *http.Request) {
		if !admission.allowSocket() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		pid, err := verifyTicket(secret, r.URL.Query().Get("tk"), now())
		if err != nil {
			// Log the peer when the ticket was genuine, never the ticket itself.
			le.WithField("peer", pid.String()).WithError(err).Warn("signaling refused")
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if !admission.acquire() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		defer admission.release()
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer conn.CloseNow()

		pl := le.WithField("peer", pid.String())
		pl.Info("signaling connected")
		defer pl.Info("signaling disconnected")
		ctx := context.WithValue(r.Context(), peerKey{}, pid)
		_ = signaling_rpc_frame.NewConn(ctx, conn).ReadPump(signaling_rpc_frame.NewServerAccept(ctx, mux))
	})

	// Answer a plain check that the origin is up.
	routes.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok\n"))
	})
	return routes, nil
}
