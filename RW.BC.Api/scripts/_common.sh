#!/usr/bin/env bash
# Shared helpers for RW.BC API E2E scripts.
# Source from each test-*.sh:
#
#   source "$(dirname "$0")/_common.sh"
#
# Required tooling: curl, jq.
#
# Environment variables (with defaults):
#   API_BASE_URL        Base URL of the running API        (default: https://localhost:7180)
#   FIREBASE_API_KEY    Firebase Web API key (WebApiKey)   (required only for token sign-in)
#   CURL_INSECURE       "1" to add -k (dev self-signed TLS)(default: 1)

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://localhost:7180}"
CURL_INSECURE="${CURL_INSECURE:-1}"

PASS_COUNT=0
FAIL_COUNT=0

require_tools() {
  for tool in curl jq; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "ERROR: required tool '$tool' is not installed." >&2
      exit 1
    fi
  done
}

log_header() {
  echo ""
  echo "=============================================================="
  echo "  $1"
  echo "  Base: ${API_BASE_URL}"
  echo "=============================================================="
}

log_step() {
  echo ""
  echo "[$1] $2"
}

_curl() {
  local insecure_flag=()
  [ "${CURL_INSECURE}" = "1" ] && insecure_flag=(-k)
  curl -sS "${insecure_flag[@]}" "$@"
}

# invoke_api <phase> <description> <method> <path> <expected_status> [json_body] [bearer_token]
# Prints the response body to stdout; status assertion side-effect updates PASS/FAIL counters.
invoke_api() {
  local phase="$1" description="$2" method="$3" path="$4" expected="$5"
  local body="${6:-}" token="${7:-}"

  log_step "$phase" "$description" >&2

  local args=(-X "$method" -H 'Accept: application/json' -w '\n%{http_code}')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local raw status payload
  raw="$(_curl "${args[@]}" "${API_BASE_URL}${path}")"
  status="$(printf '%s' "$raw" | tail -n1)"
  payload="$(printf '%s' "$raw" | sed '$d')"

  if [ "$status" = "$expected" ]; then
    echo "  -> ${status} PASS   expected=${expected}" >&2
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  -> ${status} FAIL   expected=${expected}" >&2
    echo "     body: ${payload}" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  printf '%s' "$payload"
}

# read_field <json> <jq_path>   e.g. read_field "$body" '.id'
read_field() {
  printf '%s' "$1" | jq -r "$2"
}

# firebase_signin <email> <password>  -> prints the Firebase ID token (idToken)
# Uses the Firebase Identity Toolkit REST API. Requires FIREBASE_API_KEY.
firebase_signin() {
  local email="$1" password="$2"
  if [ -z "${FIREBASE_API_KEY:-}" ]; then
    echo "ERROR: FIREBASE_API_KEY is required to obtain a Firebase ID token." >&2
    exit 1
  fi

  local url="https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}"
  local resp
  resp="$(_curl -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"returnSecureToken\":true}")"

  local token
  token="$(printf '%s' "$resp" | jq -r '.idToken // empty')"
  if [ -z "$token" ]; then
    echo "ERROR: Firebase sign-in failed: $(printf '%s' "$resp" | jq -c '.error // .')" >&2
    exit 1
  fi
  printf '%s' "$token"
}

new_email() {
  echo "e2e-$(date +%s)-$RANDOM@example.com"
}

new_nickname() {
  echo "E2E_$RANDOM"
}

print_summary() {
  echo ""
  echo "=============================================================="
  echo "  Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
  echo "=============================================================="
  [ "$FAIL_COUNT" -eq 0 ]
}
