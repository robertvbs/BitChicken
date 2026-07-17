<p align="center">
  <img src="RW.BC.DApp/public/icons/app/icon-192x192.png" alt="BitChicken" width="96">
</p>

# BitChicken

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/robertvbs/BitChicken/actions/workflows/ci.yml/badge.svg)](https://github.com/robertvbs/BitChicken/actions/workflows/ci.yml)
![Solidity](https://img.shields.io/badge/Solidity-0.8.35-363636?logo=solidity&logoColor=white)
![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)
![Node](https://img.shields.io/badge/Node-24-339933?logo=node.js&logoColor=white)

**BitChicken** é um **ecossistema de NFT** na **BNB Smart Chain**: você abre **ovos** (gacha resolvido
por Chainlink VRF) e choca **Chickens** de espécies/raridades; aloja **casais** na granja para gerar
produção em **BCKN** (a token utilitária); e negocia no **marketplace**. Há também um **programa de
indicação** on-chain de **1 nível**: quando seu indicado abre o **primeiro ovo**, você ganha uma **fatia
em BNB** do preço (2% a 10%, conforme seu rank), sacável via pull-payment.

Monorepo com quatro camadas independentes, comunicando-se só por ABI, um Postgres compartilhado e HTTP —
veja [`CLAUDE.md`](CLAUDE.md) para os detalhes de arquitetura e convenções.

| Projeto | Stack | Papel |
|---|---|---|
| [`RW.BC.Crypto/`](RW.BC.Crypto) | Solidity 0.8.35 + Hardhat 3 (BSC) | Contratos: BCKN (ERC-20), NFT (ERC-721), Forge (gacha/VRF), Staking, Marketplace |
| [`RW.BC.Indexer/`](RW.BC.Indexer) | Ponder + viem (TypeScript) | Indexador on-chain: materializa eventos dos contratos num schema Postgres `indexer` (read-model) |
| [`RW.BC.DApp/`](RW.BC.DApp) | Angular 22 + PrimeNG 21 + Tailwind v4 + ethers v6 + Reown AppKit + Firebase | dApp: loja (ovos), granja, marketplace, coleção, contas (login/cadastro) |
| [`RW.BC.Api/`](RW.BC.Api) | .NET 10 + Aspire + EF Core/PostgreSQL + Firebase + Wolverine | API de contas: email/senha + vínculo de carteira (SIWE) |
| [`RW.BC.AppHost/`](RW.BC.AppHost) | .NET Aspire | Orquestra o ambiente de dev local num comando |

> 📚 **Documentação técnica** em [`docs/`](docs/index.md) — inventário regenerável (pipeline `/docs-refresh`)
> cobrindo os 4 projetos + o ecossistema (`docs/meta/`: arquitetura, domínios e ADRs). **O código é a fonte
> da verdade**; se a doc divergir, está velha.

## Índice

- [Como tudo se conecta](#como-tudo-se-conecta)
- [Pré-requisitos](#pré-requisitos)
- [Configuração inicial (do zero)](#configuração-inicial-do-zero)
- [Início rápido](#início-rápido)
- [Testnet interna via Docker](#testnet-interna-via-docker)
- [Ambientes do dApp](#ambientes-do-dapp)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Testes e cobertura](#testes-e-cobertura)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Como tudo se conecta

O dApp fala direto com os contratos para qualquer ação (comprar, vender, reivindicar rendimento) e fala
com a API por HTTP sempre que precisa de conta, autenticação ou uma consulta rápida de dados. A API nunca
inventa nada — ela só lê o que o **indexer** já organizou a partir dos eventos reais da blockchain. E o
indexer só existe porque os contratos, ao emitirem eventos, deixam um rastro público e verificável de tudo
que acontece.

Cada camada faz exatamente um tipo de trabalho, e a comunicação entre elas é sempre por meio de um
contrato bem definido — seja uma ABI, um schema de banco compartilhado ou uma chamada HTTP autenticada.

## Pré-requisitos

- **Node.js 24** (`nvm use 24`; há `.nvmrc` em `RW.BC.Crypto` e `RW.BC.Indexer`). Hardhat 3 e Angular 22
  abortam no Node 20.
- **.NET 10 SDK** (para `RW.BC.Api` / `RW.BC.AppHost`).
- **Docker** (testnet interna, Postgres da API, e os Testcontainers dos testes da API).

## Configuração inicial (do zero)

```bash
git clone https://github.com/robertvbs/BitChicken.git
cd BitChicken
nvm use 24
```

Instale as dependências de cada projeto Node:

```bash
(cd RW.BC.Crypto && npm install)
(cd RW.BC.Indexer && npm install)
(cd RW.BC.DApp && npm install)
```

Copie os arquivos de configuração de exemplo (veja [Variáveis de ambiente](#variáveis-de-ambiente)
abaixo para o que preencher em cada um):

```bash
cp RW.BC.Crypto/.env.example RW.BC.Crypto/.env
cp RW.BC.Indexer/.env.example RW.BC.Indexer/.env
cp RW.BC.DApp/src/environments/environment.local.example.ts RW.BC.DApp/src/environments/environment.local.ts
```

Os dois primeiros (`RW.BC.Crypto/.env`, `RW.BC.Indexer/.env`) podem ficar com os valores de exemplo —
os defaults já cobrem o deploy local, e as credenciais reais só importam para deploy em testnet/mainnet,
verificação no BSCScan, e para as telas de conta/login (Firebase) e conexão de carteira (Reown)
funcionarem com suas próprias credenciais.

> ⚠️ **O terceiro `cp` (`environment.local.ts`) não é opcional:** o Angular exige que esse arquivo
> exista fisicamente (é um `fileReplacement` da config `local`), mesmo que você não preencha nenhuma
> credencial real nele. Sem ele, `npm run start:local` — e por consequência o comando único do Aspire
> abaixo — falha no build do dApp.

## Início rápido

### Tudo de uma vez (recomendado) — Aspire
Garanta que o **Docker esteja rodando** antes de começar. Então:
```bash
dotnet run --project RW.BC.AppHost
```
Sobe **Postgres + API + anvil (chain 1337) + Otterscan + deploy/fund dos contratos + forge:watch + indexer
Ponder + o dApp** orquestrados. dApp em http://localhost:4200, dashboard Aspire em https://localhost:17190.
Detalhes em [`RW.BC.AppHost/README.md`](RW.BC.AppHost/README.md).

> Em alguns ambientes o build da API pode exigir o flag `-p:AllowMissingPrunePackageData=true` (erro de
> SDK `NETSDK1226`) — veja [Troubleshooting](#troubleshooting).

> **Ovo travado em "Chocando…":** o gacha usa Chainlink VRF; no localnet o mock só responde com
> `npm run forge:watch` rodando (o AppHost já sobe isso automaticamente).

### Contratos — `RW.BC.Crypto/`
```bash
npm test            # hardhat test (mocha + testes Solidity)
npm run compile     # hardhat clean && compile
npm run lint        # solhint + eslint
```

### dApp — `RW.BC.DApp/`
```bash
npm start           # ng serve (dev → BSC testnet)
npm test            # ng test (Vitest, cobertura 100% imposta)
npm run build       # build de produção → dist/browser
```

### API — `RW.BC.Api/`
```bash
dotnet build RW.BC.Api.slnx -p:AllowMissingPrunePackageData=true
dotnet test  RW.BC.Api.slnx -p:AllowMissingPrunePackageData=true   # xUnit + Testcontainers (precisa Docker)
```

### Indexer — `RW.BC.Indexer/`
```bash
npm run typecheck   # type-check é o gate principal
npm run test:cov    # testes + cobertura
```

### E2E ponta-a-ponta (read-model)

Com o ambiente Aspire no ar, o smoke valida o pipeline **contratos → indexer → API** (edições, NFTs por
LEFT JOIN, listings `status="Active"`, forge, transparência):

```bash
# após `dotnet run --project RW.BC.AppHost` + seed (ver RW.BC.AppHost/README.md)
cd RW.BC.Crypto && npm run seed-nfts:localhost && npm run seed-market:localhost && cd ..
API_PORT=$(ss -ltnp 2>/dev/null | grep RW.BC.Api | grep -oE '127.0.0.1:[0-9]+' | cut -d: -f2 | head -1)  # Linux
API_BASE="http://localhost:${API_PORT}" RW.BC.AppHost/e2e-smoke.sh
```

> O `ss` acima é específico de Linux. No macOS/Windows, pegue a porta da API direto no dashboard do
> Aspire (https://localhost:17190 → recurso `api` → endpoint) e defina `API_BASE` manualmente.

O E2E de **contas/auth** (Firebase + carteira) fica em [`RW.BC.Api/scripts/`](RW.BC.Api/scripts/README.md).

## Testnet interna via Docker

Se não quiser subir a API junto, use os npm scripts do Crypto. Sobe **anvil** (chain 1337) + **Otterscan**,
só a chain, sem API.

```bash
# em RW.BC.Crypto
npm run node:up           # anvil em http://localhost:8545 + Otterscan em http://localhost:5100
npm run deploy:localhost  # token + NFT + forge + staking + marketplace (endereços determinísticos);
                          # semeia tier prices, edições 1–5 e staking
npm run fund:localhost    # 10000 BNB nas contas dev — ou: FUND_ADDRESS=0x... npm run fund:localhost
npm run forge:watch       # DEIXE RODANDO: auto-fulfill do VRF mock (senão os ovos não chocam)

# em RW.BC.DApp
npm run start:local       # http://localhost:4200 lendo da chain interna
```

Para parar/limpar: `npm run node:down` (mantém estado) ou `npm run node:reset` (chain limpa).
Auxiliares: `npm run seed:localhost` (popula dados de exemplo) e `npm run stress:localhost` (harness de stress).

**Conectar a MetaMask:** rede RPC `http://localhost:8545`, **Chain ID `1337`**, símbolo `BNB`. Ligue
"Mostrar redes de teste" no seletor. Explorer local: **http://localhost:5100**.

## Ambientes do dApp

| Config | Rede | Quando |
|---|---|---|
| `local` (`environment.local.ts`, gitignored — copie de `environment.local.example.ts`) | nó Docker (chain 1337) + API local | `npm run start:local` |
| `development` (padrão) | BSC **testnet** | `npm start` / `npm test` |
| `production` | BSC **mainnet** | `npm run build` |

Cada um traz `rpcUrl`, endereços dos contratos, explorer, `appKit.local`, **`apiBaseUrl`** e a config
**`firebase`** (web). Os arquivos `environment.ts`/`environment.development.ts` (versionados) trazem
**placeholders** — preencha com o seu próprio projeto Firebase/Reown para usar login e vínculo de
carteira; o resto do dApp (navegar loja/mercado/coleção, conectar carteira e ler a chain) funciona sem
essas credenciais. **Ao reimplantar/upgradar um contrato, atualize os endereços** (e a ABI, se a
interface mudou).

## Variáveis de ambiente

### `RW.BC.Crypto/.env` (veja `.env.example`)

| Variável | Uso |
|---|---|
| `MAIN_PRIVATE_KEY` | Chave da carteira de deploy (testnet/mainnet). Use uma carteira dedicada, nunca a principal. |
| `BSC_RPC_URL` / `BSC_TESTNET_RPC_URL` | RPCs da BSC mainnet/testnet. |
| `BSCSCAN_API_KEY` | Verificação de contratos no BSCScan — obtenha em [bscscan.com/myapikey](https://bscscan.com/myapikey). |
| `ADMIN_WALLET` | Carteira que recebe a governança dos contratos no deploy; se vazia, o deployer permanece admin. Se você definir essa variável para um deploy local, atualize também o campo `admin` em `environment.local.ts` (dApp) para o mesmo endereço — senão o painel `/admin` local não reconhece sua carteira. |
| `FEE_SINK`, `PLATFORM_FEE_BPS` | Destino e percentual da taxa do marketplace. |
| `VRF_*` | Configuração do Chainlink VRF (coordinator/subId/keyHash) — só para testnet/mainnet; localnet usa mock. |
| `TOKEN_PROXY`, `NFT_PROXY`, `STAKING_PROXY`, `MARKETPLACE_PROXY` | Endereços de proxy para `npm run upgrade:*`. |

### `RW.BC.Indexer/.env` (veja `.env.example`)

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Connection string do Postgres onde o indexer materializa o schema `indexer`. |
| `CHAIN_ID`, `PONDER_RPC_URL_<chainId>` | Rede indexada e seu RPC. |
| `MARKETPLACE_ADDRESS`, `MARKETPLACE_START_BLOCK` | Endereço do contrato e bloco inicial de indexação. |

### `RW.BC.DApp/src/environments/environment.local.ts` (copie de `environment.local.example.ts`)

| Campo | Uso |
|---|---|
| `firebase.*` | Config web de um projeto Firebase (Email/Password habilitado) — [console.firebase.google.com](https://console.firebase.google.com). |
| `reown.projectId` | Project ID do WalletConnect/Reown — [cloud.reown.com](https://cloud.reown.com). |
| `ipfsGateway` | Gateway IPFS (o público `gateway.pinata.cloud` funciona; um dedicado é opcional). |

### `RW.BC.Api` (`appsettings.json` / user-secrets — sem `.env`)

| Chave | Uso |
|---|---|
| `Identity:Firebase:ProjectId` | Projeto Firebase usado para validar o JWT (OIDC discovery). Mesmo projeto do dApp. |
| `ConnectionStrings:bitchicken` (ou `ConnectionStrings__bitchicken`) | Connection string do Postgres da API — injetada automaticamente pelo Aspire. |

### Segredos

`.env`, `environment.local.ts` e qualquer chave privada/API key **não são versionados** (`.gitignore`
cobre `.env*`, `node_modules/` e os overrides locais). Nunca faça commit de chaves privadas, service
accounts ou connection strings reais — use os arquivos `*.example` como ponto de partida.

## Testes e cobertura

Política: **toda mudança vem com testes.** No `RW.BC.DApp`, 100% (statements/funcs/lines, 98% branches)
imposto a cada `ng test` via `angular.json`. No `RW.BC.Crypto`, cobertura **por construção** (sem
ferramenta no HH3). Na `RW.BC.Api`, xUnit + **Testcontainers** (Postgres real) via `dotnet test`.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em push/PR para `main`:

- **Crypto** — lint (solhint + eslint), testes (Hardhat mocha), upgrade-safety, ABI drift, invariantes/
  cobertura via Foundry, análise estática (Slither).
- **API** — build + testes (xUnit + Testcontainers) + cobertura.
- **Indexer** — codegen + typecheck + testes com gate de cobertura.
- **dApp** — i18n, lint, testes (cobertura imposta), build.
- **Segurança** — `gitleaks` (varredura de segredos no histórico) + `npm audit` nos três projetos Node.

## Troubleshooting

- **`NETSDK1226` no build da API/AppHost**: anexe `-p:AllowMissingPrunePackageData=true` a todo
  `dotnet build/test/restore/ef` (não commite esse flag em csproj/props).
- **MetaMask com nonce/saldo desatualizado após `node:reset`**: limpe em **Configurações → Avançado →
  Limpar dados da aba de atividade**.
- **No WSL, `localhost` não conecta do Windows**: use o IP do WSL (`ip -4 addr show eth0 | grep inet`).

---

## Contribuindo

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md) para o passo a passo de build/teste por projeto e convenções de
código. Para reportar uma vulnerabilidade de segurança, veja [`SECURITY.md`](SECURITY.md) — não abra uma
issue pública para isso.

## Licença

[MIT](LICENSE) © Robert Wagner
