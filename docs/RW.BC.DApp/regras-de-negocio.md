# Regras de Negócio — RW.BC.DApp

| Regra | Localização (arquivo:linha) | Impacto se violada |
|---|---|---|
| Nome do NFT: alfanumérico + espaço, 1–24 chars | `features/store/store.ts:31` (`NFT_NAME_PATTERN`) | Botão de confirmar fica desabilitado; transação não é enviada |
| Código de referral deve ser inteiro positivo e não expirado (TTL 30 dias) | `core/referral/referral.service.ts:6,48,56` | Referral ignorado silenciosamente; `requestObtain` recebe `0n` |
| Compra de ovo requer saldo BNB ≥ preço do tier + gas | `core/web3/contract-write.service.ts:38–72` | `Web3Error INSUFFICIENT_FUNDS`; mensagem de toast |
| Gas de `requestObtain` é estimado x2; fallback 3 000 000 | `core/web3/contract-write.service.ts:50–55` (`OBTAIN_RANDOM_GAS_MULTIPLIER`, `OBTAIN_RANDOM_GAS_FALLBACK`) | Gas insuficiente fará a tx on-chain falhar (VRF consome gás variável) |
| Aguardar fulfillment do Forge via SignalR com timeout de 45 s | `core/realtime/forge-wait.service.ts:7` (`PUSH_TIMEOUT_MS`) | Após timeout, fallback para API e depois polling on-chain; se tudo falhar, `Web3Error TRANSACTION_FAILED` |
| Staking exige par macho + fêmea (validado on-chain) | `features/farm/farm.ts:87–91` (computed `canStake`, `maleNfts`, `femaleNfts`) + contrato | `GendersNotComplementary` revert; mensagem de erro no toast |
| Colheita (`claim`) só habilitada se `pendingYield > 0` e `nextUnlock` atingido | `features/farm/farm.ts:159` (`canClaim`) | Botão desabilitado; se enviada mesmo assim, contrato reverte com `CycleNotElapsed` |
| Write gate: escrita on-chain requer login Firebase + carteira vinculada | `core/auth/write-gate.service.ts:16–27` | Abre modal de login e/ou modal de vínculo de carteira; retorna `not_authenticated` ou `not_linked` |
| Guard `/granja`: requer `authGuard` (login) + `walletLinkedGuard` (carteira vinculada) | `app.routes.ts:45–48` | Redireciona para `/` após abrir modal de login |
| Guard `/admin`: carteira conectada E endereço == `environment.admin` (case-insensitive) | `core/guards/admin-guard.ts:12–14` | Redireciona para `/` |
| ABI em `contract-abi.ts` é subconjunto manual e deve sincronizar com os contratos | `core/web3/contract-abi.ts` | Chamadas falham silenciosamente ou retornam dados incorretos se ABI desatualizada |
| Endereços de contrato em `environment.*.ts` devem refletir o deploy ativo | `src/environments/environment.*.ts` (campo `contracts`) | Todas as operações on-chain apontam para contrato errado (ou endereço zero) |
| Preço de listagem no marketplace deve ser > 0 | `features/marketplace/marketplace.ts:130–132` (`isListPriceValid`) | Botão de confirmar listagem desabilitado |
| Reconhecimento pós-transação no marketplace usa `RECONCILE_DELAYS [1500, 3000, 6000]` ms | `features/marketplace/marketplace.ts:51` | Lista pode exibir estado desatualizado transitoriamente |
| `authTokenInterceptor` injeta Bearer token Firebase apenas em chamadas para `apiBaseUrl` | `core/auth/auth-token.interceptor.ts:7–9` | Requisições para APIs externas (CoinGecko) nunca recebem o token de auth |
| Firebase SDK inicializado uma única vez via `getApps()` | `core/auth/auth.service.ts:6–9` (`resolveApp`) | Múltiplas inicializações lançariam erro de app Firebase duplicado |
| `ContractReadService.safeRead` retorna fallback sem lançar | `core/web3/contract-read.service.ts:328–334` | Getters opcionais (ex.: `isStaked`, `tokenData`) não quebram carregamento do inventário |
| FallbackProvider (múltiplos RPCs) ativado quando `rpcUrls.length > 1` | `core/web3/contract-read.service.ts:47–62` (`buildProvider`) | Se RPC primário cair com FallbackProvider, leituras continuam; sem ele, UI trava |
| Retry exponencial com jitter (3 tentativas, base 500 ms, max 8 s) aplicado a leituras transientes | `core/web3/retry.ts` | RPC flaky causa falha imediata em vez de retry |
| `PinataUploadService` requer JWT configurado na sessão (localStorage); ausência lança erro explícito | `core/ipfs/pinata-upload.service.ts:18` | Upload de arte de nova edição falha com mensagem clara para o admin |
| Vínculo de carteira SIWE: nonce expira e retorna HTTP 410 | `core/auth/auth-api.service.ts:40–43` | `WalletLinkError` com código `NONCE_EXPIRED` exibido ao usuário |
| Vínculo de carteira SIWE: carteira já vinculada retorna HTTP 409 | `core/auth/auth-api.service.ts:41` | `WalletLinkError` com código `WALLET_ALREADY_LINKED` |
| `AccountStore` não re-hidrata se `uid` não mudou (deduplicação) | `core/auth/account.store.ts:21–23` (`hydratedUid`) | Evita loop de chamadas a `GET /accounts/me` em re-renderizações |
| Analytics (GA4): eventos só são enviados se consent foi concedido pelo usuário | `core/analytics/analytics.service.ts:65–68` | Sem consent, nenhum dado de uso é transmitido ao Google Analytics |
| Cotação BNB expirada após 60 s; nova chamada feita automaticamente | `core/market/coingecko.service.ts:62` (`CACHE_TTL_MS`) | Preço fiat exibido pode estar desatualizado em até 60 s |
