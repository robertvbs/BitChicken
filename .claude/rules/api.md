---
paths:
  - "RW.BC.Api/**"
  - "RW.BC.AppHost/**"
---

# Regras — RW.BC.Api + RW.BC.AppHost (backend .NET)

API de **contas** do BitChicken: **.NET 10 / C# 14** + **.NET Aspire** + **EF Core/PostgreSQL** +
**Firebase** (JWT validado localmente) + **Wolverine** (CQRS) em **Clean Architecture + Hexagonal**. Desacopla o
acesso ao sistema da carteira: conta por email/senha (apelido), e **vínculo de carteira via SIWE**
(assinatura ECDSA, sem custódia de chave).

## Comandos

> **Armadilha de ambiente (WSL):** este SDK falha o restore/build com `NETSDK1226` (prune data). Anexe
> **`-p:AllowMissingPrunePackageData=true`** a **todo** `dotnet restore/build/test` e `dotnet ef`.
> NÃO commitar esse flag em csproj/props — é workaround só do ambiente.

```bash
cd RW.BC.Api
dotnet build RW.BC.Api.slnx -p:AllowMissingPrunePackageData=true
dotnet test  RW.BC.Api.slnx -p:AllowMissingPrunePackageData=true   # xUnit + Testcontainers (precisa Docker)
dotnet ef migrations add <Nome> -p:AllowMissingPrunePackageData=true \
  --project src/RW.BC.Infrastructure.Persistence --startup-project src/RW.BC.Api

# E2E (precisa API no ar + Firebase real): scripts/*.sh (curl+jq) — valide com `bash -n`.
# Ambiente local completo num comando:
dotnet run --project RW.BC.AppHost -p:AllowMissingPrunePackageData=true   # ver RW.BC.AppHost/README.md
```

## Clean code — invariantes (bloqueadores)

- **`sealed` obrigatório** em Handlers, Repositories, Commands, Queries, Validators, Services concretos
  (toda classe não projetada para herança). Nosso código já segue (ex.: `sealed class EnsureAccountProvisionedHandler`).
- **Central Package Management:** versões só em `Directory.Packages.props`. **Proibido** `Version=` em
  `<PackageReference>`. `TreatWarningsAsErrors=true` (em `Directory.Build.props`) — warning quebra o build.
- **Zero comentários em `.cs`** exceto XML-doc onde o código já usa, `#region`/`#endregion` e
  `#pragma` tecnicamente justificado. Nomes auto-explicativos no lugar de comentário.
- **Vendor proibido onde já existe alternativa local:** **sem `MediatR`** (Wolverine é o mediator),
  **sem `Swashbuckle`** (docs via Scalar: `AddAppDocumentation` / `MapAppScalarApiReference` em `Api/Web/Documentation.cs`).
- **Domínio rico:** factory methods (`Account.Create`), invariantes no aggregate (lança `DomainException`),
  sem setters públicos anêmicos. Lance `DomainException` (kernel local `Domain/BuildingBlocks/`) ou
  `AppException`/`NotFoundException` (Application/Abstractions) — nunca `NotificationContext`.

## Arquitetura (Hexagonal)

- **Camadas** (`RW.BC.Api/src/`): `RW.BC.Domain` (aggregates — **zero** dep de EF/ASP.NET/mensageria;
  tipos próprios em `Domain/BuildingBlocks/`) · `RW.BC.Application` (CQRS Wolverine, ports, DTOs, validators,
  abstrações `IUnitOfWork`/`AppException`/`NotFoundException` em `Abstractions/`) ·
  `RW.BC.Infrastructure.Persistence` (EF Core, mappings snake_case, `AuditingInterceptor` local,
  `DbContextSaveChangesExtensions` local, `InfrastructureException` local, repos, migrations,
  `NethereumSignatureVerifier`) · `RW.BC.Api` (Minimal API endpoints, `Identity/`, `Web/`) · `RW.BC.ServiceDefaults`.
- **Kernel local (sem TC.Odin):** `Entity<TKey>`, `IAggregateRoot`, `IAuditable`, `Email`,
  `PrimitiveValidations`, `DomainException` em `Domain/BuildingBlocks/`. `ICurrentUser`/`HttpCurrentUser`/
  `IdentityClaims`/`FirebaseJwtExtensions`/`AccountProvisioningMiddleware` em `Api/Identity/`.
  `ProblemDetailsExceptionHandler`/`FluentValidationExceptionHandler`/`CorsExtensions`/`Documentation`/
  `JsonDefaults` em `Api/Web/`.
- **Ports** vivem em `RW.BC.Application/{feature}/Ports/` — **NUNCA** em `Domain/`. Implementações
  concretas em `Infrastructure.Persistence/` (repos) ou wired no `Program.cs`.
- **Feature-slice** em `Application`: cada feature auto-contém `Commands/{Name}/` (Command + Handler +
  Validator), `Queries/{Name}/`, `Dtos/`, `Ports/`. (Slices/handlers atuais: descubra por grep em
  `src/RW.BC.Application/` — não fixar a lista aqui.)
- **`RW.BC.AppHost`** é projeto **top-level separado** (raiz, fora da API) — orquestra o dev env via Aspire;
  csproj/nuget.config/slnx próprios; referencia a API cross-folder; resolve o Node mais novo (≥22).

## CQRS — Wolverine

- Endpoints (Minimal API) chamam `IMessageBus.InvokeAsync<TResult>(command, ct)`. Discovery em `Program.cs`
  via `opts.Discovery.IncludeAssembly(typeof(Application._Extensions.DIExtension).Assembly)`.
- **MediatorOnly (modo atual):** Wolverine roda com `opts.Durability.Mode = DurabilityMode.MediatorOnly` —
  sem durability agent, sem registro de nós, sem eleição de líder, sem inbox/outbox. Handlers chamam
  `unitOfWork.CommitAsync()` explicitamente; o Wolverine não gerencia transação. `WolverineFx.Postgresql`
  e `WolverineFx.EntityFrameworkCore` **não estão** referenciados.
- **Quando introduzir domain events:** religar `PersistMessagesWithPostgresql(..., "wolverine")` +
  `UseEntityFrameworkCoreTransactions()`, mudar `DurabilityMode` para `Balanced` (ou `Solo` em dev) e
  referenciar os pacotes removidos. Usar `IMessageBus.PublishAsync(event, ct)` **dentro** da transação
  do aggregate, nunca em broker direto.

## Resiliência

- **HTTP de saída:** use `Microsoft.Extensions.Http.Resilience` (Polly via Microsoft, já no `ServiceDefaults`
  com retry+timeout+circuit-breaker) — **sem** dependência direta em `Polly.*`.
- **Idempotência / anti-replay:** cheque pré-condições antes de efeitos colaterais (`ExistsByIdAsync`
  no `EnsureAccountProvisionedHandler` antes de criar); o nonce de SIWE é consumido no verify (replay-safe);
  unicidade por índice (carteira → 409).
- **Falhas explícitas:** mapeie tudo para ProblemDetails (RFC 7807) via `ProblemDetailsExceptionHandler` local;
  **nunca** engula exceção silenciosamente. Use `CancellationToken` em toda chamada async.

## Auth + domínio

- **Domínio:** aggregate **`Account`** (Id = Firebase UID, Email, Nickname, Status, WalletAddress? +
  WalletLinkedAt?) + `WalletLinkNonce`. **Sem multi-tenancy de DB**.
- **Cadastro client-side (JIT provisioning):** o DApp cria o usuário no Firebase (Web SDK, seta
  `displayName = nickname`). A API **não** cria usuário no Firebase — sem `IIdentityProvider`/Admin SDK.
  A `Account` é criada **automaticamente** na primeira requisição autenticada pelo `AccountProvisioningMiddleware`
  (chamada ao `EnsureAccountProvisionedHandler` idempotente). Não há `POST /accounts`.
- **Validação JWT:** `AddFirebaseJwtBearer` (OIDC discovery por `ProjectId`) em `Api/Identity/FirebaseJwtExtensions.cs`.
  O middleware lê claims `user_id`/`email`/`name` para provisionar.
- **Vínculo de carteira (SIWE):** `POST /accounts/me/wallet/nonce` → assinatura → `POST /accounts/me/wallet`
  verifica ECDSA via **Nethereum** (`ISignatureVerifier`); `DELETE` desvincula.

## Testes (TDD)

- **Escreva o teste junto da mudança** (idealmente antes). **Unit:** xUnit + FluentAssertions + Moq +
  AutoFixture (Domain + Application; mocke repos, `ISignatureVerifier`). **Proibido** NUnit/MSTest/NSubstitute/Shouldly.
  **Proibido** acessar banco real em teste unitário.
- **Integração:** `RW.BC.Infrastructure.Persistence.IntegrationTests` com **Testcontainers** (Postgres real).
  Fixture inline mínima (sem herança de classes externas).
- **E2E da Api:** `RW.BC.Api.IntegrationTests` — `WebApplicationFactory<Program>` + Testcontainers Postgres +
  `TestAuthHandler` (injeta principal Firebase fake). Cobre JIT, GET /me, wallet nonce/link/unlink,
  401/409/422/CORS, **e o read-model completo**: editions, NFTs, listings/marketplace, staking, forge,
  referral, transparency e realtime (SignalR `EventsHubTests`, change detectors).
- **Cobertura comportamental:** cubra sucesso, validações, **caminhos de falha** e mapeamento de erro — não
  só o happy path.
- **`[ExcludeFromCodeCoverage]`** só em composition root: `Program.cs`, `AppHost.cs`, `DIExtension.cs`,
  `*Endpoints.cs`, `IDesignTimeDbContextFactory`, `Migrations/*.cs`, `Documentation.cs`,
  `FirebaseJwtExtensions.cs`, `CorsExtensions.UseAppCors`. **Nunca** para esconder lógica de negócio.

## Referências

- **.NET / Aspire / EF Core / Wolverine / C#:** MCP **`mcp__microsoft-learn__*`** + <https://learn.microsoft.com/>.
  Confirme APIs antes de assumir (mudam entre versões).

## Armadilhas

- **`NETSDK1226`** → sempre `-p:AllowMissingPrunePackageData=true` (não commitar em csproj/props).
- **Sem feed privado** — todos os pacotes vêm do nuget.org.
- **Firebase:** `Identity:Firebase:ProjectId` em `appsettings.json` é o único valor que a API usa (OIDC
  discovery para validar o JWT); sem service account (não precisamos). `WebApiKey` é usado só pelos
  scripts E2E (`scripts/*.sh`, via env var), não pela API em si.
- **Sem Redis nesta fase** (cache de leitura usa `IMemoryCache` in-process). O read-model on-chain
  (indexador Ponder → schema `indexer` → `ToView` + Gridify) e as notificações realtime (SignalR
  `EventsHub`) **já estão implementados** — são o núcleo da API atual, não uma fase futura.
