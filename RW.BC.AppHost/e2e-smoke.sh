#!/usr/bin/env bash
# End-to-end smoke test for the BitChicken read-model pipeline
# (contracts -> indexer -> API). Run against a live Aspire environment.
#
# Asserts the cross-stack invariants that hand-validation has historically caught:
#   - editions populated by the indexer from on-chain events
#   - BigInteger numeric fields serialized as JSON strings (Npgsql numeric(78,0))
#   - marketplace listings pre-filtered to status "Active" (not "Listed")
#   - account NFTs enriched via LEFT JOIN (editionName present, string ids)
#   - transparency summary aggregated server-side
#
# Usage: API_BASE=http://localhost:PORT ./e2e-smoke.sh
# The API port is assigned dynamically by Aspire; discover it from the dashboard
# or via the aspire MCP and pass it in API_BASE.

set -uo pipefail

API_BASE="${API_BASE:?set API_BASE to the running API root, e.g. http://localhost:5xxx}"

# Anvil default mnemonic accounts; seed-nfts mints to signers[1..3].
DEV1="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# GET with a short retry so we tolerate the indexer lagging a block or two.
fetch() {
  local path="$1" out
  for _ in 1 2 3 4 5 6; do
    out=$(curl -fsS --max-time 10 "${API_BASE}${path}" 2>/dev/null) && { echo "$out"; return 0; }
    sleep 2
  done
  return 1
}

echo "== BitChicken e2e smoke against ${API_BASE} =="

# --- 1. API is up -----------------------------------------------------------
echo "[1] API liveness (/editions reachable)"
if EDITIONS=$(fetch "/editions"); then
  pass "API responded on /editions"
else
  echo "  FATAL: API not reachable at ${API_BASE}/editions"; exit 2
fi

# --- 2. Editions materialized by the indexer --------------------------------
echo "[2] Editions read-model"
ED_COUNT=$(echo "$EDITIONS" | jq '(.items // .) | length' 2>/dev/null || echo 0)
if [ "${ED_COUNT:-0}" -ge 1 ]; then pass "editions present (count=${ED_COUNT})"; else fail "no editions returned (indexer didn't materialize deploy seed)"; fi

# BigInteger fields must be JSON strings, not numbers.
PRICE_TYPE=$(echo "$EDITIONS" | jq -r '(.items // .)[0].price | type' 2>/dev/null)
if [ "$PRICE_TYPE" = "string" ]; then pass "edition.price serialized as string (Npgsql numeric)"; else fail "edition.price type=${PRICE_TYPE} (expected string)"; fi

# --- 3. Marketplace listings: status filter regression guard ----------------
echo "[3] Marketplace listings (status='Active' guard)"
if LISTINGS=$(fetch "/marketplace/listings"); then
  L_COUNT=$(echo "$LISTINGS" | jq '(.items // .) | length' 2>/dev/null || echo 0)
  BAD=$(echo "$LISTINGS" | jq '[(.items // .)[] | select(.status != "Active")] | length' 2>/dev/null || echo 0)
  if [ "${L_COUNT:-0}" -ge 1 ]; then pass "listings present (count=${L_COUNT})"; else echo "  WARN: 0 listings (run seed-market) — skipping status assert"; fi
  if [ "${L_COUNT:-0}" -ge 1 ] && [ "${BAD:-0}" -eq 0 ]; then pass "all listings status='Active' (ListingQueryService filter correct)"; fi
  if [ "${BAD:-0}" -ne 0 ]; then fail "${BAD} listing(s) with status != Active (filter regression)"; fi
  if [ "${L_COUNT:-0}" -ge 1 ]; then
    PT=$(echo "$LISTINGS" | jq -r '(.items // .)[0].price | type' 2>/dev/null)
    [ "$PT" = "string" ] && pass "listing.price serialized as string" || fail "listing.price type=${PT}"
  fi
else
  fail "/marketplace/listings unreachable"
fi

# --- 4. Account NFTs: LEFT JOIN enrichment + string ids ----------------------
echo "[4] Account NFTs for dev1 (${DEV1})"
if NFTS=$(fetch "/accounts/${DEV1}/nfts"); then
  N_COUNT=$(echo "$NFTS" | jq '(.items // .) | length' 2>/dev/null || echo 0)
  if [ "${N_COUNT:-0}" -ge 1 ]; then
    pass "dev1 owns NFTs (count=${N_COUNT})"
    ID_TYPE=$(echo "$NFTS" | jq -r '(.items // .)[0].tokenId | type' 2>/dev/null)
    [ "$ID_TYPE" = "string" ] && pass "nft.tokenId serialized as string" || fail "nft.tokenId type=${ID_TYPE}"
    HAS_EDNAME=$(echo "$NFTS" | jq '[(.items // .)[] | select(.editionName != null and .editionName != "")] | length' 2>/dev/null || echo 0)
    [ "${HAS_EDNAME:-0}" -ge 1 ] && pass "nft.editionName populated (LEFT JOIN to editions)" || fail "no editionName on any NFT (JOIN enrichment missing)"
  else
    echo "  WARN: dev1 owns 0 NFTs (run seed-nfts:localhost) — skipping NFT asserts"
  fi
else
  fail "/accounts/${DEV1}/nfts unreachable"
fi

# --- 5. Forge requests ------------------------------------------------------
echo "[5] Forge requests for dev1"
if FORGE=$(fetch "/accounts/${DEV1}/forge-requests"); then
  F_COUNT=$(echo "$FORGE" | jq '(.items // .) | length' 2>/dev/null || echo 0)
  if [ "${F_COUNT:-0}" -ge 1 ]; then
    pass "forge requests present (count=${F_COUNT})"
    BN_TYPE=$(echo "$FORGE" | jq -r '(.items // .)[0].blockNumber | type' 2>/dev/null)
    [ "$BN_TYPE" = "string" ] && pass "forge.blockNumber serialized as string" || echo "  INFO: forge.blockNumber type=${BN_TYPE}"
  else
    echo "  WARN: 0 forge requests for dev1 (run seed-nfts) — skipping"
  fi
else
  fail "/accounts/${DEV1}/forge-requests unreachable"
fi

# --- 6. Transparency summary (server-side aggregation) ----------------------
echo "[6] Transparency summary"
if SUMMARY=$(fetch "/transparency/summary"); then
  NFT_CT=$(echo "$SUMMARY" | jq -r '.nftCount // .NftCount // empty' 2>/dev/null)
  if [ -n "$NFT_CT" ]; then pass "summary returned (nftCount=${NFT_CT})"; else fail "summary missing nftCount field"; fi
else
  fail "/transparency/summary unreachable"
fi

echo ""
echo "== e2e smoke result: ${PASS} passed / ${FAIL} failed =="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
