#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): auto-formata arquivos do RW.BC.Crypto com Prettier.
# Soft — sempre exit 0, nunca bloqueia. Só o RW.BC.Crypto (lá o Prettier é a norma: npm run format);
# o RW.BC.DApp tem estilo intencionalmente não-prettier, então NÃO é formatado aqui.
input=$(cat)
file=$(printf '%s' "$input" | python3 -c 'import sys,json;
try: print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))
except Exception: print("")' 2>/dev/null)

[ -n "$file" ] && [ -f "$file" ] || exit 0
case "$file" in
  */RW.BC.Crypto/*.sol|*/RW.BC.Crypto/*.ts) : ;;
  *) exit 0 ;;
esac

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 24 >/dev/null 2>&1
( cd "${CLAUDE_PROJECT_DIR:-.}/RW.BC.Crypto" && npx prettier --write "$file" >/dev/null 2>&1 )
exit 0
