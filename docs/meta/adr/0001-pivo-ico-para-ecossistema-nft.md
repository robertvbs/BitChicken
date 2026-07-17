# ADR 0001 — Pivô de ICO para ecossistema NFT

**Status:** Aceito

## Contexto

O projeto nasceu como um modelo de ICO/venda do token. Esse modelo não oferecia
utilidade recorrente nem mecânica de engajamento on-chain.

## Decisão

Pivotar para um **ecossistema de NFT** na BNB Smart Chain — catálogo de espécies,
gacha/VRF, granja de staking e marketplace P2P — com a token **BCKN** como moeda
utilitária/recompensa, não como ativo vendido.

## Consequências

- Cinco contratos principais (BCKN, NFT, Forge, Staking, Marketplace) em vez de um.
- BCKN entra em circulação só por **mint controlado** (yield do staking), com cap.
- Qualquer menção a "ICO" no repositório é histórica.
- O dApp passa a ter loja (ovos), granja, mercado e coleção.

## Evidência

- `RW.BC.Crypto/index.md`, `funcionalidades.md` (token como recompensa).
- `RW.BC.DApp/funcionalidades.md` (loja, granja, mercado, coleção).
