#!/usr/bin/env bash
# Browser suite (Playwright) against the real front container and an isolated backend stack, all in Docker:
#   1. a snapshot of the backend (HERMES_BACKEND_REF of the repo in HERMES_BACKEND_DIR; default origin/develop of
#      ../hermes) is unpacked in a temporary directory outside both repositories, with throwaway secret files;
#   2. its Compose stack comes up with a project name and published ports (20000-39999) unique to this run, no env
#      file (no real key reaches it), the embeddings fake (compose.ci.yaml) and the Firebase Auth emulator, and the
#      demo data are loaded (`make demo`: the demo service);
#   3. the front image is built with the e2e configuration (the production build that still accepts the emulator) and
#      served by its own compose.yaml on the stack's network, with a runtime-config.json for this run: the API on the
#      same origin through the nginx /api/ proxy, as in production;
#   4. the suite (e2e/playwright.config.ts) runs in the pinned Playwright image (no browser libraries on the host).
# Both stacks, their images and the temporary directory are always removed (`down -v --rmi local`), also on failure or
# Ctrl-C. It never reads or writes the backend checkout's own env file or secret files.
# A heavy job: where the shared heavy-work slots exist (hermes-heavy on PATH), it waits for one, unless the caller
# already holds one (HERMES_HEAVY_LOCK_HELD=1, which hermes-heavy sets; the local gate runs inside it).
# Usage: npm run e2e [-- <playwright args>]   e.g. npm run e2e -- e2e/screens/vulnerabilities.spec.ts
set -euo pipefail

PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v1.65.0-noble@sha256:9beb546099e11f52d62e505537914870e01a67e0e6b00ae41da4775324e73dbe"
if [ -z "${HERMES_HEAVY_LOCK_HELD:-}" ] && command -v hermes-heavy >/dev/null 2>&1; then
  echo "e2e: waiting for a heavy-work slot (hermes-heavy)"
  exec hermes-heavy bash "$0" "$@"
fi

root="$(git rev-parse --show-toplevel)"
backend_dir="${HERMES_BACKEND_DIR:-$root/../hermes}"
backend_ref="${HERMES_BACKEND_REF:-origin/develop}"
started="$(date +%s)"

tmp=""
project=""
outputs=""
stack_started=""
front_started=""

# Only what this script sets reaches Compose (no env file, nothing from the caller's environment).
bdc() {
  docker compose --env-file /dev/null --project-directory "$tmp/backend" -p "$project" \
    -f "$tmp/backend/compose.yaml" -f "$tmp/backend/compose.ci.yaml" "$@"
}
# Every call to the front project (up and down alike) gets the same settings: its compose.yaml requires
# FRONT_RUNTIME_CONFIG, so a `down` without them would fail and leave the container and its image behind.
fdc() {
  HERMES_NETWORK="${project}_default" FRONT_BUILD_CONFIGURATION=e2e FRONT_PORT="$FRONT_PORT" \
    FRONT_RUNTIME_CONFIG="$tmp/runtime-config.json" CSP_CONNECT_EXTRA="http://127.0.0.1:$AUTH_EMULATOR_PORT" \
    docker compose --env-file /dev/null --project-directory "$root" -p "$project-front" -f "$root/compose.yaml" "$@"
}

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$rc" -ne 0 ] && [ -n "$stack_started" ]; then
    echo "--- last lines of the api and front logs ---" >&2
    bdc logs --no-color --tail 40 api >&2 2>&1 || true
    [ -n "$front_started" ] && fdc logs --no-color --tail 40 front >&2 2>&1 || true
  fi
  if [ -n "$front_started" ]; then
    fdc down -v --remove-orphans --rmi local >"$tmp/down-front.log" 2>&1 ||
      { cat "$tmp/down-front.log" >&2; echo "warning: could not remove $project-front" >&2; }
  fi
  if [ -n "$stack_started" ]; then
    echo "==> e2e: removing the stack $project"
    bdc --profile demo down -v --remove-orphans --rmi local >"$tmp/down-stack.log" 2>&1 ||
      { cat "$tmp/down-stack.log" >&2; echo "warning: could not remove the stack $project" >&2; }
  fi
  if [ -n "$tmp" ]; then rm -rf "$tmp"; fi
  if [ "$rc" -ne 0 ]; then echo "✖ e2e failed${outputs:+ (report: $outputs/report/index.html)}" >&2; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# free_ports N: N distinct ports in 20000-39999 that nothing listens on now.
free_ports() {
  python3 -I - "$1" <<'PY'
import random, socket, sys
ports = set()
while len(ports) < int(sys.argv[1]):
    port = random.randint(20000, 39999)
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            continue
    ports.add(port)
print(*ports)
PY
}

tmp="$(mktemp -d "${TMPDIR:-/tmp}/hermes-front-e2e.XXXXXX")"
project="hermes-front-e2e-$(printf '%s' "$root" | sha256sum | cut -c1-8)-$$-$(openssl rand -hex 3)"
# This run's report, traces and sessions (a second run from this checkout gets its own folder); runs older than a day
# are pruned. e2e/test-output/ is ignored by git.
outputs="e2e/test-output/$(date -u +%Y%m%dT%H%M%SZ)-${project##*-}"
mkdir -p "$root/e2e/test-output"
find "$root/e2e/test-output" -mindepth 1 -maxdepth 1 -mtime +0 -exec rm -rf -- {} +
mkdir -p "$root/$outputs"

echo "==> e2e: backend $backend_ref from $backend_dir"
mkdir "$tmp/backend"
git -C "$backend_dir" archive "$backend_ref" | tar -x -C "$tmp/backend"

# Only what this script sets reaches Compose: every variable the compose files interpolate, plus Compose's own
# settings (a COMPOSE_PROFILES=slack in the caller's shell would start the Slack module), is dropped first.
for var in $(grep -ohE '\$\{[A-Z_][A-Z0-9_]*' "$tmp/backend/compose.yaml" "$tmp/backend/compose.ci.yaml" "$root/compose.yaml" |
  cut -c3- | sort -u) ADVISORY_DOMAINS COMPOSE_FILE COMPOSE_PROFILES COMPOSE_ENV_FILES COMPOSE_PROJECT_NAME; do
  unset "$var"
done
read -r API_PORT AUTH_EMULATOR_PORT DB_PORT FRONT_PORT <<<"$(free_ports 4)"
export COMPOSE_SECRETS_DIR="$tmp/secrets" API_PORT AUTH_EMULATOR_PORT DB_PORT
# The suite reaches the API through the front's proxy (same origin); the served origin is allowed as in development.
export CORS_ALLOWED_ORIGINS="http://127.0.0.1:$FRONT_PORT"

# Throwaway passwords, written as the secret files the backend's compose.yaml mounts; the optional keys stay blank
# (unset here, so a real key exported in the caller's shell never reaches the throwaway stack).
(
  unset ITOP_TOKEN NVD_API_KEY DEEPSEEK_API_KEY ABUSECH_AUTH_KEY RANSOMWARELIVE_API_KEY ITOP_WEBHOOK_TOKEN \
    SLACK_DB_PASSWORD SLACK_BOT_TOKEN SLACK_APP_TOKEN
  for var in POSTGRES_PASSWORD MIGRATOR_DB_PASSWORD APP_DB_PASSWORD RETENTION_DB_PASSWORD CURSOR_SIGNING_KEY; do
    printf -v "$var" '%s' "$(openssl rand -hex 24)"
    export "${var?}"
  done
  ENV_FILE=/dev/null bash "$tmp/backend/docker/compose-secrets.sh" >/dev/null
)

echo "==> e2e: backend stack $project (API 127.0.0.1:$API_PORT, Auth emulator 127.0.0.1:$AUTH_EMULATOR_PORT)"
stack_started=1
bdc up --build --wait --wait-timeout 600 -d
echo "==> e2e: demo data"
bdc --profile demo run --rm --build demo >/dev/null

echo "==> e2e: front container (e2e build) on 127.0.0.1:$FRONT_PORT"
cat >"$tmp/runtime-config.json" <<JSON
{ "apiBaseUrl": "", "authEmulatorUrl": "http://127.0.0.1:$AUTH_EMULATOR_PORT" }
JSON
chmod 644 "$tmp/runtime-config.json"
front_started=1
fdc up --build --wait --wait-timeout 300 -d

echo "==> e2e: Playwright"
docker run --rm --init --ipc host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 \
  -e E2E_BASE_URL="http://127.0.0.1:$FRONT_PORT" -e E2E_AUTH_EMULATOR_URL="http://127.0.0.1:$AUTH_EMULATOR_PORT" \
  -e E2E_OUTPUT_DIR="/work/$outputs" \
  -v "$root:/work" -w /work "$PLAYWRIGHT_IMAGE" npx --no-install playwright test -c e2e/playwright.config.ts "$@"

echo "✔ e2e green in $(($(date +%s) - started))s (report: $outputs/report/index.html)"
