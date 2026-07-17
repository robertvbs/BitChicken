# Domínio — Read-model on-chain

## Responsabilidade

Tira as leituras pesadas da cadeia: um indexador materializa os eventos dos
contratos em tabelas relacionais (schema `indexer`) e a API as serve com
paginação/filtro (Gridify) e notificações em tempo real (SignalR). É o **Model B**
da arquitetura de read-model — _eventual consistency_, somente leitura.

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| Indexer Ponder + handlers por domínio | `RW.BC.Indexer` | escuta eventos via viem e faz upsert nas 12 tabelas |
| schema `indexer` (Postgres) | compartilhado | read-models; escrito pelo Ponder, lido pela API |
| `ponder_sync` (schema interno) | `RW.BC.Indexer` | progresso de indexação (não consumido pela API) |
| Query services + Gridify mappers | `RW.BC.Api` | `ToView` read-only + filtro/paginação server-side |
| EventsHub + MarketplaceEventsListener | `RW.BC.Api` | LISTEN/NOTIFY → `marketChanged`/`forgeFulfilled` |
| MarketDataService, SignalrService | `RW.BC.DApp` | consome REST + realtime |

## Tabelas do schema `indexer`

| Tabela | PK | Servida por |
|---|---|---|
| `editions` | `edition_id` | `GET /editions` |
| `nfts` | `token_id` | `GET /accounts/{addr}/nfts` |
| `listings` | `token_id` | `GET /marketplace/listings` (só `Active`) |
| `staking_pairs` | `pair_id` | `GET /accounts/{addr}/staking` (só `Staked`) |
| `forge_requests` | `request_id` | `GET /accounts/{addr}/forge-requests` + realtime |
| `sales` | `id` (tx-log) | `GET /transparency/sales` + resumo |
| `swaps` | `swap_id` | (indexado; suporte a marketplace) |
| `referral_registrations` / `referral_links` | `referrer` / `buyer` | `GET /accounts/{addr}/referral` |
| `referral_bnb_accruals` / `referral_bnb_claims` | `id` (tx-log) | agregação de referral (BNB) |
| `token_transfers` | `id` (tx-log) | total BCKN (transparência) |

## Características e regras

- **Sem chamada direta indexer↔API:** a integração é o **Postgres compartilhado**.
  A API lê via EF `ToView` (sem migrations para essas views).
- **Idempotência:** todo handler usa `onConflictDoUpdate` — reindexação é segura.
- **Consistência canônica:** edições são lidas do contrato no bloco do evento
  (`readContract getEdition`), não do payload.
- **Degradação:** view ausente (`42P01`) é tratada silenciosamente nos detectors
  de realtime; em queries EF, ausência da view causa erro ao materializar —
  exige que o Ponder tenha rodado ao menos uma vez. **A API não detecta lag** do
  indexer (retorna dados desatualizados em silêncio).
- **Campos `numeric(78,0)`** (tokenId, price, supply) viajam como `string`
  (BigInteger em wei) até o dApp.
- **Sync de ABI:** o indexer mantém cópias manuais das ABIs em `abis/*.ts`;
  mudança de interface exige atualizá-las (mesma armadilha do dApp).

## Integrações entre domínios

Este domínio é transversal: alimenta as leituras de **Catálogo/NFT**,
**Marketplace**, **Staking**, **Forge** e **Indicação**. Escreve nada on-chain.

## Evidência

- `RW.BC.Indexer/funcionalidades.md` (todos os itens); `stack.md` (Model B); `integracoes.md`.
- `RW.BC.Api/integracoes.md` — "PostgreSQL (schema indexer)", "Ponder", "SignalR".
- `RW.BC.DApp/stack.md` (Leituras de dados on-chain via MarketDataService).
