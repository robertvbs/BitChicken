# RW.BC.Api

| Atributo | Valor |
|---|---|
| Tipo | Backend API (REST + SignalR) |
| Linguagem | C# 14 / .NET 10 |
| Framework | ASP.NET Core Minimal API + Wolverine CQRS |
| Banco | PostgreSQL 17 (schema `public` — domínio; schema `indexer` — read-models Ponder) |
| Deploy | Sem alvo fixo no repo público (imagem Docker + Postgres gerenciado; orquestrado via Aspire em dev) |
| Auth | Firebase JWT (OIDC discovery) |

API de contas do ecossistema BitChicken: desacopla a identidade do usuário (email/senha via Firebase) da carteira EVM, expõe read-models do indexador on-chain via Gridify e emite notificações em tempo real via SignalR.

## Entry Points

| Arquivo | Papel |
|---|---|
| `src/RW.BC.Api/Program.cs` | Composition root: registra serviços, middlewares e mapeia endpoints |
| `src/RW.BC.Api/Endpoints/*.cs` | Minimal API — grupos de rotas por domínio |
| `src/RW.BC.Api/Hubs/EventsHub.cs` | SignalR hub — assinatura por endereço EVM |
| `src/RW.BC.Api/Realtime/MarketplaceEventsListener.cs` | `BackgroundService` — polling Postgres LISTEN/NOTIFY |

## Diretórios Principais

| Caminho | Conteúdo |
|---|---|
| `src/RW.BC.Domain/` | Aggregates, value objects, building blocks (zero dependência de framework) |
| `src/RW.BC.Application/` | Handlers Wolverine, commands, queries, DTOs, ports, validators |
| `src/RW.BC.Infrastructure.Persistence/` | EF Core, mappings, repositórios, migrations, `NethereumSignatureVerifier` |
| `src/RW.BC.Api/` | Minimal API endpoints, identity, web helpers, hubs, realtime |
| `src/RW.BC.ServiceDefaults/` | OpenTelemetry, health checks, service discovery (Aspire) |
| `tests/RW.BC.Domain.UnitTests/` | xUnit — domain puro (sem infra) |
| `tests/RW.BC.Application.UnitTests/` | xUnit + Moq + AutoFixture — handlers e validators |
| `tests/RW.BC.Infrastructure.Persistence.IntegrationTests/` | Testcontainers (Postgres real) — repos e signature verifier |
| `tests/RW.BC.Api.IntegrationTests/` | `WebApplicationFactory` + Testcontainers — endpoints end-to-end |

## Documentação Disponível

- [stack.md](stack.md) — tecnologias, versões e arquitetura
- [funcionalidades.md](funcionalidades.md) — funcionalidades por domínio
- [regras-de-negocio.md](regras-de-negocio.md) — regras de negócio com localização no código
- [armadilhas.md](armadilhas.md) — armadilhas e como evitá-las
- [integracoes.md](integracoes.md) — integrações externas e internas
