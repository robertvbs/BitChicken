#!/usr/bin/env bash
# E2E: GET /accounts/me (authenticated, Firebase JWT Bearer).
# Obtains a Firebase ID token via the Firebase REST API (WebApiKey + email/password),
# then reads the current account profile.
#
# Usage:
#   FIREBASE_API_KEY=... ACCOUNT_EMAIL=alice@example.com ACCOUNT_PASSWORD=Sup3rSecret! \
#     API_BASE_URL=https://localhost:7180 ./test-account-me.sh
#
# Env:
#   API_BASE_URL       (default https://localhost:7180)
#   FIREBASE_API_KEY   (required) Firebase Web API key (Identity:Firebase:WebApiKey)
#   ACCOUNT_EMAIL      (required) email of an existing account
#   ACCOUNT_PASSWORD   (required) password of that account
#   ID_TOKEN           (optional) pre-obtained Firebase ID token; skips sign-in

set -euo pipefail
source "$(dirname "$0")/_common.sh"
require_tools

log_header "GET /accounts/me (Bearer)"

if [ -n "${ID_TOKEN:-}" ]; then
  TOKEN="$ID_TOKEN"
  echo "  using provided ID_TOKEN"
else
  : "${ACCOUNT_EMAIL:?ACCOUNT_EMAIL is required}"
  : "${ACCOUNT_PASSWORD:?ACCOUNT_PASSWORD is required}"
  echo "  signing in ${ACCOUNT_EMAIL} via Firebase REST API"
  TOKEN="$(firebase_signin "$ACCOUNT_EMAIL" "$ACCOUNT_PASSWORD")"
fi

# Phase 1 — happy path
profile="$(invoke_api '1' 'GET /accounts/me (authenticated)' 'GET' '/accounts/me' '200' '' "$TOKEN")"
echo "  id=$(read_field "$profile" '.id')"
echo "  email=$(read_field "$profile" '.email')"
echo "  nickname=$(read_field "$profile" '.nickname')"
echo "  status=$(read_field "$profile" '.status')"
echo "  walletLinked=$(read_field "$profile" '.walletLinked')"

# Phase 2 — no token -> 401
invoke_api '2' 'GET /accounts/me without Authorization (expect 401)' 'GET' '/accounts/me' '401' '' '' >/dev/null

print_summary
