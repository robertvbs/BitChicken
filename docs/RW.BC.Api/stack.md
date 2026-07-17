# Stack — RW.BC.Api

## Dependências

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Runtime | .NET / C# | 10.0 / 14 | `TargetFramework=net10.0`, `LangVersion=14` |
| Web | ASP.NET Core Minimal API | 10.0.9 | `Microsoft.AspNetCore.OpenApi` |
| Documentação | Scalar.AspNetCore | 2.16.4 | Substitui Swashbuckle (proibido) |
| Mensageria/CQRS | WolverineFx | 6.12.0 | `DurabilityMode.MediatorOnly` — sem inbox/outbox ativo |
| Validação | FluentValidation | 12.1.1 | `WolverineFx.FluentValidation` integrado |
| ORM | EF Core + Npgsql | 10.0.9 / 10.0.2 | `UseSnakeCaseNamingConvention()` (EFCore.NamingConventions 10.0.1) |
| Banco | PostgreSQL | 17 (pinado) | Dois schemas: `public` (domínio) e `indexer` (read-models Ponder) |
| Auth | Firebase JWT (OIDC) | JwtBearer 10.0.9 | Discovery via `securetoken.google.com/<projectId>` |
| SIWE / assinatura | Nethereum.Signer | 6.1.0 | `EthereumMessageSigner.EncodeUTF8AndEcRecover` |
| Paginação/filtro | Gridify | 2.19.1 | Mappers singleton por domínio; `BigInteger` type converter custom |
| Tempo real | SignalR (ASP.NET Core) | 10.0.9 (embutido) | `EventsHub` + `MarketplaceEventsListener` (LISTEN/NOTIFY) |
| Cache | `IMemoryCache` | 10.0.9 | TTL 30 s em `GetSummaryHandler` |
| Resiliência HTTP | `Microsoft.Extensions.Http.Resilience` | 10.7.0 | Retry + timeout + circuit-breaker via Polly (sem dep direta) |
| Observabilidade | OpenTelemetry | 1.16.0 | OTLP exporter + instrumentação ASP.NET/EF/HTTP/Npgsql |
| Orquestração dev | .NET Aspire | 13.4.5 (`Aspire.Npgsql.*`) | `RW.BC.AppHost` (projeto separado) orquestra Postgres + API |
| Testes unitários | xUnit + FluentAssertions + Moq + AutoFixture | 2.9.3 / 8.10.0 / 4.20.72 / 4.18.1 | Domain + Application |
| Testes integração | Testcontainers.PostgreSql + `WebApplicationFactory` | 4.12.0 / 10.0.9 | Infrastructure + Api E2E |

## Arquitetura

Padrão **Clean Architecture + Hexagonal** em quatro camadas explícitas:

```
RW.BC.Domain          (aggregates, value objects, building blocks — zero deps de framework)
    ^
RW.BC.Application     (Wolverine handlers, commands, queries, DTOs, ports/interfaces, validators)
    ^
RW.BC.Infrastructure.Persistence  (EF Core, repos, mappings de views, AuditingInterceptor, NethereumSignatureVerifier)
    ^
RW.BC.Api             (Minimal API endpoints, Identity, Web helpers, SignalR hub, BackgroundService)
```

**Alvo de deploy:** sem alvo fixo neste repositório (build via imagem Docker, deployável em qualquer
orquestrador de containers); banco PostgreSQL 17 gerenciado.
Em dev local, o `RW.BC.AppHost` (Aspire) sobe Postgres + API + outros serviços do ecossistema com um único `dotnet run`.

**CQRS:** handlers Wolverine descobertos por `opts.Discovery.IncludeAssembly(typeof(DIExtension).Assembly)`.
Wolverine roda em `MediatorOnly` — sem durabilidade persistida; `IUnitOfWork.CommitAsync` é chamado explicitamente nos handlers.

**Read-models:** views do schema `indexer` (populado pelo Ponder) mapeadas como `ToView(...)` no EF Core — **somente leitura**, sem migrations para essas views. Paginação/filtragem server-side via Gridify.
