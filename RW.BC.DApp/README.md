# RW.BC.DApp — dApp BitChicken

dApp do **BitChicken**: interface web para o ecossistema de NFT na BNB Smart Chain. Lê e escreve nos
contratos diretamente do navegador (ethers v6 + Reown AppKit) e fala com a API de contas (`RW.BC.Api`)
via HTTP autenticado por Firebase JWT.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Angular 22 — zoneless, standalone, signals |
| UI | PrimeNG 21 (preset Aura) + Tailwind v4 |
| Web3 | ethers v6 + Reown AppKit (wallet connect) |
| Auth | Firebase Web SDK (email/senha) |
| Testes | Vitest via `@angular/build:unit-test` |
| i18n | `@ngx-translate` — locales em `public/i18n/` |

## Estrutura de pastas

```
src/app/
  core/
    auth/          # AuthService (Firebase), AuthApiService, WalletLinkService (SIWE),
                   # account.store, write-gate, auth-token.interceptor
    guards/        # authGuard, walletLinkedGuard, adminGuard
    web3/          # Web3Service (Reown AppKit), ContractReadService, ContractWriteService,
                   # ContractAdminService, contract-abi.ts, web3.models.ts, web3.format.ts
    i18n/          # TranslateService config
    layout/        # MainLayout (navbar, shell)
    market/        # CoinGecko BNB→fiat
    market-data/   # MarketDataService
    realtime/      # SignalR (SignalrService, ForgeApiService)
    theme/         # ThemeService
    referral/      # ReferralService
    ipfs/          # PinataUploadService
  features/
    store/         # Loja de ovos (apenas ovos; ações on-chain via write-gate)
    farm/          # Granja — staking, casais, produção BCKN (rota privada)
    marketplace/   # Compra/venda de NFTs
    collection/    # Coleção do usuário
    public-farm/   # Granja pública (read-only)
    home/          # Página inicial
    auth/          # login, signup
    admin/         # Painel administrativo (adminGuard)
    transparency/  # Dados on-chain de transparência
    legal/         # Termos e privacidade
    not-found/     # 404
  shared/
    components/    # AmbientBackground, ThemeToggle, LanguageSwitcher, TransactionWidget, …
    directives/    # ImageFallbackDirective
    art-url.ts, gender.ts, rarity.ts, pagination.ts, staking-yield.ts, …
src/environments/
  environment.ts               # Produção (BSC mainnet)
  environment.development.ts   # Testnet BSC (padrão do ng serve)
  environment.local.ts         # Chain Docker local (chainId 1337) + API local
src/testing/
  web3-fakes.ts    # Fakes de ContractService/Web3Service para testes
  auth-fakes.ts    # Fakes de AuthService/AuthApiService
  i18n-testing.ts  # Utilitário TranslateModule stub
```

## Como rodar

Pré-requisito: **Node 24** (`nvm use 24`).

```bash
cd RW.BC.DApp
npm install

npm start            # ng serve → testnet BSC (config development)
npm run start:local  # ng serve → chain Docker local (config local)
npm run build        # build de produção (BSC mainnet)
npm run build:local  # build apontando para a chain Docker local
npm test             # ng test (Vitest, cobertura obrigatória)
npm run lint         # ESLint (Angular + TypeScript)
npm run check:abi-drift  # verifica se contract-abi.ts divergiu do ABI gerado pelo Hardhat
npm run lint:i18n        # valida se todas as chaves existem nos dois locales
```

Para o ambiente completo (chain local + API + indexer):

```bash
dotnet run --project ../RW.BC.AppHost
```

Isso sobe anvil, implanta os contratos, funda carteiras dev, inicia o indexer e serve o dApp em
`http://localhost:4200` apontando para `environment.local.ts`. Ver `RW.BC.AppHost/README.md`.

## Auth e roteamento

- Cadastro/login por **email e senha** (Firebase Web SDK). A carteira fica vinculada separadamente via
  SIWE (assinatura off-chain), não há custódia de chave privada na API.
- `/granja` é privada (`authGuard` + `walletLinkedGuard`).
- Ações on-chain (comprar ovo, listar NFT, etc.) passam pelo `write-gate`: exigem login + carteira
  vinculada; caso contrário, abre o modal de sincronização.

## i18n

Textos visíveis ao usuário sempre por chave `TranslateService`; nunca cravados no template. Os locales
ficam em `public/i18n/en-US.json` e `public/i18n/pt-BR.json`. Toda nova chave deve existir nos **dois**
arquivos (use `npm run lint:i18n` para verificar).

## Sync de ABI (armadilha principal)

O arquivo `src/app/core/web3/contract-abi.ts` é um **subconjunto manual** da ABI gerada pelo Hardhat.
Ao mudar a interface de qualquer contrato:

1. Atualize `contract-abi.ts` com os fragmentos novos/alterados.
2. Atualize `contract-read.service.ts`, `contract-write.service.ts` ou `contract-admin.service.ts`
   conforme a assinatura da função.
3. Atualize os modelos em `web3.models.ts` se necessário.
4. Se reimplantar, atualize os endereços em `src/environments/environment.*.ts`.
5. Rode `npm run check:abi-drift` para confirmar que não há divergência silenciosa.

## Testes e cobertura

O runner é **sempre** `ng test` (builder `@angular/build:unit-test`). Nunca rode `vitest` diretamente.

Limites impostos no `angular.json` (falha o CI se não atingir):

| Métrica | Mínimo |
|---|---|
| Statements | 100% |
| Functions | 100% |
| Lines | 100% |
| Branches | 98% |

Padrões de mock: `src/testing/web3-fakes.ts`, `src/testing/auth-fakes.ts`,
`src/testing/i18n-testing.ts`. Mocke `firebase/auth` e `@reown/appkit`/`ethers` com `vi.mock(...)`.
Toda mudança de código vem acompanhada do `.spec.ts` correspondente.
