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
check_route "/?gate-b=1" "Post-collection blinded reconstruction" "gate-b"
check_route "/?gate-c=1" "Post-Gate-B playable identity" "gate-c"
check_route "/?campaign-author=1&release=1" "Empirical release gates" "release-author-precedence"
check_route "/?gate-b=1&release=1" "Empirical release gates" "release-review-precedence"
check_route "/?campaign-author=1&campaign=1" "Freeze the experiment before the first strike." "author-precedence"
check_route "/?campaign=1&lab=1" "Precommitted physical collection" "campaign-precedence"
check_route "/?gate-b=1&campaign=1" "Post-collection blinded reconstruction" "review-campaign-precedence"

echo "Browser route smoke tests passed."
BROWSER="$BROWSER" BASE_URL="$BASE_URL" node scripts/consumer-e2e.mjs
BROWSER="$BROWSER" BASE_URL="$BASE_URL" node scripts/permission-e2e.mjs
BROWSER="$BROWSER" BASE_URL="$BASE_URL" node scripts/mobile-surfaces-e2e.mjs
BROWSER="$BROWSER" BASE_URL="$BASE_URL" VITE_SOFTWARE_REVISION="${VITE_SOFTWARE_REVISION:-}" node scripts/post-collection-review-e2e.mjs

# Disposable hosted-v6 qualification. This branch is never merged.
LIVE_BASE_URL="https://fraware.github.io/EVERYTHING-RINGS"
EXPECTED_REVISION="579ae35ceccacc24b4b0a9ce5744e3a2bf3159b0"

curl --fail --location --silent --show-error "${LIVE_BASE_URL}/" >/dev/null

check_hosted_route() {
  local path="$1"
  local expected="$2"
  local name="$3"
  local output="/tmp/everything-rings-hosted-${name}.html"
  "$BROWSER" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --virtual-time-budget=5000 \
    --dump-dom "${LIVE_BASE_URL}${path}" >"$output" 2>"/tmp/everything-rings-hosted-${name}.browser.log"
  if ! grep -Fq "$expected" "$output"; then
    echo "Hosted qualification failed for ${path}; expected text: ${expected}" >&2
    cat "$output" >&2
    cat "/tmp/everything-rings-hosted-${name}.browser.log" >&2
    exit 1
  fi
}

check_hosted_route "/" "Hit anything." "consumer"
check_hosted_route "/?lab=1" "Acoustic analysis lab" "lab"
check_hosted_route "/?campaign-author=1" "Freeze the experiment before the first strike." "campaign-author"
check_hosted_route "/?campaign=1" "Precommitted physical collection" "campaign"
check_hosted_route "/?release=1" "Empirical release gates" "release"
check_hosted_route "/?gate-b=1" "Post-collection blinded reconstruction" "gate-b"
check_hosted_route "/?gate-c=1" "Post-Gate-B playable identity" "gate-c"

if ! grep -Fq "software revision ${EXPECTED_REVISION}" /tmp/everything-rings-hosted-lab.html; then
  echo "Hosted lab does not report the frozen v6 revision" >&2
  cat /tmp/everything-rings-hosted-lab.html >&2
  exit 1
fi
if ! grep -Fq "${EXPECTED_REVISION}" /tmp/everything-rings-hosted-campaign-author.html; then
  echo "Hosted campaign author does not report the frozen v6 revision" >&2
  cat /tmp/everything-rings-hosted-campaign-author.html >&2
  exit 1
fi

echo "Hosted static route and revision checks passed."
BROWSER="$BROWSER" BASE_URL="$LIVE_BASE_URL" node scripts/consumer-e2e.mjs
BROWSER="$BROWSER" BASE_URL="$LIVE_BASE_URL" VITE_SOFTWARE_REVISION="$EXPECTED_REVISION" node scripts/post-collection-review-e2e.mjs

PAGES_RUNS_URL="https://api.github.com/repos/fraware/EVERYTHING-RINGS/actions/workflows/pages.yml/runs?branch=main&per_page=20"
if curl --fail --silent --show-error --header "Accept: application/vnd.github+json" "$PAGES_RUNS_URL" > /tmp/everything-rings-pages-runs.json; then
  PAGES_RUN_ID="$(EXPECTED_REVISION="$EXPECTED_REVISION" node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync("/tmp/everything-rings-pages-runs.json", "utf8"));
    const run = (data.workflow_runs || []).find((candidate) => candidate.head_sha === process.env.EXPECTED_REVISION);
    if (!run) process.exit(2);
    if (run.status !== "completed" || run.conclusion !== "success") process.exit(3);
    process.stdout.write(String(run.id));
  ')"
  echo "Hosted Pages workflow run: ${PAGES_RUN_ID}"

  ARTIFACTS_URL="https://api.github.com/repos/fraware/EVERYTHING-RINGS/actions/runs/${PAGES_RUN_ID}/artifacts"
  if curl --fail --silent --show-error --header "Accept: application/vnd.github+json" "$ARTIFACTS_URL" > /tmp/everything-rings-pages-artifacts.json; then
    node -e '
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync("/tmp/everything-rings-pages-artifacts.json", "utf8"));
      const artifact = (data.artifacts || []).find((candidate) => candidate.name === "github-pages");
      if (!artifact) { console.log("Hosted Pages artifact: metadata returned, github-pages artifact not listed"); process.exit(0); }
      console.log(`Hosted Pages artifact: id=${artifact.id} name=${artifact.name} size=${artifact.size_in_bytes} digest=${artifact.digest || "unavailable"}`);
    '
  else
    echo "Hosted Pages artifact metadata unavailable through public API."
  fi
else
  echo "Hosted Pages workflow metadata unavailable through public API."
fi

echo "Hosted v6 qualification passed."
