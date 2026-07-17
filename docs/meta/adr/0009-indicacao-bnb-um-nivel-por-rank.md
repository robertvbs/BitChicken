# ADR 0009 — Indicação reformulada: recompensa em BNB, 1 nível, por rank

**Status:** Aceito (substitui o [ADR 0008](0008-indicacao-on-chain-recompensa-em-bckn.md))

## Contexto

O modelo do ADR 0008 (recompensa em **mint de BCKN**, **2 níveis**, base fixa `referralRewardPerMint`,
pago em todo mint) acoplava o programa de indicação à emissão de BCKN, premiava cadeias indiretas e não
amarrava custo à receita real. A reformulação busca distribuição justa **mantendo a lucratividade**: a
recompensa sai do próprio preço pago e é limitada.

## Decisão

Indicação **on-chain de 1 nível** (direto): A indica B → A só ganha no B, **nunca** no C.

- **Recompensa em BNB**, como **fatia do preço do ovo** (split do `msg.value` registrado em
  `ForgeRequest.paid`). O indicado paga o preço normal; a fatia é desviada da receita do tesouro.
- **Paga uma única vez**, no **1º ovo** do indicado (o evento de vínculo do upline). Demais ovos: zero.
- **Taxa pelo nível do indicador**, derivado da **quantidade de indicados que abriram ≥1 ovo** (anti-sybil),
  avaliada **antes** de contar o novo indicado. Tabela padrão (configurável por admin):

  | Nível | Indicados (limiar) | Taxa |
  |---|---|---|
  | 00 | 0  | 2%  |
  | 01 | 3  | 4%  |
  | 02 | 6  | 6%  |
  | 03 | 8  | 8%  |
  | 04 | 10 | 10% |

- **Teto rígido `MAX_REFERRAL_BPS = 1000` (10%)** na config → o negócio fica sempre com ≥90% do preço.
- **Pull-payment no Forge:** o BNB acumula em `pendingReferralBnb[referrer]`; o referrer saca com
  `claimReferralBnb()` (CEI). `withdraw()` reserva `totalPendingRefunds + totalPendingReferralBnb`.

## Fronteira de implementação (NFT ↔ Forge)

- **Estado** no NFT (`ReferralTreeManagement`): `referredCount`, tabela `levelThresholds`/`levelRatesBps`.
  `forgeMint` passa a retornar `(tokenId, referrer, rateBps)` — não-zero só no vínculo (1º ovo).
- **BNB** no Forge: no `fulfillRandomWords` (sucesso), `amt = paid * rateBps / 10000` acumula no pool e
  emite `ReferralBnbAccrued`.

## Consequências

- O **NFT deixa de precisar de `MINTER_ROLE`** (não minta mais BCKN; só o Staking minta). `rename` usa `burnFrom`.
- Removidos: `claimReferral`, `pendingReferral`, `levelRates`, `referralRewardPerMint`, `countedReferral`,
  eventos `ReferralCommissionAccrued`/`ReferralClaimed`. Mantidos `ReferrerRegistered` e `ReferralLinked`
  (emitido no 1º ovo); novos eventos `ReferralBnbAccrued`/`ReferralBnbClaimed` no Forge.
- **Indexer:** tabelas `referral_bnb_accruals`/`referral_bnb_claims` (substituem `referral_commissions`/`referral_claims`).
- **API:** `ReferralInfoDto` mantém o formato, mas pending/acumulado/sacado passam a ser **BNB wei**;
  o nível/taxa é derivado da contagem de indicados no dApp.
- **dApp:** painel da granja mostra nível, taxa e pendente em **BNB**; o claim chama `forge.claimReferralBnb()`.

## Evidência

- `RW.BC.Crypto/contratos.md` (NFT/Forge — referral); `funcionalidades.md`; `integracoes.md`.
- `RW.BC.Indexer/funcionalidades.md`; `RW.BC.Api/funcionalidades.md`; `RW.BC.DApp/funcionalidades.md`.
- Domínio: [indicacao.md](../arquitetura/dominios/indicacao.md).
