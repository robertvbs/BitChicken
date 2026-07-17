# RW.BC.Indexer

| Campo | Valor |
|---|---|
| Tipo | Indexador on-chain (event-driven, read-model) |
| Linguagem | TypeScript 5 (ESM, ES2022) |
| Runtime | Node >= 24 |
| Framework | Ponder 0.16.6 |
| Alvo de deploy | Processo permanente; conecta-se ao mesmo Postgres da `RW.BC.Api` |
| Rede | BNB Smart Chain (mainnet/testnet) ou localnet Anvil (chainId configuravel) |

Indexador on-chain do ecossistema BitChicken: consome eventos dos contratos
(NFT, Forge, Staking, Marketplace, Token) via Ponder/viem e materializa um
read-model relacional no schema `indexer` do Postgres compartilhado com a
`RW.BC.Api`. Implementa o **Model B** da arquitetura de read-model (Ponder
escreve; API le via Gridify + SignalR).

## Entry Points

| Arquivo | Proposito |
|---|---|
| `ponder.config.ts` | Chains, contratos, ABIs, start blocks, conexao com Postgres |
| `ponder.schema.ts` | Definicao das 12 tabelas e 18 indices secundarios |
| `src/index.ts` | Handlers do Marketplace (listings, sales, swaps) |
| `src/catalog.ts` | Handlers de edicoes do catalogo (NFT) |
| `src/nft.ts` | Handlers de NFTs (mint, transfer, rename) |
| `src/forge.ts` | Handlers do Forge (gacha VRF) |
| `src/staking.ts` | Handlers de staking (pares; `last_claim_at` via `YieldClaimed`) |
| `src/referral.ts` | Handlers de referral (registro, link, BNB acumulado/sacado) |
| `src/token.ts` | Handlers de transferencia do token BCKN |
| `src/api/index.ts` | API HTTP do Ponder (SQL client + GraphQL) |
| `src/lib/status.ts` | Vocabulario canonico de status (enums tipados) |
| `src/lib/ids.ts` | Geracao de ID de evento (`txHash-logIndex`) |
| `src/lib/addresses.ts` | Normalizacao de enderecos (lowercase) |
| `scripts/reset-schema.mjs` | Drop do schema `indexer` + `ponder_sync` (dev) |
| `scripts/lib/connection.mjs` | Resolucao da connection string (Aspire ADO.NET ou `DATABASE_URL`) |

## Diretorios Principais

| Diretorio | Conteudo |
|---|---|
| `src/` | Handlers Ponder por dominio + subpasta `api/` e `lib/` |
| `abis/` | ABIs TypeScript dos 5 contratos (geradas do Crypto) |
| `generated/`, `.ponder/`, `ponder-env.d.ts` | Artefatos gerados pelo Ponder (`ponder codegen`/`ponder dev`) — gitignored, não presentes num checkout limpo |
| `scripts/` | Utilitarios de manutencao (reset do schema, resolucao de conexao) |

## Documentacao Disponivel

- [stack.md](stack.md) — tecnologias, versoes e arquitetura
- [funcionalidades.md](funcionalidades.md) — handlers por dominio
- [regras-de-negocio.md](regras-de-negocio.md) — invariantes e guards
- [armadilhas.md](armadilhas.md) — problemas conhecidos e correcoes
- [integracoes.md](integracoes.md) — dependencias externas e protocolo
