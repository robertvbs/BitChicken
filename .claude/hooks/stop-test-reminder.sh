#!/usr/bin/env bash
# Stop: se há mudanças não commitadas em código (.sol/.ts/.html), lembra de rodar os testes.
# Soft — exit 0, usa systemMessage (aviso ao usuário, NÃO bloqueia o stop). Throttle de 10 min
# por projeto para não repetir a cada turno.
cat >/dev/null 2>&1   # consome o stdin do hook
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

changed=$(git status --porcelain 2>/dev/null | grep -E '\.(sol|ts|html|cs)"?$')
[ -n "$changed" ] || exit 0

now=$(date +%s)
throttle() { # $1 = marcador; retorna 0 se passou >600s desde o último aviso
  local f="/tmp/bitchicken-hook-$1"
  local last=0; [ -f "$f" ] && last=$(cat "$f" 2>/dev/null || echo 0)
  if [ $((now - last)) -gt 600 ]; then echo "$now" > "$f"; return 0; fi
  return 1
}

msgs=""
if printf '%s' "$changed" | grep -q 'RW.BC.Crypto/' && throttle crypto; then
  msgs="$msgs Rode 'npm test' em RW.BC.Crypto."
fi
if printf '%s' "$changed" | grep -q 'RW.BC.DApp/' && throttle dapp; then
  msgs="$msgs Rode 'ng test' (cobertura) em RW.BC.DApp."
fi
if printf '%s' "$changed" | grep -qE 'RW.BC.Api/|RW.BC.AppHost/' && throttle api; then
  msgs="$msgs Rode 'dotnet test RW.BC.Api.slnx' (-p:AllowMissingPrunePackageData=true) em RW.BC.Api."
fi

[ -n "$msgs" ] || exit 0
printf '{"systemMessage": %s}\n' "$(printf '⚠️ Mudanças não commitadas.%s' "$msgs" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')"
exit 0
