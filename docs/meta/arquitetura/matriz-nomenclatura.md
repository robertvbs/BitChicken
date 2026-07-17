# Matriz de nomenclatura consolidada (ponto-a-ponto, projeto-a-projeto)

Saída final do passe transversal de nomenclatura da auditoria de 4 camadas. Rastreia cada entidade ao
longo da cadeia **evento do contrato → tabela/coluna do indexer → ReadModel/DTO da API → model/ABI/i18n do
DApp**, a partir do **Dicionário Canônico** emitido pela Etapa 1 (os contratos são a fonte de verdade dos
nomes).

Convenção de casing **não é drift**: `snake_case` no DB ↔ `PascalCase` no C# ↔ `camelCase` no TS é
esperado. **Drift** é rename real de termo, mismatch semântico (coluna sempre nula, tipo errado) ou termo
divergente na superfície pública. Cada linha marca: **OK** (fiel, só casing), **Intencional** (rename
deliberado e justificado) ou **Resolvido** (era bug, corrigido na auditoria/baldes).

> Estado: **sem drift aberto.** As únicas divergências remanescentes são renames intencionais de superfície
> de API e renames semânticos no indexer (palavras reservadas / termo de produto). Tudo o que era bug
> (coluna nula, tipo errado, ABI dessincronizada, erro não mapeado) foi corrigido.

## Matriz por entidade

| Entidade | Canônico (evento) → indexer → API → DApp | Status | Nota |
|---|---|---|---|
| **editions** | `EditionRegistered(editionId,name,distribution,rarity)` → `editions(edition_id,…)` → `Edition`/`EditionDto.Id` → `EditionDto`/`EDITION_REGISTERED` ABI | Intencional + Resolvido | API expõe `editionId` como `Id` (rename de superfície, deliberado). **Resolvido:** ABI `EditionRegistered` ganhou `distribution`+`rarity`; `EditionDto.maxSupply/minted/mintStart/mintEnd` re-tipados `string` (BigInteger serializa como string). |
| **nfts** | `Minted(to,tokenId,editionId,gender,name_)` → `nfts(token_id,owner,edition_id,gender,nft_name,…)` → `NftToken`/`NftItemDto` → `NftItemDto`/`Minted` ABI | Intencional | Renames semânticos no indexer: canônico `to`→`owner`, `name_`→`nft_name` (deliberados, não casing). Demais campos fiéis. Leitura on-chain redundante (`getNftInventory`) **removida** no Balde 1. |
| **listings** | `Listed(tokenId,seller,price)` → `listings(token_id,seller,price,status,edition_id,…)` → `MarketplaceListing`/`ListingDto` → `ListingDto` | Resolvido | `listings.edition_id` é sempre null (o evento `Listed` não carrega editionId); a API compensa via JOIN `listings→nfts→editions`. Filtro de status **corrigido** para `"Active"` (era `"Listed"`, quebrava o mercado). ABI `getListing` órfão **removido**. |
| **sales** | `Sold(tokenId,seller,buyer,price,platformFee,royalty)` → `sales(…)` → `Sale`/`SaleDto` → `SaleDto` | OK | Fiel em todas as camadas (só casing). `id`/`block_number` são chave/metadado do indexer. |
| **swaps** | `SwapProposed(swapId,proposer,offeredId,wantedId,bnbLeg)` → `swaps(…)` → `Swap` (read-model) | Resolvido | Superfície de swap estava **morta** no DApp (sem UI): `proposeSwap/acceptSwap/getSwap` + entradas ABI **removidos**. Read-model do indexer mantido (write-only). |
| **token_transfers** | `Transfer(from,to,value)` → `token_transfers(from_addr,to_addr,value,…)` → `TokenTransfer` | Intencional | `from`/`to` são palavras reservadas → renomeadas `from_addr`/`to_addr` (deliberado). `value` fiel. |
| **staking_pairs** | `PairStaked(staker,pairId,maleId,femaleId,matched)` → `staking_pairs(…)` → `StakingPair`/`StakingPairDto` → `StakedPair` | Resolvido | **Resolvido:** ABI `PairStaked`/`getPair` ganharam `matched`; `StakedPair` passou a carregar `matched`; `stakedAt/lastClaimAt` re-tipados `string`. `StakingPairDto` omite `Staker` (é o parâmetro de rota — projeção, não rename). |
| **YieldClaimed** | `YieldClaimed(staker,pairId,gross,burned,net,cycles)` → (sem tabela) → atualiza `staking_pairs.last_claim_at` | OK | A tabela `yield_claims` foi removida (escrita sem consumidor); o evento é indexado só para atualizar `last_claim_at`. |
| **forge_requests** | `ForgeRequested(buyer,requestId,tier)` → `forge_requests(request_id,buyer,tier,status,token_id,edition_id,…)` → `ForgeRequest`/`ForgeRequestDto` | Resolvido | `edition_id`/`token_id`/`status` preenchidos no `ForgeFulfilled` (ciclo de vida, não mismatch). **Resolvido:** ABI `RequestCancelled` ganhou `amount`; `cancelStaleRequest`/`totalPendingRefunds` adicionados; `ForgeRequestDto.blockNumber` tipado `string`. |
| **referral_registrations** | `ReferrerRegistered(referrer,code)` → `referral_registrations(…)` → `ReferralInfoDto.Code` | OK | Fiel. `ReferralInfoDto.Code` corresponde a `registration.Code`. |
| **referral_links** | `ReferralLinked(buyer,referrer)` → `referral_links(…)` → `ReferralInfoDto.Upline` | Intencional | API expõe o `referrer` do link como `Upline` (rename de superfície deliberado). Indexer/ReadModel fiéis. |
| **referral_bnb_accruals** | `ReferralBnbAccrued(referrer,buyer,amount)` (Forge) → `referral_bnb_accruals(…)` → `ReferralInfoDto.Pending/TotalAccrued` | OK | BNB; a API agrega (soma por `referrer`) no DTO — projeção, não rename. |
| **referral_bnb_claims** | `ReferralBnbClaimed(referrer,amount)` (Forge) → `referral_bnb_claims(…)` → `ReferralInfoDto.TotalClaimed` | OK | BNB; agregado em `TotalClaimed` — projeção, não rename. |

## Erros customizados (contrato → ABI/i18n do DApp)

Todos os erros de negócio alcançáveis pela UI estão mapeados em `web3-errors.ts` (CONTRACT_ERROR_KEY) com
chave i18n nos dois locales. **Resolvido** na auditoria: 9 erros antes não mapeados (`NothingToRefund`,
`FeesExceedPrice`, `NotProposer`, `UnauthorizedNFT`, `BaseRateTooHigh`, `WeightTooHigh`,
`InvalidEditionWindow`, `InvalidEditionName`, `InvalidLevels`) + renomeados (`ForgeZeroAddress`→
`ZeroAddress`, `InvalidFeeBps`→`InvalidBasisPoints`, `NotSeller`→`NotProposer`). Consolidação no Balde 3:
`MintWithdrawFailed`→`TransferFailed` (erro compartilhado). Item observado (não bloqueante): `TransferFailed`
ainda não está nos arrays de ABI do DApp nem mapeado — reverts de transferência caem no erro genérico.

## Renames intencionais (referência rápida)

| Canônico | Vira | Onde | Por quê |
|---|---|---|---|
| `editionId` | `Id` | `EditionDto` (API) | Convenção de DTO da API |
| `to` (Minted) | `owner` | indexer/ReadModel | Termo de domínio (dono do NFT) |
| `name_` (Minted) | `nft_name` | indexer/DTO | Termo legível (sufixo de evento removido) |
| `from`/`to` (Transfer) | `from_addr`/`to_addr` | indexer | `from`/`to` são reservadas |
| `referrer` (ReferralLinked) | `Upline` | `ReferralInfoDto` | Termo de produto na superfície da API |
