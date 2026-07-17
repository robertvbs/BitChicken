# Domínio — Forge / Gacha (VRF)

## Responsabilidade

Mecanismo de **gacha**: o usuário compra um ovo pagando o preço de um tier; o
Forge sorteia espécie e gênero usando aleatoriedade verificável (Chainlink VRF
v2.5) e minta o NFT. É o **caminho crítico de compra** do ecossistema.

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| `BitChickenForge` | `RW.BC.Crypto` | imutável; `requestObtain`, `fulfillRandomWords`, refunds |
| `VRFCoordinatorMock` | `RW.BC.Crypto` | mock de VRF para localnet |
| `forge-watch.ts` | `RW.BC.Crypto` | auto-fulfill do mock no localnet (dev) |
| `forge.ts` (handler) | `RW.BC.Indexer` | indexa `forge_requests` (Requested/Fulfilled/Cancelled) |
| `forge_requests` (view) | `RW.BC.Api` | `GET /accounts/{addr}/forge-requests` + detector de `forgeFulfilled` |
| Loja, ForgeWaitService | `RW.BC.DApp` | compra, animação de chocagem, espera por fulfillment |

## Funções e regras principais

- `requestObtain(tier, referrerCode, name)` payable: exige `msg.value == tierPrice`
  (`IncorrectPayment`) e `nft.tierHasAvailable(tier)` (`NothingAvailable`).
- `fulfillRandomWords`: gênero = `word & 1`; chama `pickEdition` + `forgeMint`.
- Falha no `forgeMint` (ex.: edição esgotou por corrida) → BNB enfileirado em
  `pendingRefund[buyer]`; saque via `claimRefund` (pull-payment, CEI).
- `cancelStaleRequest` após `STALE_BLOCKS = 256` (`RequestNotStale` antes disso).
- `withdraw()` drena só `balance - totalPendingRefunds`.

## Integrações entre domínios

- **Forge → Chainlink VRF:** `requestRandomWords` / callback `fulfillRandomWords`.
- **Forge → NFT:** `pickEdition` + `forgeMint` (ver [catalogo-e-nft.md](catalogo-e-nft.md)).
- **Forge → Indicação:** `forgeMint` propaga `referrerCode` (ver [indicacao.md](indicacao.md)).
- **dApp ↔ API (realtime):** SignalR `forgeFulfilled` resolve a espera do dApp;
  fallbacks: `GET /forge-requests` e polling on-chain (timeout 45 s).

## Armadilha crítica

No localnet o VRF é um **mock** que só responde com `npm run forge:watch` rodando
(o AppHost já o sobe). Sem ele, o ovo fica preso em "Chocando…" e o modal estoura
no timeout.

## Evidência

- `RW.BC.Crypto/funcionalidades.md` — item 4; `integracoes.md` — "Chainlink VRF v2.5".
- `RW.BC.Indexer/funcionalidades.md` — item 5.
- `RW.BC.Api/funcionalidades.md` — itens 10 e 14.
- `RW.BC.DApp/funcionalidades.md` — item 5; `armadilhas.md` (ovo travado).
