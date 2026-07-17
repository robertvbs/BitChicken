# ADR 0008 — Indicação on-chain com recompensa em BCKN

**Status:** Substituído pelo [ADR 0009](0009-indicacao-bnb-um-nivel-por-rank.md) (mantido como registro histórico).

> A reformulação de 2026-06 trocou o modelo abaixo por **indicação de 1 nível, recompensa em BNB
> (fatia do preço do ovo), paga uma vez no 1º ovo do indicado, com taxa por rank do indicador**.
> Veja o ADR 0009 para a decisão vigente.

## Contexto

O programa de indicação precisa ser verificável, à prova de fraude e integrado ao
fluxo de compra, sem custódia de fundos nem contabilidade off-chain confiável.

## Decisão

Implementar a indicação **on-chain** no próprio NFT (`ReferralTreeManagement`),
com árvore de **2 níveis**, comissão acumulada em `pendingReferral` e recompensa
paga por **mint de BCKN** via pull-payment (`claimReferral`).

## Consequências

- O NFT precisa de **`MINTER_ROLE`** no BCKN para pagar as comissões.
- Upline é fixado na primeira compra com o código (first-referrer-wins, imutável);
  auto-referência é ignorada; anti-double-count por par (referrer, tokenId).
- O `referrerCode` viaja no caminho de compra (`requestObtain` → `forgeMint`).
- O dApp persiste `?ref=` em `localStorage` (TTL 30 dias); leitura de
  acumulado/sacado/pendente vem da API (indexer), com pendente calculado em
  BigInteger.

## Evidência

- `RW.BC.Crypto/funcionalidades.md` (item 6); `integracoes.md` (referral mint, MINTER_ROLE).
- `RW.BC.Indexer/funcionalidades.md` (item 7); `RW.BC.Api/funcionalidades.md` (item 11).
- `RW.BC.DApp/funcionalidades.md` (itens 6 e 11).
