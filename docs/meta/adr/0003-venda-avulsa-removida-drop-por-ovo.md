# ADR 0003 — Venda avulsa de edição removida (drop por ovo)

**Status:** Aceito

## Contexto

O catálogo originalmente previa `obtainEdition` (venda direta de uma edição
específica), o que competia com a mecânica de gacha e fragmentava o caminho de
compra.

## Decisão

Remover a venda avulsa: a loja vende **apenas ovos**. Edições especiais entram em
circulação **dropando de ovo** com peso baixo (`tierWeights[10]` da edição), via
`pickEdition` ponderado.

## Consequências

- Caminho de compra único e consistente (sempre via Forge/VRF).
- Raridade controlada por pesos por tier no catálogo, não por preço fixo.
- O campo `distribution` (Gacha/DirectSale) permanece no modelo, mas o fluxo
  efetivo é Gacha.
- Simplifica o dApp: a loja tem só ovos.

## Evidência

- `RW.BC.Crypto/funcionalidades.md` (item 2 — `pickEdition`, sem `obtainEdition`).
- `.claude/rules/crypto.md` (venda avulsa removida; edições dropam de ovo).
- `RW.BC.DApp/funcionalidades.md` (item 5 — loja só de ovos).
