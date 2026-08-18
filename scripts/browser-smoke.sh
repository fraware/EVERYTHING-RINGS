#!/usr/bin/env bash
set -euo pipefail

BROWSER="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$BROWSER" ]]; then
  echo "No Chromium-compatible browser found on the CI runner" >&2
  exit 1
fi

PORT="${PORT:-4173}"
BASE_URL="http://127.0.0.1:${PORT}"

pnpm --filter @everything-rings/web exec vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/everything-rings-vite.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in $(seq 1 40); do
  if curl --fail --silent --show-error "$BASE_URL" >/dev/null; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" -ne 1 ]]; then
  cat /tmp/everything-rings-vite.log >&2
  echo "Preview server did not become ready" >&2
  exit 1
fi

check_route() {
  local path="$1"
  local expected="$2"
  local name="$3"
  local output="/tmp/everything-rings-${name}.html"
  "$BROWSER" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --virtual-time-budget=3000 \
    --dump-dom "${BASE_URL}${path}" >"$output" 2>"/tmp/everything-rings-${name}.browser.log"
  if ! grep -Fq "$expected" "$output"; then
    echo "Browser smoke test failed for ${path}; expected text: ${expected}" >&2
    cat "$output" >&2
    cat "/tmp/everything-rings-${name}.browser.log" >&2
    exit 1
  fi
}

check_route "/" "Hit anything." "consumer"
check_route "/?lab=1" "Acoustic analysis lab" "lab"
if [[ -n "${VITE_SOFTWARE_REVISION:-}" ]] && ! grep -Fq "software revision ${VITE_SOFTWARE_REVISION}" /tmp/everything-rings-lab.html; then
  echo "Browser smoke test failed: validation build revision is not visible in the lab" >&2
  cat /tmp/everything-rings-lab.html >&2
  exit 1
fi
check_route "/?campaign-author=1" "Freeze the experiment before the first strike." "campaign-author"
check_route "/?campaign=1" "Precommitted physical collection" "campaign"
check_route "/?release=1" "Empirical release gates" "release"
check_route "/?campaign-author=1&release=1" "Empirical release gates" "release-author-precedence"
check_route "/?campaign-author=1&campaign=1" "Freeze the experiment before the first strike." "author-precedence"
check_route "/?campaign=1&lab=1" "Precommitted physical collection" "campaign-precedence"

echo "Browser route smoke tests passed."
BROWSER="$BROWSER" BASE_URL="$BASE_URL" node scripts/consumer-e2e.mjs
BROWSER="$BROWSER" BASE_URL="$BASE_URL" node scripts/permission-e2e.mjs
BROWSER="$BROWSER" BASE_URL="$BASE_URL" node scripts/mobile-surfaces-e2e.mjs
