# Domínio — Marketplace

## Responsabilidade

Mercado secundário P2P **não-custodial** de NFTs: listar/cancelar/comprar e
propor/aceitar swaps atômicos (com perna de BNB opcional). O NFT permanece na
carteira do vendedor até a compra.

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| `BitChickenMarketplace` | `RW.BC.Crypto` | upgradeável; `list`, `cancel`, `obtain`, swap |
| `index.ts` (handlers) | `RW.BC.Indexer` | indexa `listings`, `sales`, `swaps` |
| `listings` / `sales` (views) | `RW.BC.Api` | `GET /marketplace/listings`, `GET /transparency/sales` |
| Marketplace, Transparência | `RW.BC.DApp` | UI de mercado (realtime via SignalR) e histórico de vendas |

## Funções e regras principais

- **Não-custodial:** `list` exige aprovação prévia (falha-rápida para não criar
  listing "morto"); o NFT só sai da carteira no `obtain`.
- `obtain`: split de receitas — `platformFee → feeSink`, royalty EIP-2981 →
  receiver, restante → vendedor; excesso de BNB devolvido ao comprador.
- Reverts: `ZeroPrice`, `AlreadyListed`, `InsufficientPayment`, `FeesExceedPrice`,
  `NotTokenOwner` (vendedor deixou de ser dono), `NotApproved`.
- **Swap:** proposer oferece `offeredId` + `bnbLeg` opcional travado no contrato;
  aceitor troca atomicamente; sem taxa de plataforma; `cancelSwap` devolve `bnbLeg`.
- Deploy: `platformFeeBps = 250` (2.5%).

## Integrações entre domínios

- **Marketplace → NFT:** `safeTransferFrom`, `royaltyInfo`, `ownerOf`,
  `getApproved` (ver [catalogo-e-nft.md](catalogo-e-nft.md)).
- **Realtime:** o `MarketplaceEventsListener` detecta mudança em `indexer.listings`
  e publica `marketChanged` (SignalR) — o dApp recarrega com debounce e reconcilia.
- **Transparência:** `sales` (com `platform_fee`/`royalty` desagregados) alimenta
  `GET /transparency/sales` e o resumo (volume total).

## Evidência

- `RW.BC.Crypto/funcionalidades.md` — item 8; `contratos.md` — `BitChickenMarketplace`.
- `RW.BC.Indexer/funcionalidades.md` — itens 1 e 2.
- `RW.BC.Api/funcionalidades.md` — itens 8, 12, 14.
- `RW.BC.DApp/funcionalidades.md` — itens 7 (Marketplace) e 10 (Transparência).
