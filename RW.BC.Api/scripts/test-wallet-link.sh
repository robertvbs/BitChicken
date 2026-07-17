#!/usr/bin/env bash
# E2E: SIWE-style wallet linking under the authenticated Firebase user.
#   1. POST /accounts/me/wallet/nonce   -> { message, nonce, expiresAt }
#   2. sign the returned message with an EVM private key
#   3. POST /accounts/me/wallet         -> links the wallet (200 + AccountDto)
#   4. DELETE /accounts/me/wallet       -> unlinks the wallet (200 + AccountDto)
#
# The signature is produced locally and the API only ever sees { address, signature }.
#
# Usage:
#   FIREBASE_API_KEY=... ACCOUNT_EMAIL=alice@example.com ACCOUNT_PASSWORD=Sup3rSecret! \
#   WALLET_PRIVATE_KEY=0xabc... API_BASE_URL=https://localhost:7180 ./test-wallet-link.sh
#
# Env:
#   API_BASE_URL        (default https://localhost:7180)
#   FIREBASE_API_KEY    (required) Firebase Web API key (Identity:Firebase:WebApiKey)
#   ACCOUNT_EMAIL       (required) email of an existing account
#   ACCOUNT_PASSWORD    (required) password of that account
#   ID_TOKEN            (optional) pre-obtained Firebase ID token; skips sign-in
#   WALLET_PRIVATE_KEY  (optional) EVM private key; used with node+ethers to sign the message
#   WALLET_ADDRESS      (optional) wallet address; required only when SIGNATURE is provided
#   SIGNATURE           (optional) pre-computed signature over the nonce message
#
# Signing material precedence:
#   - If SIGNATURE (+ WALLET_ADDRESS) is provided, it is used as-is.
#   - Else if WALLET_PRIVATE_KEY is set and node+ethers are available, the script signs locally.
#   - Else the link/unlink phases are skipped with a clear message (nonce phase still runs).

set -euo pipefail
source "$(dirname "$0")/_common.sh"
require_tools

log_header "Wallet link (SIWE-style signature)"

if [ -n "${ID_TOKEN:-}" ]; then
  TOKEN="$ID_TOKEN"
  echo "  using provided ID_TOKEN"
else
  : "${ACCOUNT_EMAIL:?ACCOUNT_EMAIL is required}"
  : "${ACCOUNT_PASSWORD:?ACCOUNT_PASSWORD is required}"
  echo "  signing in ${ACCOUNT_EMAIL} via Firebase REST API"
  TOKEN="$(firebase_signin "$ACCOUNT_EMAIL" "$ACCOUNT_PASSWORD")"
fi

# Phase 1 — request a fresh nonce + canonical message to sign
challenge="$(invoke_api '1' 'POST /accounts/me/wallet/nonce' 'POST' '/accounts/me/wallet/nonce' '200' '' "$TOKEN")"
MESSAGE="$(read_field "$challenge" '.message')"
NONCE="$(read_field "$challenge" '.nonce')"
echo "  nonce=${NONCE}"
echo "  message<<EOF"
printf '%s\n' "$MESSAGE"
echo "EOF"

# Obtain a signature over MESSAGE.
sign_with_ethers() {
  # Signs MESSAGE (stdin) with WALLET_PRIVATE_KEY using ethers; prints "<address> <signature>".
  node - "$WALLET_PRIVATE_KEY" <<'NODE'
const { Wallet } = require('ethers');
const pk = process.argv[2];
let message = '';
process.stdin.on('data', d => message += d);
process.stdin.on('end', async () => {
  const wallet = new Wallet(pk);
  const signature = await wallet.signMessage(message);
  process.stdout.write(`${wallet.address} ${signature}`);
});
NODE
}

ADDRESS=""
if [ -n "${SIGNATURE:-}" ] && [ -n "${WALLET_ADDRESS:-}" ]; then
  echo "  using provided SIGNATURE / WALLET_ADDRESS"
  ADDRESS="$WALLET_ADDRESS"
elif [ -n "${WALLET_PRIVATE_KEY:-}" ] && command -v node >/dev/null 2>&1 && node -e "require('ethers')" >/dev/null 2>&1; then
  echo "  signing message locally with ethers (node)"
  signed="$(printf '%s' "$MESSAGE" | sign_with_ethers)"
  ADDRESS="${signed%% *}"
  SIGNATURE="${signed##* }"
  echo "  address=${ADDRESS}"
else
  echo ""
  echo "  SKIP: no signing material available."
  echo "        Provide WALLET_PRIVATE_KEY (with node + ethers installed),"
  echo "        or SIGNATURE together with WALLET_ADDRESS, to exercise link/unlink."
  print_summary
  exit 0
fi

# Phase 2 — link the wallet using { address, signature }
link_body="$(jq -n --arg a "$ADDRESS" --arg s "$SIGNATURE" '{address:$a,signature:$s}')"
linked="$(invoke_api '2' 'POST /accounts/me/wallet (link)' 'POST' '/accounts/me/wallet' '200' "$link_body" "$TOKEN")"
echo "  walletLinked=$(read_field "$linked" '.walletLinked')"
echo "  walletAddress=$(read_field "$linked" '.walletAddress')"

# Phase 3 — replaying the same signature must fail (nonce already consumed -> 410 Gone)
invoke_api '3' 'POST /accounts/me/wallet replay (expect 410)' 'POST' '/accounts/me/wallet' '410' "$link_body" "$TOKEN" >/dev/null

# Phase 4 — unlink the wallet
unlinked="$(invoke_api '4' 'DELETE /accounts/me/wallet (unlink)' 'DELETE' '/accounts/me/wallet' '200' '' "$TOKEN")"
echo "  walletLinked=$(read_field "$unlinked" '.walletLinked')"

# Phase 5 — no token -> 401
invoke_api '5' 'POST /accounts/me/wallet/nonce without Authorization (expect 401)' 'POST' '/accounts/me/wallet/nonce' '401' '' '' >/dev/null

print_summary
