# Integrações — RW.BC.DApp

## Visão Geral

| Serviço | Direção | Protocolo | Criticidade | Tratamento de falha |
|---|---|---|---|---|
| Reown AppKit / WalletConnect | Saída (modal) | EIP-1193 / WalletConnect v2 | Alta — sem ela não há conexão de carteira | `connect()` retorna `false`; componentes verificam `isConnected()` antes de agir |
| BSC RPC (leitura) | Saída | JSON-RPC over HTTPS | Alta — leituras de contrato | `FallbackProvider` com múltiplos endpoints; `withRetry` (3x, exp. jitter); `safeRead` retorna fallback |
| BSC RPC (escrita) | Saída | JSON-RPC over HTTPS (via signer) | Alta — transações | `toTransactionError` mapeia códigos ethers; toast de erro exibido ao usuário |
| Firebase Auth | Saída | HTTPS (SDK Firebase Web v12) | Alta — autenticação da identidade | Falha no login/signup lança exceção capturada no componente de auth |
| RW.BC.Api (REST) | Saída | HTTPS + Firebase JWT Bearer | Alta — contas, dados on-chain indexados | `HttpErrorResponse` capturado; erros de wallet-link mapeados para `WalletLinkError` com chave i18n |
| RW.BC.Api (SignalR) | Bidirecional | WebSocket (via @microsoft/signalr) | Média — realtime marketplace e forge | `withAutomaticReconnect()`; fallback para polling API/on-chain após 45 s |
| CoinGecko API | Saída | HTTPS REST | Baixa — cotação BNB/fiat | Falha silenciosa; retorna último valor cacheado ou `null`; retry 3x |
| Pinata (IPFS upload) | Saída | HTTPS multipart/form-data | Baixa — upload de arte (só admin) | Lança `Error` com mensagem descritiva; exibido no painel admin |
| Google Analytics (GA4) | Saída | HTTPS (gtag.js) | Baixa — telemetria | Desabilitado sem consent; sem consent, nenhum evento é enviado |
| BSCScan / Otterscan | Saída (link) | HTTPS (abre em nova aba) | Baixa — explorador de tx | Link gerado por `explorer.ts` sem chamada HTTP; falha = link inválido |

---

## Reown AppKit / WalletConnect

**Configuração:** `core/web3/web3.service.ts` (construtor; `createAppKit`)

- Rede resolvida em runtime: `appKit.local = true` → chain local 1337; `production = true` → `bsc`; senão → `bscTestnet`
- `projectId`: `environment.reown.projectId` (placeholder nos `environment.*.ts` versionados; preencha com seu próprio project ID do [cloud.reown.com](https://cloud.reown.com))
- Features desabilitadas no modal: swaps, onramp, send, receive, history
- Sincroniza tema dark/light via `effect(() => appKit.setThemeMode(...))`
- `getSigner()` valida chainId antes de retornar; lança `Web3Error WRONG_NETWORK` se rede incorreta

---

## Contratos BSC (leitura — ContractReadService)

**Configuração:** `environment.*.ts` (`rpcUrl`, `rpcUrls`, `contracts.*`)

- **Produção:** FallbackProvider com 3 endpoints: `bsc-dataseed.binance.org`, `bsc-dataseed1.defibit.io`, `bsc-dataseed1.ninicoin.io`
- **Desenvolvimento:** FallbackProvider com 2 endpoints públicos da testnet
- **Local:** JsonRpcProvider único em `http://localhost:8545`
- Cache TTL 30 s para `getMintTiers()`, `getCatalog()` e inventário por endereço
- Método `safeRead<T>(fn, fallback)` absorve qualquer erro e retorna fallback — usado para getters opcionais

Contratos acessados (endereços em `environment.contracts`):

| Variável | Contrato |
|---|---|
| `contracts.token` | BitChicken Token (BCKN ERC-20) |
| `contracts.nft` | BitChicken NFT (ERC-721) |
| `contracts.staking` | BitChicken Staking |
| `contracts.marketplace` | BitChicken Marketplace |
| `contracts.forge` | BitChicken Forge (VRF gacha) |

---

## Contratos BSC (escrita — ContractWriteService / ContractAdminService)

**Configuração:** `environment.contracts.*` + signer via `Web3Service.getSigner()`

- Helper `executeWrite<T>` centraliza o ciclo: `awaitingSignature → submitting → confirming` (1 confirmação)
- `toTransactionError` mapeia: `ACTION_REJECTED → USER_REJECTED`, `INSUFFICIENT_FUNDS`, `CALL_EXCEPTION`, `NETWORK_ERROR`; demais → `TRANSACTION_FAILED`
- `web3-errors.ts`: `describeError()` traduz `Web3Error` e erros de revert (`revert.name` ou `errorName`) para chaves i18n

---

## Firebase Auth

**Configuração:** `environment.*.ts` (campo `firebase`: `apiKey`, `authDomain`, `projectId`, `appId`)

- SDK Web SDK v12 (`firebase/app`, `firebase/auth`)
- App inicializado uma única vez via `getApps()` (guard contra re-inicialização)
- Fluxo: `createUserWithEmailAndPassword` / `signInWithEmailAndPassword` → `onIdTokenChanged` → `AccountStore` chama `GET /accounts/me`
- `getIdToken(user)` chamado pelo `authTokenInterceptor` a cada requisição para `apiBaseUrl`

---

## RW.BC.Api (REST)

**Configuração:** `environment.apiBaseUrl`

| Endpoint | Serviço consumidor | Payload / Resposta |
|---|---|---|
| `GET /accounts/me` | `AuthApiService` | `AccountDto { id, email, nickname, walletAddress, walletLinked }` |
| `POST /accounts/me/wallet/nonce` | `AuthApiService` | `WalletNonceDto { message, nonce, expiresAt }` |
| `POST /accounts/me/wallet` | `AuthApiService` | `LinkWalletDto { address, signature }` → `AccountDto` |
| `DELETE /accounts/me/wallet` | `AuthApiService` | → `AccountDto` |
| `GET /marketplace/listings` | `MarketDataService` | `PagedResponse<ListingDto>` (filtro Gridify, orderBy) |
| `GET /editions` | `MarketDataService` | `PagedResponse<EditionDto>` |
| `GET /accounts/:addr/nfts` | `MarketDataService` | `PagedResponse<NftItemDto>` |
| `GET /accounts/:addr/staking` | `MarketDataService` | `PagedResponse<StakingPairDto>` |
| `GET /accounts/:addr/referral` | `MarketDataService` | `ReferralInfoDto` |
| `GET /accounts/:addr/forge-requests` | `ForgeApiService` | `PagedResponse<ForgeRequestDto>` |
| `GET /transparency/summary` | `MarketDataService` | `TransparencySummaryDto` |
| `GET /transparency/sales` | `MarketDataService` | `PagedResponse<SaleDto>` |

- Autenticação: Bearer token Firebase injetado pelo `authTokenInterceptor` apenas em URLs com prefixo `apiBaseUrl`
- Todos os campos numéricos grandes na resposta são **strings** (`tokenId`, `price`, `editionId`, etc.)

---

## RW.BC.Api (SignalR — Realtime)

**Configuração:** `environment.apiBaseUrl` + hub path `/hubs/events`

- `SignalrService` gerencia conexão única com `withAutomaticReconnect()`
- **Eventos recebidos:**
  - `marketChanged` → `{ count, maxBlock }` — marketplace recarrega listings (debounce 300 ms)
  - `forgeFulfilled` → `{ requestId, tokenId, editionId }` — resolve promessa em `ForgeWaitService`
- **Comandos enviados ao hub:**
  - `Subscribe(address)` — inscreve endereço para receber `forgeFulfilled`
  - `Unsubscribe(address)` — desinscreve após receber fulfillment
- `ForgeWaitService` timeout: 45 s → fallback API → fallback polling on-chain

---

## CoinGecko API

**Configuração:** `environment.coingecko` (`baseUrl`, `demoApiKey`)

- Endpoint: `GET /simple/price?ids=binancecoin&vs_currencies=<fiat>&include_24hr_change=true`
- API key opcional (`x_cg_demo_api_key`); sem ela, sujeito a rate limit do plano gratuito
- Retry com `withRetry` (3 tentativas, base 1000 ms)
- Cache por moeda (`Map<string, number>`) com TTL de 60 s
- Deduplicação: chamadas simultâneas para a mesma moeda compartilham a mesma `Promise` em voo (`inflight` Map)

---

## Pinata (IPFS)

**Configuração:** JWT armazenado em `localStorage` pelo painel admin (`PinataUploadService.setJwt()`)

- Endpoint: `POST https://api.pinata.cloud/pinning/pinFileToIPFS`
- Usado exclusivamente no painel admin para upload de imagem de nova edição NFT
- JWT não é parte do `environment.ts` — configurado pelo operador em runtime na UI
- Retorno: `IpfsHash` string → armazenado como `artURI` da edição

---

## Google Analytics (GA4)

**Configuração:** `environment.analytics` (`measurementId`, `enabled`)

- Habilitado apenas em produção (`enabled: true`)
- Respeita Consent Mode v2: `analytics_storage: 'denied'` por padrão; atualizado para `'granted'` se usuário aceitar
- Consent persiste em `localStorage` (`bitchicken.consent`)
- Eventos rastreados: `page_view` (cada NavigationEnd) e `login` (method: `web3_wallet`)
- `setUser`: hash SHA-256 do endereço da carteira (nunca o endereço raw)
