# RW.BC.DApp

| Campo | Valor |
|---|---|
| Tipo | frontend-static |
| Linguagem principal | TypeScript 6.0 |
| Framework | Angular 22 (standalone, zoneless, signals) |
| Build | `ng build` → build estático (`dist/browser`) |
| Rede | BSC Mainnet (prod) / BSC Testnet (dev) / Localnet 1337 (local) |
| Deploy alvo | qualquer hospedagem de estático (SPA) — configurável via CI |

dApp do ecossistema BitChicken: permite ao usuário comprar ovos (gacha via Forge/VRF), gerenciar a granja (staking de casais NFT), negociar no marketplace, explorar o catálogo de espécies e administrar os contratos — tudo via carteira Web3 (Reown/WalletConnect) combinado com identidade Firebase (email + senha) e vínculo de carteira por SIWE.

## Entry Points

| Arquivo | Papel |
|---|---|
| `src/main.ts` | Bootstrap Angular (bootstrapApplication) |
| `src/app/app.config.ts` | Providers globais (roteador, HTTP, i18n, PrimeNG, Service Worker) |
| `src/app/app.routes.ts` | Definição de rotas com lazy loading e guards |
| `src/environments/environment.ts` | Configuração de produção (BSC Mainnet, API, Firebase) |
| `src/environments/environment.development.ts` | Configuração de desenvolvimento (BSC Testnet) |
| `src/environments/environment.local.ts` | Configuração local (chain Docker 1337, API local porta 5180) — **gitignored**; copie de `environment.local.example.ts` |

## Diretórios Principais

| Diretório | Conteúdo |
|---|---|
| `src/app/core/web3/` | Web3Service, ContractReadService, ContractWriteService, ContractAdminService, contract-write.helper, contract-abi, web3.models, web3-errors, web3.format, retry, explorer |
| `src/app/core/auth/` | AuthService (Firebase), AuthApiService, AccountStore, WalletLinkService, WriteGateService, WalletSyncPromptService, AuthDialogService, auth-token.interceptor, auth.models |
| `src/app/core/realtime/` | SignalrService (WebSocket SignalR), ForgeWaitService, ForgeApiService |
| `src/app/core/market/` | CoinGeckoService (cotação BNB/fiat) |
| `src/app/core/market-data/` | MarketDataService (leituras via API: listings, NFTs, staking, referral, transparência), market-data.models |
| `src/app/core/guards/` | authGuard, walletLinkedGuard, adminGuard |
| `src/app/core/layout/` | MainLayout (shell com navbar, toast, SEO) |
| `src/app/core/i18n/` | LanguageService, language.config (en-US / pt-BR) |
| `src/app/core/seo/` | SeoService (title, meta, og, hreflang, canonical, FAQ JSON-LD) |
| `src/app/core/errors/` | AppErrorHandler (handler global de erros) |
| `src/app/core/analytics/` | AnalyticsService (GA4 com consent-mode) |
| `src/app/core/ipfs/` | PinataUploadService (upload de imagens para IPFS via Pinata) |
| `src/app/core/referral/` | ReferralService (leitura/persistência de `?ref=` em localStorage) |
| `src/app/core/theme/` | ThemeService (dark/light mode, persistência) |
| `src/app/features/` | Páginas: home, store, farm, marketplace, collection, public-farm, transparency, admin, legal, not-found |
| `src/app/features/admin/panels/` | 7 painéis de admin decompostos: editions, nft, forge, vrf, staking, token, marketplace |
| `src/app/shared/` | Componentes reutilizáveis (ItemCard, EggHatch, TransactionDialog, TransactionWidget, WalletLinkDialog, QrCode, etc.), mappers, helpers de paginação |
| `public/i18n/` | Arquivos de tradução: `en-US.json`, `pt-BR.json` |

## Documentação Disponível

- [stack.md](./stack.md) — tecnologias, versões e arquitetura
- [funcionalidades.md](./funcionalidades.md) — funcionalidades por feature
- [regras-de-negocio.md](./regras-de-negocio.md) — regras e onde vivem no código
- [armadilhas.md](./armadilhas.md) — armadilhas comuns e correções
- [integracoes.md](./integracoes.md) — integrações externas e seus contratos de falha
