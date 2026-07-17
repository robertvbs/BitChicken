# Integracoes — RW.BC.Indexer

## Resumo

| Servico | Direcao | Protocolo | Criticidade | Tratamento de falha |
|---|---|---|---|---|
| BNB Smart Chain / Anvil (RPC) | Leitura (eventos + chamadas de contrato) | JSON-RPC HTTP/WS | Critica | Ponder faz retry automatico com backoff; processo para se RPC ficar inacessivel por muito tempo |
| PostgreSQL (schema `indexer`) | Escrita (upsert de read-model) | TCP (driver `pg`) | Critica | Ponder faz retry de conexao; falha persistente para o processo |
| RW.BC.Api (.NET) | Nenhuma (leitura unilateral pelo consumidor) | SQL direto ao Postgres | Alta | A API le o banco diretamente; o Indexer nao depende da API |
| RW.BC.AppHost (Aspire) | Recebe configuracao via env | Environment variables | Alta | Sem o AppHost, as vars devem ser definidas manualmente no env |
| RW.BC.Crypto (ABIs) | Copia manual | Arquivo TypeScript | Alta | Divergencia de ABI causa erros de tipo em runtime (ver armadilhas) |

---

## Integracao 1 — BNB Smart Chain / Anvil (RPC EVM)

**Proposito:** fonte dos eventos on-chain e das chamadas de leitura de contrato.

**Configuracao:**

| Variavel | Padrao | Descricao |
|---|---|---|
| `PONDER_RPC_URL_1337` | `http://localhost:8545` | URL do RPC para a chain com id 1337 |
| `CHAIN_ID` | `1337` | ID da chain; o Ponder mapeia para o RPC da chave correspondente |

**Contratos monitorados:**

| Nome no config | Variavel de endereco | Variavel de start block |
|---|---|---|
| `Marketplace` | `MARKETPLACE_ADDRESS` | `MARKETPLACE_START_BLOCK` |
| `Nft` | `NFT_ADDRESS` | `NFT_START_BLOCK` |
| `Staking` | `STAKING_ADDRESS` | `STAKING_START_BLOCK` |
| `Forge` | `FORGE_ADDRESS` | `FORGE_START_BLOCK` |
| `Token` | `TOKEN_ADDRESS` | `TOKEN_START_BLOCK` |

**Alternativa de endereco:** `DEPLOYED_ADDRESSES_PATH` aponta para JSON com chaves
`marketplace`, `nft`, `staking`, `forge`, `token`. Env var individual tem precedencia.

**Chamadas de leitura:** o handler `catalog.ts` faz chamada `readContract` com
`functionName: "getEdition"` no bloco exato do evento `EditionRegistered` (via
`context.client`). Requer que o RPC suporte consultas historicas (archive node ou
Anvil local).

---

## Integracao 2 — PostgreSQL (schema `indexer`)

**Proposito:** persistencia do read-model; consumido pela `RW.BC.Api` via Gridify.

**Configuracao (resolucao em cascata):**

1. `ConnectionStrings__bitchicken` (formato ADO.NET do Aspire) — convertido para URL
   por `scripts/lib/connection.mjs:aspireConnectionToUrl`.
2. `DATABASE_URL` (URL padrao PostgreSQL).

**Schema alvo:** `indexer` (configuravel via `DATABASE_SCHEMA`).

**Schema interno do Ponder:** `ponder_sync` (progresso de indexacao; nao consumido pela API).

**Tabelas escritas pelo Indexer:**

| Tabela | PK | Indices secundarios |
|---|---|---|
| `listings` | `token_id` | `seller`; `(status, updated_at_block)`; `listed_at_block` |
| `nfts` | `token_id` | `owner`; `edition_id` |
| `referral_registrations` | `referrer` | — |
| `referral_links` | `buyer` | `referrer` |
| `referral_bnb_accruals` | `id` (txHash-logIndex) | `referrer` |
| `referral_bnb_claims` | `id` (txHash-logIndex) | `referrer` |
| `sales` | `id` (txHash-logIndex) | `block_number`; `seller`; `buyer` |
| `swaps` | `swap_id` | `proposer`; `status` |
| `token_transfers` | `id` (txHash-logIndex) | `from_addr`; `to_addr` |
| `forge_requests` | `request_id` | `buyer`; `(status, fulfilled_at_block)` |
| `staking_pairs` | `pair_id` | `(staker, status)` |
| `editions` | `edition_id` | — |

---

## Integracao 3 — RW.BC.Api (.NET)

**Direcao:** a API e consumidora do schema `indexer`; o Indexer nao faz chamadas HTTP
para a API.

**Mecanismo:** a `RW.BC.Api` conecta ao mesmo Postgres e le as tabelas do schema
`indexer` diretamente, usando Gridify para filtros/paginacao e expondo via SignalR
(tempo real) e endpoints REST.

**Dependencia de dados:** a API so obtem dados corretos se o Indexer estiver rodando e
atualizado. Em dev local, o Aspire sobe os dois juntos.

---

## Integracao 4 — RW.BC.AppHost (Aspire)

**Proposito:** orquestrador de dev local; injeta configuracao no Indexer como processo filho.

**Variaveis injetadas pelo AppHost:**

| Variavel | Fonte no AppHost |
|---|---|
| `ConnectionStrings__bitchicken` | Resource reference ao Postgres do Aspire |
| `PONDER_RPC_URL_1337` | Endpoint do Anvil (anvil resource) |
| `DEPLOYED_ADDRESSES_PATH` | Arquivo JSON gerado pelo script de deploy |
| `CHAIN_ID` | Configurado no AppHost (1337 para localnet) |

**Script de inicializacao:** o AppHost executa `reset-schema.mjs` antes de iniciar o
Ponder quando a chain e nova, garantindo estado limpo.

---

## Integracao 5 — RW.BC.Crypto (ABIs)

**Proposito:** os arquivos `abis/*.ts` sao copias das ABIs dos contratos geradas pelo
Hardhat, necessarias para o Ponder decodificar eventos e fazer chamadas de leitura
tipadas via viem.

**ABIs presentes:**

| Arquivo | Contrato |
|---|---|
| `abis/BitChickenMarketplace.ts` | `BitChickenMarketplaceAbi` |
| `abis/BitChickenNFT.ts` | `BitChickenNFTAbi` |
| `abis/BitChickenForge.ts` | `BitChickenForgeAbi` |
| `abis/BitChickenStaking.ts` | `BitChickenStakingAbi` |
| `abis/BitChickenToken.ts` | `BitChickenTokenAbi` |

**Sincronizacao:** manual. Qualquer mudanca de interface nos contratos exige atualizar
estes arquivos. Ver [armadilhas.md](armadilhas.md) — Armadilha Critica 1.
