#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): se um contrato foi editado, lembra de sincronizar a ABI
# do frontend. Soft — exit 0; usa additionalContext (feedback visível ao Claude, não bloqueia).
input=$(cat)
file=$(printf '%s' "$input" | python3 -c 'import sys,json;
try: print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))
except Exception: print("")' 2>/dev/null)

case "$file" in
  */RW.BC.Crypto/contracts/*.sol)
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"⚠️ Sync de ABI: você editou um contrato. Se a interface (funções/eventos/erros) do NFT/forge/staking/marketplace/token mudou, espelhe em RW.BC.DApp/src/app/core/web3/contract-abi.ts + contract-read/write/admin.service.ts + web3.models.ts, atualize os environment.*.ts se redeployar, e confira o contrato em RW.BC.Api (ISignatureVerifier/ABIs) se aplicável."}}
JSON
    ;;
esac
exit 0
