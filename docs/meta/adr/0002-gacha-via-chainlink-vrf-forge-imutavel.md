# ADR 0002 — Gacha via Chainlink VRF com Forge imutável

**Status:** Aceito

## Contexto

A mecânica de ovo precisa de aleatoriedade **verificável e à prova de
manipulação** para sortear espécie e gênero; pseudoaleatoriedade on-chain
(blockhash) é manipulável por mineradores/validadores.

## Decisão

Usar **Chainlink VRF v2.5** no contrato **Forge**, que faz `requestObtain` →
`requestRandomWords` → `fulfillRandomWords` → `pickEdition` + `forgeMint`. O Forge
é **não-upgradeável** (sem proxy), trocável via `nft.setForge(...)`.

## Consequências

- Mint é **assíncrono** (callback do VRF): o dApp espera via SignalR `forgeFulfilled`
  com fallbacks (API + polling on-chain, timeout 45 s).
- Falhas pós-request viram refund em BNB (`pendingRefund`/`claimRefund`) e
  `cancelStaleRequest` após 256 blocos.
- No localnet o VRF é um **mock** que só responde com `forge:watch` rodando —
  armadilha do ovo travado em "Chocando…".
- Imutabilidade do Forge reduz superfície de risco e dispensa proxy; substituição
  é explícita via setter no NFT.

## Evidência

- `RW.BC.Crypto/funcionalidades.md` (item 4); `integracoes.md` (Chainlink VRF).
- `RW.BC.DApp/funcionalidades.md` (item 5); `armadilhas.md` (ovo travado).
