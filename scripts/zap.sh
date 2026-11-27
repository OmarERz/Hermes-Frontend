#!/usr/bin/env bash
# OWASP ZAP baseline scan (passive, Docker, pinned image: the same as the backend Makefile) of the production front
# container: built from the Dockerfile, served by compose.yaml on a throwaway network with a published port unique to
# this run, then scanned. Every alert fails the run unless it is listed, with its reason, in zap/accepted-alerts.json
# (scripts/zap-check.mjs reads the JSON report). The container and the network are always removed.
# A heavy job: where the shared heavy-work slots exist (hermes-heavy on PATH), it waits for one, unless the caller
# already holds one (HERMES_HEAVY_LOCK_HELD=1, which hermes-heavy sets; the local gate runs inside it).
# Usage: npm run zap
set -euo pipefail

ZAP_IMAGE="ghcr.io/zaproxy/zaproxy@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af"
if [ -z "${HERMES_HEAVY_LOCK_HELD:-}" ] && command -v hermes-heavy >/dev/null 2>&1; then
  echo "zap: waiting for a heavy-work slot (hermes-heavy)"
  exec hermes-heavy bash "$0" "$@"
fi

root="$(git rev-parse --show-toplevel)"
tmp=""
project=""
port=""
front_started=""

# Every call (up and down alike) gets the same settings: compose.yaml requires FRONT_RUNTIME_CONFIG, so a `down`
# without them would fail and leave the container, its image and the network behind.
fdc() {
  HERMES_NETWORK="$project" FRONT_PORT="$port" FRONT_RUNTIME_CONFIG="$tmp/runtime-config.json" \
    docker compose --env-file /dev/null --project-directory "$root" -p "$project" -f "$root/compose.yaml" "$@"
}

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [ -n "$front_started" ]; then
    fdc down -v --remove-orphans --rmi local >"$tmp/down.log" 2>&1 ||
      { cat "$tmp/down.log" >&2; echo "warning: could not remove $project" >&2; }
  fi
  if [ -n "$project" ]; then docker network rm "$project" >/dev/null 2>&1 || true; fi
  if [ -n "$tmp" ]; then rm -rf "$tmp"; fi
  if [ "$rc" -ne 0 ]; then echo "✖ zap failed" >&2; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Only what this script sets reaches Compose (no env file, nothing from the caller's environment).
for var in $(grep -ohE '\$\{[A-Z_][A-Z0-9_]*' "$root/compose.yaml" | cut -c3- | sort -u) \
  COMPOSE_FILE COMPOSE_PROFILES COMPOSE_ENV_FILES COMPOSE_PROJECT_NAME; do
  unset "$var"
done

tmp="$(mktemp -d "${TMPDIR:-/tmp}/hermes-front-zap.XXXXXX")"
project="hermes-front-zap-$(printf '%s' "$root" | sha256sum | cut -c1-8)-$$-$(openssl rand -hex 3)"
port="$(python3 -I -c '
import random, socket
while True:
    port = random.randint(20000, 39999)
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            continue
    print(port)
    break')"

# The production defaults (no emulator, API on the same origin); the scan needs no Firebase project.
printf '{}\n' >"$tmp/runtime-config.json"
chmod 644 "$tmp/runtime-config.json"
mkdir -m 777 "$tmp/zap"

docker network create "$project" >/dev/null
front_started=1
echo "==> zap: production front container on 127.0.0.1:$port"
fdc up --build --wait --wait-timeout 300 -d

echo "==> zap: baseline scan"
# -I: warnings do not set the exit code; the decision is zap-check's, against the accepted alerts.
docker run --rm --network host -v "$tmp/zap:/zap/wrk:rw" "$ZAP_IMAGE" \
  zap-baseline.py -t "http://127.0.0.1:$port" -J report.json -I
node "$root/scripts/zap-check.mjs" "$tmp/zap/report.json" "$root/zap/accepted-alerts.json"
