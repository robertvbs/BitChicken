---
name: ship-check
description: Roda as suítes de teste e o lint dos projetos do BitChicken (RW.BC.Crypto + RW.BC.DApp + RW.BC.Api) antes de concluir/commitar uma mudança. Use como verificação final ao terminar uma tarefa que tocou contratos, frontend e/ou a API.
---

# Skill: ship-check

Verificação final antes de concluir. **Node 24** (`nvm use 24`). Rode só o que foi tocado.

## Contratos — se mexeu em `RW.BC.Crypto/`
```bash
cd RW.BC.Crypto
npm test            # hardhat test (mocha + Solidity) — tudo verde
npm run lint        # solhint + eslint
```

## dApp — se mexeu em `RW.BC.DApp/`
```bash
cd RW.BC.DApp
npx ng test --no-watch --coverage    # verde + thresholds de cobertura (ver skill verify-dapp)
npm run check:abi-drift              # subset a mao (contract-abi.ts) vs artefatos do Crypto, por selector
npx ng build --configuration production   # opcional: garante que compila em prod
```
> `check:abi-drift` precisa de artefatos frescos: rode `npm run compile` em `RW.BC.Crypto` antes
> (compila + checa que cada funcao/erro/evento do `contract-abi.ts` existe no contrato com selector identico).
> Substitui o lembrete passivo do hook `abi-drift-warn.sh` por verificacao real — fecha a "armadilha no 1".

## API — se mexeu em `RW.BC.Api/` ou `RW.BC.AppHost/`
```bash
cd RW.BC.Api
dotnet build RW.BC.Api.slnx -p:AllowMissingPrunePackageData=true   # 0 warnings/0 errors
dotnet test  RW.BC.Api.slnx -p:AllowMissingPrunePackageData=true   # xUnit + Testcontainers (precisa Docker)
# se tocou no AppHost: dotnet build RW.BC.AppHost/RW.BC.AppHost.csproj -p:AllowMissingPrunePackageData=true
```

## Indexer — se mexeu em `RW.BC.Indexer/`
```bash
cd RW.BC.Indexer
npx tsc --noEmit    # type-check é o gate (não há suíte unit)
```

## E2E ponta-a-ponta (read-model) — se mexeu na interface contrato/indexer/API

Smoke do pipeline **contratos → indexer → API** num ambiente Aspire vivo (ver
`RW.BC.AppHost/README.md` → "E2E ponta-a-ponta"):
```bash
dotnet run --project RW.BC.AppHost -p:AllowMissingPrunePackageData=true   # noutro terminal; espere deploy+indexer
cd RW.BC.Crypto && npm run seed-nfts:localhost && npm run seed-market:localhost && cd ..
API_PORT=$(ss -ltnp 2>/dev/null | grep RW.BC.Api | grep -oE '127.0.0.1:[0-9]+' | cut -d: -f2 | head -1)  # Linux; no macOS/Windows pegue a porta no dashboard do Aspire (https://localhost:17190)
API_BASE="http://localhost:${API_PORT}" RW.BC.AppHost/e2e-smoke.sh   # 12 checagens, exit≠0 em falha
```

## Checklist
- [ ] Testes verdes nos projetos tocados, **sem regressão de cobertura** (mandato de 100% no dApp/Crypto;
      alta cobertura na API).
- [ ] Se mudou a interface de um contrato: **ABI sincronizada** no dApp (contract-abi.ts +
      contract-read/write/admin.service.ts + models) e `environment.*.ts` atualizados se redeployou.
- [ ] i18n: chaves novas existem em `public/i18n/{en-US,pt-BR}.json`.
- [ ] API: build 0/0 com o flag `AllowMissingPrunePackageData`; migrations adicionadas se o schema mudou.
- [ ] Não reformatou arquivos alheios do dApp (estilo intencionalmente não-prettier).
