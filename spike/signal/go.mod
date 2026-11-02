module spike/signal

go 1.27.3

// Same forks and pins as Modlock v0.1.68 (its go.mod), so the wire protocol matches.
replace (
	github.com/cloudflare/circl => github.com/aperturerobotics/circl v1.6.4-0.20261026102657-7415ab3046b7
	github.com/pion/ice/v4 => github.com/aperturerobotics/pion-ice/v4 v4.0.0-20260923005200-d591ff5895c0
	github.com/pion/webrtc/v4 => github.com/aperturerobotics/pion-webrtc/v4 v4.2.16-0.20260922235615-c5c6104de130
	github.com/sirupsen/logrus => github.com/aperturerobotics/logrus v1.10.2-0.20260922042813-73f013325281
)

require (
	github.com/aperturerobotics/go-websocket v1.8.15-0.20261024221652-c1205734f50c
	github.com/aperturerobotics/starpc v0.52.4-0.20261024233818-0a9074172c29
	github.com/pkg/errors v0.9.1
	github.com/s4wave/spacewave v0.57.30-0.20261030224300-6194652207f2
	github.com/sirupsen/logrus v1.10.2
)

require (
	filippo.io/edwards25519 v1.2.0 // indirect
	github.com/ProtonMail/go-crypto v1.5.2 // indirect
	github.com/aperturerobotics/common v0.36.5 // indirect
	github.com/aperturerobotics/controllerbus v0.53.6-0.20261027053904-dd1f04e29852 // indirect
	github.com/aperturerobotics/fastjson v0.1.2-0.20261024220211-b654d1d5b5aa // indirect
	github.com/aperturerobotics/go-multiaddr v0.17.1-0.20260514224402-c193991c3ce5 // indirect
	github.com/aperturerobotics/go-multibase v0.4.0 // indirect
	github.com/aperturerobotics/json-iterator-lite v1.1.0 // indirect
	github.com/aperturerobotics/protobuf-go-lite v0.19.1-0.20261028131920-f644656fc4a7 // indirect
	github.com/aperturerobotics/util v1.34.10-0.20261024231407-c6b31c4e4ea6 // indirect
	github.com/bwesterb/go-ristretto v1.2.4 // indirect
	github.com/cloudflare/circl v1.6.5 // indirect
	github.com/ghodss/yaml v1.0.0 // indirect
	github.com/go-git/gcfg/v2 v2.0.2 // indirect
	github.com/go-git/go-billy/v6 v6.0.0-beta.1.0.20261016211742-fd38f5ac32fe // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/klauspost/compress v1.20.3 // indirect
	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
	github.com/libp2p/go-buffer-pool v0.1.0 // indirect
	github.com/libp2p/go-yamux/v5 v5.1.0 // indirect
	github.com/minio/sha256-simd v1.0.1 // indirect
	github.com/mr-tron/base58 v1.3.0 // indirect
	github.com/multiformats/go-multihash v0.2.3 // indirect
	github.com/multiformats/go-varint v0.0.7 // indirect
	github.com/pion/datachannel v1.6.3 // indirect
	github.com/pion/dtls/v3 v3.1.9 // indirect
	github.com/pion/ice/v4 v4.4.4 // indirect
	github.com/pion/interceptor v0.1.49 // indirect
	github.com/pion/logging v0.2.4 // indirect
	github.com/pion/mdns/v2 v2.2.1 // indirect
	github.com/pion/randutil v0.1.0 // indirect
	github.com/pion/rtcp v1.2.17 // indirect
	github.com/pion/rtp v1.10.5 // indirect
	github.com/pion/sctp v1.11.3 // indirect
	github.com/pion/sdp/v3 v3.0.20 // indirect
	github.com/pion/srtp/v3 v3.1.0 // indirect
	github.com/pion/stun/v4 v4.0.1 // indirect
	github.com/pion/transport/v5 v5.1.1 // indirect
	github.com/pion/turn/v5 v5.1.2 // indirect
	github.com/pion/webrtc/v4 v4.2.25 // indirect
	github.com/quic-go/quic-go v0.64.1 // indirect
	github.com/restic/chunker v0.5.0 // indirect
	github.com/spaolacci/murmur3 v1.1.0 // indirect
	github.com/wlynxg/anet v0.0.5 // indirect
	github.com/zeebo/blake3 v0.2.4 // indirect
	golang.org/x/crypto v0.58.0 // indirect
	golang.org/x/exp v0.0.0-20261014143641-f0251eb4aa3e // indirect
	golang.org/x/net v0.61.0 // indirect
	golang.org/x/sync v0.24.0 // indirect
	golang.org/x/sys v0.49.0 // indirect
	golang.org/x/time v0.15.0 // indirect
	google.golang.org/grpc v1.85.0 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	lukechampine.com/blake3 v1.2.1 // indirect
)
