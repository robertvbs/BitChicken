# Funcionalidades — RW.BC.Api

## 1. JIT Provisioning de conta

- **Entrada:** Qualquer requisição autenticada com Firebase JWT válido.
- **Arquivos principais:**
  - `src/RW.BC.Api/Identity/AccountProvisioningMiddleware.cs`
  - `src/RW.BC.Application/Accounts/Commands/EnsureAccountProvisioned/EnsureAccountProvisionedHandler.cs`
- **Comportamento:**
  - O `AccountProvisioningMiddleware` é executado antes de cada handler quando o usuário está autenticado.
  - Extrai `user_id` (ou `sub` como fallback), `email` e `name` dos claims JWT.
  - Invoca `EnsureAccountProvisionedCommand` via `IMessageBus.InvokeAsync`.
  - O handler verifica idempotência por `ExistsByIdAsync` antes de criar; em race condition de PK, a exceção é absorvida silenciosamente (idempotência).
  - Se o e-mail já existe com UID diferente, lança `ConflictException` → 409.
  - Nickname derivado do `displayName` do Firebase; se inválido, derivado do local-part do e-mail (sanitizado com `_`).
- **Regras:**
  - Não existe `POST /accounts` — criação é automática e transparente.
  - `Account.Create` (factory method) valida UID, email (`Email.Create`) e nickname no construtor.

---

## 2. Consultar minha conta

- **Entrada:** `GET /accounts/me` com Bearer token Firebase.
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/AccountEndpoints.cs` (rota)
  - `src/RW.BC.Application/Accounts/Queries/GetMyAccount/GetMyAccountHandler.cs`
  - `src/RW.BC.Application/Accounts/Dtos/AccountDto.cs`
- **Comportamento:**
  - Lê `ICurrentUser.Id` (claim `user_id`/`sub`) e invoca `GetMyAccountQuery`.
  - Retorna `AccountDto` (Id, Email, Nickname, Status, WalletAddress?, WalletLinked).
  - `Status` serializado como string snake_case upper (`ACTIVE`, `DISABLED`).
- **Regras:**
  - Requer autorização (`RequireAuthorization()`).
  - 404 se a conta não foi provisionada ainda (não deveria ocorrer com middleware JIT ativo).

---

## 3. Solicitar nonce para vínculo de carteira (SIWE)

- **Entrada:** `POST /accounts/me/wallet/nonce` com Bearer token Firebase.
- **Arquivos principais:**
  - `src/RW.BC.Application/Accounts/Commands/RequestWalletLinkNonce/RequestWalletLinkNonceHandler.cs`
  - `src/RW.BC.Application/Accounts/WalletLink/WalletLinkMessageBuilder.cs`
- **Comportamento:**
  - Se já existe nonce ativo (não expirado em 5 min), retorna o mesmo (`WalletLinkChallengeDto`: message, nonce, expiresAt).
  - Se expirado ou inexistente, gera nonce de 16 bytes hex via `RandomNumberGenerator`.
  - Constrói mensagem EIP-4361-like: `"Link this wallet to your BitChicken account\n\nAccount: <id>\nNonce: <nonce>\nIssued At: <utc>"`.
  - Persiste `WalletLinkNonce` (aggregate separado, chave = accountId).
- **Regras:**
  - Se carteira já vinculada, retorna 409 (`WalletAlreadyLinkedException`).
  - TTL do nonce: 5 minutos (`RequestWalletLinkNonceHandler.Ttl`).

---

## 4. Vincular carteira EVM (SIWE)

- **Entrada:** `POST /accounts/me/wallet` com `{ address, signature }` e Bearer token.
- **Arquivos principais:**
  - `src/RW.BC.Application/Accounts/Commands/LinkWallet/LinkWalletHandler.cs`
  - `src/RW.BC.Application/Accounts/Commands/LinkWallet/LinkWalletValidator.cs`
  - `src/RW.BC.Infrastructure.Persistence/Security/NethereumSignatureVerifier.cs`
- **Comportamento:**
  - Valida `address` (`^0x[0-9a-fA-F]{40}$`) e `signature` (`^0x[0-9a-fA-F]{130}$`) via FluentValidation → 422 se inválido.
  - Busca nonce ativo do account; se ausente ou expirado → 410 (`WalletLinkNonceUnavailableException`).
  - `NethereumSignatureVerifier.RecoverAddress` faz ECDSA EcRecover na mensagem do challenge.
  - Se endereço recuperado ≠ `address` fornecido → 422 (`WalletLinkSignatureInvalidException`).
  - Chama `account.LinkWallet(recovered)` — valida regex EVM no domínio.
  - Remove o nonce consumido e persiste; conflito de unicidade de carteira → 409 (`WalletAlreadyLinkedException`).
- **Regras:**
  - Anti-replay: nonce é removido no commit bem-sucedido.
  - Endereço salvo na forma recuperada pelo EcRecover (lowercase canônico).

---

## 5. Desvincular carteira

- **Entrada:** `DELETE /accounts/me/wallet` com Bearer token.
- **Arquivos principais:**
  - `src/RW.BC.Application/Accounts/Commands/UnlinkWallet/UnlinkWalletHandler.cs`
- **Comportamento:**
  - `account.UnlinkWallet()` zera `WalletAddress` e `WalletLinkedAt`.
  - Persiste e retorna `AccountDto` atualizado.
- **Regras:**
  - Sem validação extra; se carteira já desvinculada, a operação é idempotente (noop no domínio).

---

## 6. Listar edições do catálogo NFT

- **Entrada:** `GET /editions?page=&pageSize=&filter=&orderBy=` (público, sem auth).
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/EditionsEndpoints.cs`
  - `src/RW.BC.Application/Editions/Queries/GetEditions/GetEditionsHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/EditionQueryService.cs`
- **Comportamento:**
  - Lê view `indexer.editions` via EF Core + Gridify.
  - Retorna `PagedResponse<EditionDto>` com campos: id, name, artUri, health, skill, morale, rarity, maxSupply, minted, mintStart, mintEnd, price, distribution, active.
  - `maxSupply`, `minted`, `mintStart`, `mintEnd`, `price` são `string` (BigInteger em wei, 78 dígitos).
- **Regras:**
  - Paginação: page 1–200, pageSize 1–100, default 20.
  - Campos de filtro e orderBy validados pelo `PagedRequestValidator` → 422 se inválidos.

---

## 7. Listar NFTs de uma carteira

- **Entrada:** `GET /accounts/{address}/nfts?page=&pageSize=&filter=&orderBy=` (público).
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/NftsEndpoints.cs`
  - `src/RW.BC.Application/Nfts/Queries/GetAccountNfts/GetAccountNftsHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/NftQueryService.cs`
- **Comportamento:**
  - Lê view `indexer.nfts` filtrando por `owner == address` (case-insensitive — handler normaliza para lowercase).
  - Join com `indexer.editions` para enriquecer com `editionName`, `artUri`, `rarity`, atributos.
  - Retorna `PagedResponse<NftItemDto>`.
- **Regras:**
  - Inclui NFTs staked (campo `staked` no DTO).
  - Exclui NFTs burned (filtro `!n.Burned` aplicado no query service).

---

## 8. Listar listings ativos do marketplace

- **Entrada:** `GET /marketplace/listings?page=&pageSize=&filter=&orderBy=` (público).
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/MarketplaceEndpoints.cs`
  - `src/RW.BC.Application/Marketplace/Queries/GetListings/GetListingsHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/ListingQueryService.cs`
- **Comportamento:**
  - Filtra `indexer.listings` por `status == "Active"` (server-side, não exposto ao cliente).
  - LEFT JOIN com `indexer.nfts` e `indexer.editions` para enriquecer com metadados do NFT.
  - `DefaultOrderBy = "listedAtBlock desc"` aplicado quando `orderBy` ausente.
  - `price` retornado como `string` (BigInteger wei).
- **Regras:**
  - Listings cancelados ou comprados (`status != "Active"`) nunca chegam ao cliente.

---

## 9. Listar pares de staking de uma carteira

- **Entrada:** `GET /accounts/{address}/staking?page=&pageSize=&filter=&orderBy=` (público).
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/StakingEndpoints.cs`
  - `src/RW.BC.Application/Staking/Queries/GetAccountStaking/GetAccountStakingHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/StakingQueryService.cs`
- **Comportamento:**
  - Filtra `indexer.staking_pairs` por `staker == address` (lowercase) **e** `status == "Staked"` (server-side).
  - `DefaultOrderBy = "stakedAt desc"`.
  - Retorna `PagedResponse<StakingPairDto>` com pairId, maleId, femaleId, matched, stakedAt, lastClaimAt, status.
  - Campos BigInteger (`pairId`, `maleId`, `femaleId`, `stakedAt`, `lastClaimAt`) serializados como `string`.
- **Regras:**
  - Pares unstaked não aparecem na listagem.

---

## 10. Listar pedidos de forge de uma carteira

- **Entrada:** `GET /accounts/{address}/forge-requests?page=&pageSize=&filter=&orderBy=` (público).
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/ForgeEndpoints.cs`
  - `src/RW.BC.Application/Forge/Queries/GetAccountForgeRequests/GetAccountForgeRequestsHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/ForgeRequestQueryService.cs`
- **Comportamento:**
  - Lê `indexer.forge_requests` filtrando por `buyer == address` (todos os status).
  - Retorna `PagedResponse<ForgeRequestDto>` com requestId, tier, status, tokenId?, editionId?, blockNumber.
  - `tokenId` e `editionId` são `null` enquanto o VRF não cumpriu o pedido.

---

## 11. Informações de referral de uma carteira

- **Entrada:** `GET /accounts/{address}/referral` (público).
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/ReferralEndpoints.cs`
  - `src/RW.BC.Application/Referral/Queries/GetReferralInfo/GetReferralInfoHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/ReferralQueryService.cs`
- **Comportamento:**
  - Agrega múltiplas queries no schema `indexer`: código do referral, upline, contagem de indicados, total acumulado, total sacado, saldo pendente — valores em **BNB** (a recompensa de indicação migrou de BCKN para BNB; ver [ADR 0009](../meta/adr/0009-indicacao-bnb-um-nivel-por-rank.md)).
  - `pending = totalAccrued - totalClaimed` calculado em BigInteger no handler.
  - Todos os valores monetários retornados como `string` (wei). O nível/taxa do indicador é derivado da contagem no dApp.
- **Regras:**
  - `code` e `upline` podem ser `null` se o endereço nunca participou do programa.

---

## 12. Transparência — histórico de vendas

- **Entrada:** `GET /transparency/sales?page=&pageSize=&filter=&orderBy=` (público).
- **Arquivos principais:**
  - `src/RW.BC.Api/Endpoints/TransparencyEndpoints.cs`
  - `src/RW.BC.Application/Transparency/Queries/GetSales/GetSalesHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/SaleQueryService.cs`
- **Comportamento:**
  - Lê `indexer.sales` com Gridify.
  - Retorna `PagedResponse<SaleDto>` com tokenId, seller, buyer, price, platformFee, royalty, blockNumber.
  - Valores monetários como `string` (wei).

---

## 13. Transparência — resumo do ecossistema

- **Entrada:** `GET /transparency/summary` (público).
- **Arquivos principais:**
  - `src/RW.BC.Application/Transparency/Queries/GetSummary/GetSummaryHandler.cs`
  - `src/RW.BC.Infrastructure.Persistence/Repositories/Views/TransparencySummaryQueryService.cs`
- **Comportamento:**
  - Agrega: total de vendas (count), volume total (SUM price), contagem de NFTs vivos (!burned), contagem de edições, total de BCKN transferidos.
  - Resultado em cache `IMemoryCache` com TTL de 30 segundos (chave `"transparency:summary"`).
  - Volume e BCKN total via SQL raw (`ExecuteScalarAsync`) para evitar overflow de BigInteger em LINQ.
- **Regras:**
  - `InfrastructureException` (DB indisponível) → 503 no endpoint.

---

## 14. Notificações em tempo real (SignalR)

- **Entrada:** Conexão WebSocket em `/hubs/events`; método `Subscribe(address)`.
- **Arquivos principais:**
  - `src/RW.BC.Api/Hubs/EventsHub.cs`
  - `src/RW.BC.Api/Realtime/MarketplaceEventsListener.cs`
  - `src/RW.BC.Api/Realtime/ForgeFulfillmentDetector.cs`
  - `src/RW.BC.Api/Realtime/ListingsChangeDetector.cs`
- **Comportamento:**
  - `EventsHub.Subscribe(address)` adiciona conexão ao grupo `address.ToLowerInvariant()`.
  - `MarketplaceEventsListener` (BackgroundService) usa `LISTEN indexer_live_query` no Postgres.
  - A cada notificação (ou a cada 5 s de fallback), lê snapshot de `indexer.listings` e publica `"marketChanged"` para todos os clientes se houve mudança.
  - Detecta novos fulfillments do forge (`status = 'Fulfilled'`, cursor por `fulfilled_at_block`) e publica `"forgeFulfilled"` **somente** para o grupo do comprador.
- **Regras:**
  - Se a tabela `indexer.forge_requests` ou `indexer.listings` não existe (estado inicial), as consultas retornam silenciosamente (captura `42P01`).
  - Reconexão automática ao Postgres com delay de 5 s em caso de falha.
  - `Subscribe` valida regex EVM (`^0x[0-9a-fA-F]{40}$`); inválido → `HubException`.
