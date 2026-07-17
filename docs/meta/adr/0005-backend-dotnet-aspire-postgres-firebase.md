# ADR 0005 — Backend de contas em .NET/Aspire/Postgres/Firebase

**Status:** Aceito

## Contexto

O ecossistema precisava de um backend para contas, vínculo de carteira e para
servir read-models indexados — algo que o dApp estático não pode fazer sozinho de
forma segura e paginável.

## Decisão

Adotar a **`RW.BC.Api`** em **.NET 10 + ASP.NET Minimal API + Wolverine CQRS + EF
Core/PostgreSQL 17 + Firebase JWT**, em **Clean Architecture + Hexagonal**, com
**Gridify** (paginação/filtro) e **SignalR** (realtime). Dev local orquestrado por
**.NET Aspire** (`RW.BC.AppHost`).

## Consequências

- Postgres com **dois schemas**: `public` (domínio, via migrations EF) e `indexer`
  (read-models, somente leitura via `ToView`).
- Wolverine em `DurabilityMode.MediatorOnly` (sem inbox/outbox); `IUnitOfWork`
  commitado explicitamente.
- Deploy: sem alvo fixo neste repositório (imagem Docker, deployável em qualquer orquestrador de
  containers); em dev, um `dotnet run --project RW.BC.AppHost` sobe Postgres + API + chain + deploy +
  indexer + dApp.
- Armadilha de ambiente (alguns ambientes, ex. WSL): builds podem exigir
  `-p:AllowMissingPrunePackageData=true` (não commitar em csproj/props).

## Evidência

- `RW.BC.Api/stack.md` (Clean Architecture, dois schemas); `index.md`.
- `RW.BC.Api/integracoes.md` (.NET Aspire — orquestração de dev local).
