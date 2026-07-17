---
name: verify-dapp
description: Roda a suíte de testes do RW.BC.DApp com cobertura e ajuda a fechar 100% (statements/functions/lines; branches 98). Use ao terminar uma mudança no frontend, quando o ng test falhar por threshold, ou ao pedir "verificar cobertura do dApp".
---

# Skill: verify-dapp

Em `RW.BC.DApp/` com **Node 24** (`nvm use 24`). Sempre `ng test` — **nunca `vitest` cru**.

## Rodar
```bash
npx ng test --no-watch --coverage --coverage-reporters text
```
Os limites (100% statements/funcs/lines, 98% branches) estão no `angular.json` e fazem o run
**falhar** se não baterem.

## Achar os gaps exatos
```bash
npx ng test --no-watch --coverage --coverage-reporters json >/dev/null 2>&1
node -e 'const c=require("./coverage/rw-bc-dapp/coverage-final.json");
for(const [f,d] of Object.entries(c)){const n=f.replace(/.*\/src\//,"");
const fn=Object.entries(d.fnMap||{}).filter(([k])=>d.f[k]===0).map(([,v])=>(v.name||"?")+"@L"+((v.decl||v.loc).start.line));
const st=Object.entries(d.statementMap||{}).filter(([k])=>d.s[k]===0).map(([,v])=>v.start.line);
const br=Object.entries(d.branchMap||{}).filter(([k])=>(d.b[k]||[]).some(x=>x===0)).map(([,v])=>v.type+"@L"+v.loc.start.line);
if(fn.length||st.length||br.length)console.log(n+" | st:"+st.join(",")+" | fns:"+fn.join(",")+" | br:"+br.join(","));}'
```

## Fechar os gaps
- Listener de `(onClick)`/`(ngModelChange)` no template não coberto → **clique de verdade** no
  componente renderizado (`triggerEventHandler` ou `.click()`), não só chamar o método.
- Branch de `@if`/ternário → renderize/exercite os **dois** lados.
- **O builder NÃO honra `/* v8 ignore */`** → cubra de fato ou **remova o código morto**
  (ex.: guard de SSR desnecessário, `?? default` impossível). Branches defensivos genuinamente
  inalcançáveis ficam no resíduo (branch threshold 98).
- Reuse `src/testing/web3-fakes.ts` e `i18n-testing.ts`.
