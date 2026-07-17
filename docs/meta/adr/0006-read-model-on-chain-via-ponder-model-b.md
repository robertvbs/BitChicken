# ADR 0006 — Read-model on-chain via Ponder (Model B)

**Status:** Aceito

## Contexto

Ler do dApp diretamente da cadeia para listas grandes (NFTs, listings, staking,
vendas) é lento, custoso e não permite filtro/paginação/ordenação server-side.

## Decisão

Introduzir o **`RW.BC.Indexer`** (Ponder 0.16.6 + viem) que consome eventos dos
5 contratos e materializa **12 tabelas** no schema `indexer` do **mesmo Postgres**
da API (**Model B**): o Ponder escreve; a API lê via EF `ToView` + Gridify e
publica realtime por SignalR (LISTEN/NOTIFY).

## Consequências

- A integração indexer↔API é **o banco compartilhado** — sem HTTP entre eles.
- Leituras pesadas do dApp passam pela API (`MarketDataService`); só dados
  dinâmicos (`pendingYield`, `nextUnlock`) e config de admin ficam on-chain.
- **Eventual consistency:** a API **não detecta lag** do indexer (dados
  desatualizados em silêncio); view ausente (`42P01`) é degradada.
- Idempotência por `onConflictDoUpdate` em todo handler (reindexação segura).
- A API HTTP embutida do Ponder (`/sql`, `/graphql`) **não** é consumida — só debug.

## Evidência

- `RW.BC.Indexer/stack.md` (Model B); `funcionalidades.md`; `integracoes.md`.
- `RW.BC.Api/integracoes.md` (schema `indexer`, Ponder, SignalR).
- `RW.BC.DApp/stack.md` (leituras via MarketDataService).
