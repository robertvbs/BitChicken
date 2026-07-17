# Funcionalidades — RW.BC.Indexer

## 1. Indexacao de Listings do Marketplace

- **Entrada:** eventos `Marketplace:Listed`, `Marketplace:Cancelled`, `Marketplace:Sold`
- **Arquivos:** `src/index.ts`
- **Comportamento:**
  - `Listed` — insere ou atualiza listing com `status=Active`; consulta a tabela `nfts`
    para enriquecer com `edition_id`.
  - `Cancelled` — atualiza `status=Cancelled` via `onConflictDoUpdate`
    (guard: ignora se listing nao existir na falha de upsert).
  - `Sold` — atualiza `status=Sold` e insere registro em `sales` com
    `platform_fee` e `royalty` desagregados.
- **Regras:** todos os enderecos normalizados para lowercase; `onConflictDoUpdate` em
  todos os inserts garante idempotencia na reindexacao.

## 2. Indexacao de Swaps

- **Entrada:** eventos `Marketplace:SwapProposed`, `Marketplace:SwapCancelled`,
  `Marketplace:SwapAccepted`
- **Arquivos:** `src/index.ts`
- **Comportamento:**
  - `SwapProposed` — insere ou atualiza swap com `status=Proposed`; `acceptor=null`.
  - `SwapCancelled` / `SwapAccepted` — guard de update-only: busca o swap antes de
    atualizar; se nao existir, abandona silenciosamente.
  - `SwapAccepted` — registra `acceptor` normalizado.
- **Regras:** `swap_id` e valor `bnb_leg` preservados; status so transita via evento.

## 3. Indexacao de Edicoes do Catalogo

- **Entrada:** eventos `Nft:EditionRegistered`, `Nft:EditionActiveSet`,
  `Nft:EditionWindowSet`
- **Arquivos:** `src/catalog.ts`
- **Comportamento:**
  - `EditionRegistered` — le todos os campos da edicao diretamente do contrato via
    `context.client.readContract({ functionName: "getEdition" })` no bloco do evento;
    insere ou atualiza na tabela `editions`.
  - `EditionActiveSet` — guard de update-only; atualiza apenas o campo `active`.
  - `EditionWindowSet` — guard de update-only; atualiza `mint_start` e `mint_end`.
- **Regras:** dados canonicos vem do contrato (nao do payload do evento) para garantir
  consistencia com o estado on-chain no bloco exato.

## 4. Indexacao de NFTs

- **Entrada:** eventos `Nft:Minted`, `Nft:Transfer`, `Nft:Renamed`
- **Arquivos:** `src/nft.ts`
- **Comportamento:**
  - `Minted` — insere NFT com `staked=false`, `burned=false`; incrementa `minted`
    na tabela `editions` se a edicao existir.
  - `Transfer` — se NFT ja existe, atualiza `owner` e `burned` (burned = destinatario
    e `0x0`); se nao existe (transfer antes do Minted), cria registro placeholder com
    `edition_id=0`, `gender=0`, `nft_name=""`.
  - `Renamed` — guard de update-only; atualiza apenas `nft_name`.
- **Regras:** `burned` e derivado de `to == ZERO_ADDRESS`; campo `staked` e atualizado
  pelo handler de staking, nao pelo transfer.

## 5. Indexacao do Forge (Gacha VRF)

- **Entrada:** eventos `Forge:ForgeRequested`, `Forge:ForgeFulfilled`,
  `Forge:RequestCancelled`
- **Arquivos:** `src/forge.ts`
- **Comportamento:**
  - `ForgeRequested` — insere ou atualiza requisicao com `status=Requested`;
    `token_id` e `edition_id` nulos (ainda nao ha NFT).
  - `ForgeFulfilled` — guard de update-only; atualiza `status=Fulfilled`,
    `token_id`, `edition_id` e `fulfilled_at_block`.
  - `RequestCancelled` — guard de update-only; atualiza apenas `status=Cancelled`.
- **Regras:** `fulfilled_at_block` nulo ate o fulfillment; o indice composto
  `(status, fulfilled_at_block)` otimiza consultas de requisicoes recentes concluidas.

## 6. Indexacao de Staking (Granja)

- **Entrada:** eventos `Staking:PairStaked`, `Staking:PairUnstaked`,
  `Staking:YieldClaimed`
- **Arquivos:** `src/staking.ts`
- **Comportamento:**
  - `PairStaked` — insere ou atualiza par com `status=Staked`; atualiza `staked=true`
    e `owner=staker` nos dois NFTs do par (male e female).
  - `PairUnstaked` — guard de update-only no par (atualiza `status=Unstaked`);
    atualiza `staked=false` e `owner=staker` nos dois NFTs.
  - `YieldClaimed` — atualiza `last_claim_at` no par (o evento e indexado so para isso;
    nao ha mais tabela `yield_claims`).
- **Regras:** `staked_at` e `last_claim_at` usam `event.block.timestamp` (nao
  `block.number`); campo `owner` dos NFTs e sincronizado pelo staking handler para
  refletir que NFTs stakados pertencem logicamente ao staker.

## 7. Indexacao de Referral

- **Entrada:** eventos `Nft:ReferrerRegistered`, `Nft:ReferralLinked`,
  `Forge:ReferralBnbAccrued`, `Forge:ReferralBnbClaimed`
- **Arquivos:** `src/referral.ts`
- **Comportamento:**
  - `ReferrerRegistered` — insere ou atualiza registro de referrer com seu `code`.
  - `ReferralLinked` — insere ou atualiza link buyer → referrer (vinculo no 1º ovo;
    um buyer so tem um referrer).
  - `ReferralBnbAccrued` — insere registro imutavel em `referral_bnb_accruals`
    (`referrer`, `buyer`, `amount` em BNB wei).
  - `ReferralBnbClaimed` — insere registro imutavel em `referral_bnb_claims`
    (`referrer`, `amount` em BNB wei).
- **Regras:** IDs dos eventos de acumulo e saque em BNB sao `txHash-logIndex` (unicidade
  garantida por `eventId()`).

## 8. Indexacao de Transferencias do Token BCKN

- **Entrada:** evento `Token:Transfer`
- **Arquivos:** `src/token.ts`
- **Comportamento:** insere registro imutavel na tabela `token_transfers` com
  `from_addr`, `to_addr`, `value` e `block_number`.
- **Regras:** IDs gerados por `eventId()`; inclui transferencias de mint
  (from=`0x0`) e burn (to=`0x0`).

## 9. API HTTP Embutida

- **Arquivos:** `src/api/index.ts`
- **Comportamento:** expoe dois endpoints via Hono:
  - `/sql/*` — SQL client do Ponder (acesso direto ao schema `indexer`; uso
    interno/debug).
  - `/` e `/graphql` — endpoint GraphQL gerado automaticamente pelo Ponder a
    partir do schema.
- **Regras:** a `RW.BC.Api` (.NET) nao consome esses endpoints; acessa o
  Postgres diretamente. Os endpoints sao uteis para inspecao e tooling.

## 10. Reset de Schema

- **Arquivos:** `scripts/reset-schema.mjs`
- **Comportamento:** dropa os schemas `indexer` (ou o definido em `DATABASE_SCHEMA`)
  e `ponder_sync` do Postgres; le `.env.local` ou `.env` se presentes.
- **Quando usar:** apos reset da chain local (nonces/blocos nao batem com o
  estado indexado) ou apos mudanca estrutural no `ponder.schema.ts`.
