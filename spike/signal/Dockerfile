# syntax=docker/dockerfile:1
# Signaling server image: a static binary on distroless, running as nonroot.
# Go cross-compiles, so the build stage runs on the builder's own platform and
# only the output targets linux/arm64 (the Pi) or linux/amd64: no emulation.
#
#   docker buildx build --platform linux/arm64,linux/amd64 -t <image> spike/signal
#
# Base images pinned by digest (multi-platform indexes).
FROM --platform=$BUILDPLATFORM golang:1.27.3-alpine@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS build
ARG TARGETOS TARGETARCH
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOFLAGS=-mod=readonly
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/signal . \
 && mkdir -p /out/data

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
LABEL org.opencontainers.image.source="https://github.com/axiumhq/jukejoint" \
      org.opencontainers.image.title="jukejoint-signal" \
      org.opencontainers.image.description="Jukejoint signaling server for the Modlock daemons"
COPY --from=build /out/signal /signal
# A named volume mounted here starts with this owner (nonroot, 65532), so the
# server can create its ticket key without running as root.
COPY --from=build --chown=65532:65532 /out/data /data
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["/signal", "-addr", ":8080", "-healthcheck"]
ENTRYPOINT ["/signal"]
# The ticket key lives in the volume, so tickets survive a restart.
CMD ["-addr", ":8080", "-secret-file", "/data/signal-secret.key"]
