# Integrações — RW.BC.Api

## Tabela de integrações

| Serviço | Direção | Protocolo | Criticidade | Tratamento de falha |
|---|---|---|---|---|
| Firebase Auth (OIDC) | Entrada (auth) | HTTPS / JWT Bearer | Crítica — sem auth, endpoints protegidos retornam 401 | Falha no discovery OIDC impede autenticação; sem fallback local |
| PostgreSQL (schema `public`) | Saída (leitura + escrita) | TCP / Npgsql | Crítica — sem DB, provisionamento e wallet-link falham | `EnableRetryOnFailure(3, 5s)`; `InfrastructureException` → 503 |
| PostgreSQL (schema `indexer`) | Saída (somente leitura) | TCP / Npgsql | Alta — sem indexer, read-models retornam vazios | Views ausentes (`42P01`) tratadas silenciosamente; dados simplesmente não aparecem |
| PostgreSQL LISTEN/NOTIFY | Saída (conexão dedicada) | TCP / Npgsql | Média — sem LISTEN, realtime cai para polling de 5 s | `BackgroundService` reconecta em 5 s; falha não afeta endpoints REST |
| RW.BC.DApp (Angular) | Entrada (clientes HTTP) | HTTPS + WebSocket (SignalR) | Alta — é o principal consumidor da API | CORS configurado por `Cors:Origins`/`AllowedHostSuffixes`; 401/422/5xx mapeados para ProblemDetails |
| Ponder (indexador on-chain) | Indireto (via DB compartilhado) | Sem chamada direta | Alta — sem Ponder, schema `indexer` fica desatualizado | API não detecta lag do indexador; retorna dados desatualizados silenciosamente |

---

## Firebase Auth — validação de JWT

**Tipo:** Identity Provider externo (Google Firebase).

**Configuração:**
- Seção `Identity:Firebase:ProjectId` em `appsettings.json` / secrets.
- `AddFirebaseJwtBearer` (em `Api/Identity/FirebaseJwtExtensions.cs`) configura `JwtBearer` com:
  - `MetadataAddress`: `https://securetoken.google.com/<projectId>/.well-known/openid-configuration`
  - `ValidIssuer`: `https://securetoken.google.com/<projectId>`
  - `ValidAudience`: `<projectId>`
  - `MapInboundClaims = false`
- Claims mapeados: `user_id` (→ `ICurrentUser.Id`), `email`, `name` (displayName).

**Fluxo:**
1. dApp autentica no Firebase Web SDK (email/senha).
2. Firebase retorna ID token (JWT).
3. dApp envia `Authorization: Bearer <token>` na API.
4. `JwtBearer` middleware valida assinatura, issuer, audience e expiração via OIDC discovery.
5. `AccountProvisioningMiddleware` extrai claims e garante `Account` no DB.

**Dependência em runtime:** API precisa de acesso à internet para buscar as chaves públicas do Firebase no primeiro uso (e após rotação de chaves). Sem acesso HTTPS a `securetoken.google.com`, novos tokens não são validados.

---

## PostgreSQL — schema `public` (domínio)

**Tipo:** Banco de dados relacional gerenciado (PostgreSQL 17).

**Configuração:**
- Connection string nomeada `"bitchicken"` (chave `ConnectionStrings:bitchicken` em appsettings/Aspire).
- `UseSnakeCaseNamingConvention()` — todas as colunas e tabelas em snake_case.
- `MigrationsHistoryTable = "_migrations_history"` no schema `public`.

**Tabelas (gerenciadas por EF migrations):**

| Tabela | Aggregate | Descrição |
|---|---|---|
| `public.accounts` | `Account` | Id (Firebase UID), email (unique), nickname, status, wallet_address (unique, nullable), wallet_linked_at, created_at, updated_at |
| `public.wallet_link_nonces` | `WalletLinkNonce` | AccountId (PK = FK lógico), nonce, message, expires_at, created_at, updated_at |

**Índices:**
- `ix_accounts_email` (unique) — impede duplicata de e-mail entre UIDs diferentes.
- `ix_accounts_wallet_address` (unique) — impede vínculo da mesma carteira em duas contas.

**Resiliência:** `EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null)` no Npgsql.

---

## PostgreSQL — schema `indexer` (read-models Ponder)

**Tipo:** Views e tabelas populadas pelo `RW.BC.Indexer` (Ponder). A API tem acesso **somente leitura**.

**Configuração:** Mesma connection string `"bitchicken"` — o Ponder escreve no schema `indexer` do mesmo banco.

**Views/tabelas mapeadas (EF `ToView`):**

| View | Chave | Uso na API |
|---|---|---|
| `indexer.editions` | `edition_id` | `GET /editions` |
| `indexer.nfts` | `token_id` | `GET /accounts/{address}/nfts` |
| `indexer.listings` | `token_id` | `GET /marketplace/listings` (só `status="Active"`) |
| `indexer.staking_pairs` | `pair_id` | `GET /accounts/{address}/staking` (só `status="Staked"`) |
| `indexer.forge_requests` | `request_id` | `GET /accounts/{address}/forge-requests` |
| `indexer.sales` | `id` (text) | `GET /transparency/sales` |
| `indexer.referral_links` | `buyer` | Referral — upline e contagem |
| `indexer.referral_registrations` | (EF, usado via LINQ) | Referral — código do referral |

**Tabelas acessadas via SQL raw:**
- `indexer.referral_bnb_accruals` (`SUM(amount) WHERE referrer = $1` — BNB acumulado)
- `indexer.referral_bnb_claims` (`SUM(amount) WHERE referrer = $1` — BNB sacado)
- `indexer.token_transfers` (`SUM(value)` — total BCKN)

**Campos `numeric(78,0)`:** tokenId, price, supply, block numbers — mapeados como `BigInteger` (ou `long` apenas para block numbers via `BigIntegerConverters.Block`).

**Degradação:** Se o schema `indexer` não existe, `42P01` é capturado nos detectors de realtime; nas queries EF, a ausência da view causa erro ao materializar — verificar se Ponder rodou ao menos uma vez.

---

## Nethereum — verificação de assinatura SIWE

**Tipo:** Biblioteca .NET para interação com Ethereum (só `Nethereum.Signer` utilizado).

**Localização:** `Infrastructure.Persistence/Security/NethereumSignatureVerifier.cs`

**Uso:** `EthereumMessageSigner.EncodeUTF8AndEcRecover(message, signature)` — recupera o endereço público a partir da mensagem e assinatura ECDSA. Nenhuma chamada de rede; operação 100% local.

**Configuração:** Nenhuma — instância singleton, sem dependência de RPC.

---

## SignalR — canal de tempo real com o dApp

**Tipo:** Protocolo WebSocket/Server-Sent Events (ASP.NET Core SignalR).

**Endpoint:** `/hubs/events`

**Fluxo do cliente (dApp):**
1. Conecta ao hub SignalR.
2. Chama `Subscribe(walletAddress)` para entrar no grupo do seu endereço.
3. Escuta eventos:
   - `"marketChanged"` → `{ count: long, maxBlock: long }` — enviado a `Clients.All`.
   - `"forgeFulfilled"` → `{ requestId: string, tokenId: string, editionId: string }` — enviado ao grupo do comprador.

**BackgroundService (`MarketplaceEventsListener`):**
- Abre conexão Npgsql dedicada e emite `LISTEN indexer_live_query`.
- Fallback de polling a cada 5 s caso o NOTIFY não chegue.
- Detector de listings compara snapshot (`count`, `maxBlock`) — publica `marketChanged` somente se alterado.
- Detector de forge usa cursor (`LastFulfilledAtBlock`) — itera novos fulfillments e publica `forgeFulfilled` por grupo.

**Tratamento de falha:** `try/catch` no `ExecuteAsync` com log de erro e `Task.Delay(5s)` antes de reconectar. Falha no LISTEN não derruba os endpoints REST.

---

## .NET Aspire — orquestração de dev local

**Tipo:** Tooling de ambiente (não é dependência de produção direta).

**Projeto:** `RW.BC.AppHost` (raiz do monorepo, fora de `RW.BC.Api/`).

**Responsabilidade:**
- Sobe PostgreSQL 17 com `ContainerLifetime.Persistent` (dados sobrevivem a reinicializações).
- Injeta a connection string `"bitchicken"` via service discovery do Aspire.
- Sobe a API em modo de desenvolvimento.
- Sobe o indexador Ponder, o dApp Angular e o Otterscan (explorador local).

**Configuração em produção:** Connection string `"bitchicken"` configurada via variável de ambiente / Azure Key Vault — sem Aspire.
