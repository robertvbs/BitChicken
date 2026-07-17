---
paths:
  - "RW.BC.DApp/**"
---

# Regras — RW.BC.DApp (frontend / dApp)

Angular 22 (zoneless, standalone, **signals**) + PrimeNG 21 + Tailwind v4 + ethers v6 + Reown
AppKit + Firebase Auth (Web SDK). Execute a partir de `RW.BC.DApp/` com **Node 24** (`nvm use 24`).

## Comandos

```bash
npm start            # ng serve → BSC testnet (config development)
npm run start:local  # ng serve → chain Docker local (config local)
npm test             # ng test (Vitest, com cobertura imposta)
npm run build        # build de produção (BSC mainnet)
```

## Convenções

- **Idioma:** código em **inglês (EUA)** (identificadores, strings internas, logs) — `.ts`/`.html`/
  `.css`/`.json`/configs. **Comentários no código são proibidos** (sem exceção). Texto visível ao
  usuário **sempre** via **i18n** (chave nos dois locales), nunca cravado. Documentação (`docs/`) é pt-BR.
- **Angular 22 zoneless + standalone (sem NgModules), signals.** UI usa **só componentes PrimeNG**
  + Tailwind v4 (preset Aura customizado em `app.config.ts`). PrimeNG 21 sobre Angular 22 via
  `legacy-peer-deps` (há `.npmrc`).
- **Testes:** sempre `ng test` (builder `@angular/build:unit-test`), **nunca `vitest` cru**. **Mandato
  de 100%** — limites em `angular.json` (100% statements/funcs/lines, 98% branches) impostos a cada run;
  toda mudança vem com `.spec.ts`. Para fechar cobertura use a skill **verify-dapp**. Padrões de teste:
  `src/testing/web3-fakes.ts`, `src/testing/i18n-testing.ts` e specs vizinhos. Mocke `firebase/auth` e
  `@reown/appkit`/`ethers` com `vi.mock(...)`.

## Referências (consulte as fontes, não só a memória)

- **Angular 22:** <https://angular.dev/overview> — ou o **`RW.BC.DApp/llms-full.txt`** (dump completo
  da doc do Angular, na raiz do projeto, ótimo para consulta offline/contexto).
- **PrimeNG 21:** MCP `mcp__primeng__*` (componentes, props, exemplos, theming, passthrough) +
  <https://primeng.org/>. Prefira o MCP para checar props/API de componentes.

## Camadas

- **Web3** (`app/core/web3/`): `Web3Service` (Reown AppKit, signals; rede via `environment.appKit.local`
  → `bsc`/`bscTestnet`/chain local 1337), `ContractReadService`/`ContractWriteService`/
  `ContractAdminService` (lê via `JsonRpcProvider`, escreve via signer; `safeRead` tolerante a getters
  ausentes; `ContractAdminService` só existe no escopo da rota `/admin`), `contract-abi.ts` (subconjunto à
  mão da ABI: NFT/forge/staking/marketplace/token), `web3.models.ts`, `web3.format.ts`, `explorer.ts`.
- **Auth + conta** (`app/core/auth/`): **há backend agora** (a API .NET `RW.BC.Api`). `AuthService`
  (Firebase email/senha, signals `currentUser`/`isAuthenticated`/idToken), `auth-token.interceptor.ts`
  (injeta Bearer do Firebase só em chamadas pro `environment.apiBaseUrl`), `auth-api.service.ts`
  (`GET /accounts/me` — provisiona a conta **JIT** na 1ª chamada autenticada; sem `POST /accounts`; wallet
  nonce/verify/unlink), `wallet-link.service.ts` (SIWE:
  nonce → assinatura via signer → verify), `account.store.ts`, `wallet-sync-prompt.service.ts`,
  `write-gate.service.ts`. Login/cadastro são um dialog (`shared/components/auth-dialog/`, modos
  `login`/`signup` via `AuthDialogService`) — não há rotas `/login`/`/signup` nem `features/auth/`.
- **Guards** (`app/core/guards/`): `authGuard` (exige login), `walletLinkedGuard` (exige carteira
  vinculada; abre modal de sync obrigatório), `adminGuard`. `/granja` é privada; loja/mercado/coleção são
  públicas mas as **ações on-chain** passam pelo `write-gate` (login + vínculo de carteira).
- **Features** (`app/features/`): `home`, `store` (só ovos), `farm` (granja/staking), `marketplace`,
  `collection`, `public-farm`, `admin`, `legal`, `not-found`. Outros serviços: `core/market`
  (coingecko BNB→fiat), `core/i18n` (en-US/pt-BR em `public/i18n/*.json`), `core/theme`, `core/referral`.
- **Environments:** `environment.ts` (mainnet/prod, importado por padrão em `ng test`),
  `environment.development.ts` (testnet — usado em `ng serve`/`npm start`), `environment.local.ts`
  (chain Docker + API local; **gitignored** — copie de `environment.local.example.ts`). Cada um: `rpcUrl`,
  `contracts`, `explorer`, `appKit`, `coingecko`, **`apiBaseUrl`** e **`firebase`** (config web).

## Armadilhas

- **Templates Angular não aceitam literal `bigint` (`0n`)** — crie um `computed` booleano.
- **O builder de testes NÃO honra `/* v8 ignore */`** — para 100% cubra de fato ou remova código morto
  (branches inalcançáveis ficam sob o threshold de 98% de branches).
- **Sync de ABI:** ao mudar a interface do contrato, atualizar `contract-abi.ts` +
  `contract-read/write/admin.service.ts` + models; ao reimplantar, **atualizar endereços (e ABI) nos
  `environment.*.ts`**.
- **Firebase/API:** `firebase.*` e `apiBaseUrl` nos `environment.*.ts` são placeholders — auth real exige
  config; nos testes, mocke o SDK. Não cravar segredos no código.
- Estilo: o repo **não roda Prettier** no dApp — siga o estilo ao redor; **não reformate** arquivos alheios.
