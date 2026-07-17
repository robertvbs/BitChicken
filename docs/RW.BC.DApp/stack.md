# Stack — RW.BC.DApp

## Dependências de Produção

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Framework | Angular | ^22.0.0 | Zoneless, standalone, signals — sem NgModules |
| Linguagem | TypeScript | ~6.0.2 | Strict mode |
| UI — componentes | PrimeNG | ^21.1.9 | Instalado via `legacy-peer-deps` (peer-dep com Angular 22) |
| UI — temas | @primeng/themes (Aura) | ^21.0.4 | Preset `BitchickenPreset` customizado em `app.config.ts` |
| UI — ícones | PrimeIcons | ^7.0.0 | |
| UI — layout | Tailwind CSS v4 | ^4.1.12 | Com PostCSS e preset `tailwindcss-primeui` |
| Web3 — wallet | Reown AppKit | ^1.8.20 | Modal WalletConnect/injected; `EthersAdapter` |
| Web3 — adapter | @reown/appkit-adapter-ethers | ^1.8.20 | |
| Web3 — contratos | ethers | ^6.16.0 | JsonRpcProvider (leitura), BrowserProvider/JsonRpcSigner (escrita) |
| Auth | Firebase Web SDK | ^12.15.0 | Email + senha; validação de JWT na API |
| Realtime | @microsoft/signalr | ^10.0.0 | Hub `/hubs/events` (marketChanged, forgeFulfilled) |
| i18n | @ngx-translate/core | ^18.0.0 | Dois locales: en-US e pt-BR em `public/i18n/*.json` |
| i18n — loader | @ngx-translate/http-loader | ^18.0.0 | Carrega `public/i18n/<lang>.json` |
| 3D — ovo | three | ^0.184.0 | Cena 3D do ovo na loja (EggScene) |
| QR code | qrcode | ^1.5.4 | QR do link de referral na granja |
| HTTP | RxJS | ~7.8.0 | Usado no HttpClient (interceptor, firstValueFrom) |
| PWA | @angular/service-worker | ^22.0.0 | Ativo apenas em produção |

## Dependências de Desenvolvimento

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Build | @angular/build / @angular/cli | ^22.0.1 | Builder `application` e `unit-test` |
| Compilador | @angular/compiler-cli | ^22.0.0 | |
| Testes | Vitest | ^4.0.8 | Via builder Angular (`ng test`), não CLI do Vitest diretamente |
| Cobertura | @vitest/coverage-v8 | ^4.1.8 | 100% statements/funcs/lines, 98% branches (impostos em `angular.json`) |
| DOM (testes) | jsdom | ^28.0.0 | Ambiente de testes no Node |
| CSS build | @tailwindcss/postcss | ^4.1.12 | |
| Formatação | Prettier | ^3.8.1 | Disponível mas **não integrado em hooks** — não reformate arquivos alheios |

## Arquitetura

**Padrão:** Angular 22 standalone + signals + `ChangeDetectionStrategy.OnPush` em todos os componentes. Sem NgModules, sem Zone.js. Estado local via `signal()` e `computed()`; efeitos via `effect()`. Lazy loading em todas as rotas (exceto MainLayout).

**Divisão de responsabilidade Web3:**
- `ContractReadService` — lê contratos via `JsonRpcProvider` (sem signer); cache TTL 30s para tiers/catálogo/inventário; `safeRead` com fallback tolerante a erros.
- `ContractWriteService` — transações do usuário (comprar ovo, staking, marketplace); usa `executeWrite` helper com ciclo `awaitingSignature → submitting → confirming`.
- `ContractAdminService` — operações `onlyOwner`; provisionado por rota (não root-level) só na rota `/admin`.
- `contract-write.helper.ts` — helper `executeWrite<T>` genérico + `toTransactionError` (mapeia códigos ethers para `Web3Error`).

**Leituras de dados on-chain:** maioria das leituras pesadas (NFTs, staking, listings, referral) é feita via `MarketDataService` que consome a API REST (`RW.BC.Api`) — alimentada pelo indexador Ponder. Leituras diretas de contrato ficam restritas a dados dinâmicos (pendingYield, nextUnlock) e configurações de admin.

**Deploy alvo:** build estático (`ng build`), publicável em qualquer hospedagem de SPA. Service Worker ativo em produção (`ngsw-worker.js`).

**Node:** requer **Node 24** (`nvm use 24`). Node 20 não é suportado pelo Angular 22/Hardhat 3.
