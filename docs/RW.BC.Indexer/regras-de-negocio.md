# Regras de Negocio — RW.BC.Indexer

| Regra | Localizacao (arquivo:linha) | Impacto se violada |
|---|---|---|
| Todos os enderecos Ethereum sao normalizados para lowercase antes de persistir | `src/lib/addresses.ts:5` | Consultas por endereco falham por divergencia de case; duplicatas no banco |
| IDs de eventos de log sao compostos por `txHash-logIndex` | `src/lib/ids.ts:6` | Colisao de ID em eventos distintos no mesmo bloco se logIndex nao for incluido |
| `ListingStatus` so assume os valores `Active`, `Cancelled` ou `Sold` | `src/lib/status.ts:1-5` | Valores invalidos no banco; queries de filtragem por status retornam resultados errados |
| `SwapStatus` so assume `Proposed`, `Cancelled` ou `Accepted` | `src/lib/status.ts:7-11` | Idem acima para swaps |
| `ForgeRequestStatus` so assume `Requested`, `Fulfilled` ou `Cancelled` | `src/lib/status.ts:13-17` | Idem acima para requisicoes de forge |
| `StakingPairStatus` so assume `Staked` ou `Unstaked` | `src/lib/status.ts:19-22` | Pares aparecem como ativos quando nao estao |
| Handlers de update-only (`ForgeFulfilled`, `RequestCancelled`, `PairUnstaked`, `SwapCancelled`, `SwapAccepted`, `EditionActiveSet`, `EditionWindowSet`, `Nft:Renamed`) verificam existencia antes de atualizar; se nao existir, retornam sem erro | `src/forge.ts:29`, `src/forge.ts:43`, `src/staking.ts:43`, `src/index.ts:113`, `src/index.ts:122`, `src/catalog.ts:50`, `src/catalog.ts:59`, `src/nft.ts:57` | Sem o guard, um update em registro inexistente e ignorado pelo Ponder mas pode gerar inconsistencia se o comportamento do ORM mudar; com o guard, o handler e idempotente |
| Inserts que podem ser reindexados usam `onConflictDoUpdate` | `src/index.ts:25`, `src/catalog.ts:32`, `src/nft.ts:18`, `src/forge.ts:20`, `src/staking.ts:22`, `src/referral.ts:13` | Sem upsert, uma reindexacao falha com violacao de PK |
| `burned` e derivado de `to == ZERO_ADDRESS` no evento `Transfer` | `src/nft.ts:37` | NFTs queimados aparecem como ativos; owner erroneo |
| `staked` nos NFTs e gerenciado pelos handlers de staking, nao pelo `Transfer` | `src/staking.ts:36,54` | Campo `staked` diverge do estado real on-chain |
| Dados de `Edition` sao lidos do contrato via `getEdition` no bloco do evento, nao do payload do evento | `src/catalog.ts:7-12` | Sem a chamada RPC, campos como `health`/`skill`/`morale`/`rarity` nao estao no evento e ficariam sem valor |
| `edition_id` e `gender` de um NFT sao definidos pelo evento `Minted`; o `Transfer` nao os sobrescreve | `src/nft.ts:19-25` | Um transfer apos mint nao apaga a especie/genero do NFT |
| Transfer antes de Minted cria registro placeholder com `edition_id=0`, `gender=0`, `nft_name=""` | `src/nft.ts:44-53` | Sem placeholder, um Transfer de NFT nao indexado ainda falha de forma silenciosa |
| `staked_at` e `last_claim_at` usam `event.block.timestamp`, nao `block.number` | `src/staking.ts:19-20` | Calculo de ciclos de yield errado se o numero do bloco for usado como tempo |
| O schema de destino e configuravel via `DATABASE_SCHEMA` (padrao: `indexer`) | `scripts/reset-schema.mjs:21` | Reset em ambiente errado se a variavel nao for conferida |
| Enderecos dos contratos sao resolvidos em runtime: env var individual tem precedencia sobre `DEPLOYED_ADDRESSES_PATH` | `ponder.config.ts:34-39` | Configuracao ambigua se ambas as fontes existirem com valores diferentes; a env var sempre vence |
| `CHAIN_ID` configura o `id` da chain no Ponder; padrao 1337 (localnet Anvil) | `ponder.config.ts:46` | Conectar ao RPC errado se `CHAIN_ID` nao for definido em testnet/mainnet |
| `start_block` de cada contrato e configuravel individualmente via env var; padrao 0 | `ponder.config.ts:42-44` | Reindexar desde o bloco 0 e lento; definir o bloco de deploy correto e critico em producao |
