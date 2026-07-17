# Stack — RW.BC.Indexer

## Tecnologias

| Camada | Tecnologia | Versao | Notas |
|---|---|---|---|
| Framework de indexacao | Ponder | 0.16.6 | Event-driven; indexacao paralela com reorg handling |
| Runtime | Node.js | >= 24 | Obrigatorio (ESM nativo, `engines` no package.json) |
| Linguagem | TypeScript | ^5 | `strict: true`, `noUncheckedIndexedAccess: true` |
| Cliente EVM | viem | ^2.52.2 | Leitura de contrato via `context.client.readContract` |
| Banco de dados | PostgreSQL | 17.6 (pin Aspire) | Schema `indexer`; tambem usa `ponder_sync` internamente |
| Driver Postgres | pg | ^8.21.0 | Usado no script `reset-schema.mjs` |
| API integrada | Hono | (transitiva via ponder) | Expoe endpoints SQL client e GraphQL |
| Empacotador | esbuild | (transitiva via ponder) | Build e watch do codigo dos handlers |
| Verificacao de tipos | tsc | ^5 | `typecheck` no CI (sem emissao) |

## Arquitetura

**Padrao:** event-sourcing read-model (Model B).

```
Chain (BSC / Anvil)
        |  eventos via RPC (WebSocket/HTTP)
        v
   Ponder 0.16.6
        |  handlers TypeScript por evento
        v
  Postgres schema "indexer"   <--- RW.BC.Api le via Gridify + SignalR
        |
        v
  API HTTP embutida do Ponder
    /sql/*   (SQL client — uso interno/debug)
    /graphql  (GraphQL — nao usado pela Api .NET)
```

- O Ponder gerencia seu proprio estado de sincronizacao no schema `ponder_sync`.
- O schema `indexer` contem as tabelas de read-model consumidas pela `RW.BC.Api`.
- Enderecos dos contratos sao resolvidos em runtime via variaveis de ambiente ou
  arquivo JSON (`DEPLOYED_ADDRESSES_PATH`), sem valores hardcoded no codigo.
- A connection string suporta dois formatos: ADO.NET Aspire
  (`ConnectionStrings__bitchicken`) ou URL padrao (`DATABASE_URL`).
- O script `reset-schema.mjs` dropa `indexer` + `ponder_sync` para reindexar
  do zero (necessario apos reset da chain local ou mudanca de schema).

## Deploy

- **Local (Aspire):** iniciado pelo `RW.BC.AppHost` como processo filho; recebe
  `ConnectionStrings__bitchicken`, `PONDER_RPC_URL_1337` e
  `DEPLOYED_ADDRESSES_PATH` via environment injetado pelo Aspire.
- **Producao/testnet:** `npm run start` ou `npm run start:fresh` (reset + start).
  Requer as variaveis de contrato individuais (`NFT_ADDRESS`, `FORGE_ADDRESS`, etc.)
  ou `DEPLOYED_ADDRESSES_PATH`.
