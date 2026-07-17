# RW.BC.AppHost — ambiente local completo (Aspire)

Orquestra **todo o ambiente de desenvolvimento do BitChicken** num único comando, via .NET Aspire:
API de contas + Postgres + a testnet local (anvil) + explorer + deploy/seed dos contratos +
auto-fulfill do VRF + o dApp Angular.

## O que sobe

| Recurso | Tipo | Porta / acesso | Observação |
|---|---|---|---|
| `postgres-server` + `bitchicken` | container | interna | volume `bitchicken-pg-data` (persiste) |
| `api` | projeto .NET | porta dinâmica (ver dashboard) | API de contas (Firebase + carteira) |
| `localnet` | container (foundry/anvil) | `http://localhost:8545` (chainId 1337) | **efêmero**: chain nova a cada run; `--block-time 1` |
| `explorer` | container (Otterscan) | `http://localhost:5100` | navegador de blocos/txs |
| `deploy` → `fund` | npm one-shot (Hardhat) | — | implanta contratos + semeia edições 1–5/tiers/staking, depois funda contas dev |
| `forge-watch` | npm (Hardhat) | — | escuta `ForgeRequested` e chama o VRF mock (ovos chocam) |
| `dapp` | npm (ng serve) | `http://localhost:4200` | config `local`, lê a chain + a API |

Ordem garantida: `localnet` → `deploy` → `fund` → `forge-watch` (via `WaitForCompletion`); `dapp`
sobe assim que a chain está de pé. **O `deploy` leva ~50s** (muitas txs a 1 bloco/s).

## Como rodar

Pré-requisitos: **Docker** ligado, **Node 24** (também roda em 22), e `node_modules` instalados
em `RW.BC.Crypto/` e `RW.BC.DApp/` (`npm install` em cada um, uma vez).

```bash
dotnet run --project RW.BC.AppHost
```

O AppHost resolve sozinho o **Node mais novo (≥ 22)** instalado no nvm
(`~/.nvm/versions/node/v*/bin`) e o injeta no PATH dos recursos Node, mesmo que o shell esteja em
outra versão — então não precisa de `nvm use` antes. O dashboard do Aspire abre em `https://localhost:17190`.

> Se aparecer o erro de SDK `NETSDK1226` (prune data), rode com
> `dotnet run --project RW.BC.AppHost -p:AllowMissingPrunePackageData=true`.

## E2E ponta-a-ponta (read-model)

Com o ambiente no ar, o smoke **`e2e-smoke.sh`** valida o pipeline cross-stack
**contratos → indexer → API** (o que unit/integração não cobrem): edições materializadas, BigInteger
serializado como string, `listings` filtradas a `status="Active"`, NFTs enriquecidos por LEFT JOIN
(`editionName`), forge requests e o summary de transparência. Tolera lag do indexer (retry) e pula com
aviso o que não foi semeado; sai com código ≠ 0 em qualquer invariante quebrada.

```bash
# 1. Subir o ambiente (noutro terminal) e esperar deploy + indexer
dotnet run --project RW.BC.AppHost -p:AllowMissingPrunePackageData=true

# 2. Semear NFTs (contas dev 1–3) e listings — extras manuais além do seed do deploy
#    (precisa do forge:watch no ar p/ o VRF chocar os ovos)
cd ../RW.BC.Crypto && npm run seed-nfts:localhost && npm run seed-market:localhost && cd -

# 3. Descobrir a porta dinâmica da API (Aspire não fixa) e rodar o smoke
#    O MCP do Aspire pode não conectar headless; descubra pela porta do processo:
API_PORT=$(ss -ltnp 2>/dev/null | grep RW.BC.Api | grep -oE '127.0.0.1:[0-9]+' | cut -d: -f2 | head -1)
API_BASE="http://localhost:${API_PORT}" ./e2e-smoke.sh
```

Saída: cada checagem imprime `PASS`/`FAIL` + resumo `N passed / M failed`. (Os scripts de E2E de
contas/auth — Firebase + carteira — ficam em [`../RW.BC.Api/scripts/`](../RW.BC.Api/scripts/README.md).)

## Notas

- **Chain efêmera:** cada `dotnet run` recria a chain do zero, então os endereços determinísticos
  em `RW.BC.DApp/src/environments/environment.local.ts` (**gitignored** — copie de
  `environment.local.example.ts`) continuam válidos. (Após reiniciar, limpe os dados de atividade da
  aba no MetaMask, como no fluxo antigo.)
- **Firebase:** a API sobe, mas cadastro/login reais exigem credenciais Firebase em
  `appsettings`/secrets e no `environment.local.ts` (o `.example` traz placeholders).
- Equivale ao antigo `.temp/setup-test-env.sh`, porém sem o seed extra daquele script (gitignored):
  aqui o seed é o do `deploy:localhost` (edições 1–5, tier prices, staking).
