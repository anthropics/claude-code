# syntax=docker/dockerfile:1

# Runtime image for `claude gateway`.
#
# This image does NOT build the binary. It expects a prebuilt native
# linux-x64 `claude` executable in the build context — the public Claude Code
# release binary, which includes the `gateway` subcommand. setup.sh places it
# at ./claude (downloading it from the public release endpoint and verifying
# it against the release manifest if missing). Override CLAUDE_BINARY to
# point at a different path.
#
# Build (with the binary at ./claude; otherwise add --build-arg CLAUDE_BINARY=<path>):
#   docker build --platform=linux/amd64 --provenance=false -t claude-gateway .
#
# Run:
#   docker run --rm -p 8080:8080 \
#     -v "$PWD/gateway.yaml:/etc/claude/gateway.yaml:ro" \
#     -e OIDC_CLIENT_SECRET -e GATEWAY_JWT_SECRET -e GATEWAY_POSTGRES_URL \
#     claude-gateway

ARG CLAUDE_BINARY=./claude

# distroless/cc provides glibc + libstdc++ (required by the Bun-compiled
# native binary). The :nonroot tag runs as uid/gid 65532.
FROM gcr.io/distroless/cc-debian12:nonroot

ARG CLAUDE_BINARY
COPY --chmod=0755 ${CLAUDE_BINARY} /usr/local/bin/claude

ENV CLAUDE_CONFIG_DIR=/tmp/.claude

EXPOSE 8080
USER nonroot

ENTRYPOINT ["/usr/local/bin/claude", "gateway", "--config", "/etc/claude/gateway.yaml"]
