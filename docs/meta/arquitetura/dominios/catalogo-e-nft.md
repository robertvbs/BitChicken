# Domínio — Catálogo e NFT

## Responsabilidade

O ativo central do ecossistema: NFTs ERC-721 (galinhas) com stats fixos por
edição, catálogo de espécies/edições e 10 tiers de preço de mint em BNB. O
`tokenURI` é montado **on-chain** (sem SSTORE de URI por token).

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| `BitChickenNFT` | `RW.BC.Crypto` | ERC-721 upgradeável; compõe tiers + catálogo + referral |
| `CatalogManagement` | `RW.BC.Crypto` | registro de `Edition` + `pickEdition` (gacha ponderada) |
| `MintTierManagement` | `RW.BC.Crypto` | 10 tiers de preço estritamente crescentes |
| `catalog.ts`, `nft.ts` (handlers) | `RW.BC.Indexer` | indexa edições e NFTs (mint/transfer/rename/burned) |
| `editions` / `nfts` (views) | `RW.BC.Api` | `GET /editions`, `GET /accounts/{addr}/nfts` |
| Coleção, Loja, Painéis Editions/NFT | `RW.BC.DApp` | exibe catálogo, posse e administra edições/tiers |

## Entidades e funções principais

- `Edition`: nome, artURI (IPFS), stats fixos (health/skill/morale > 0), rarity,
  `maxSupply` (0=ilimitado), janela de mint, `distribution` (Gacha/DirectSale),
  `tierWeights[10]`. Stats e maxSupply são imutáveis pós-registro.
- `pickEdition(tier, randomWord)`: seleção ponderada cumulativa entre edições
  Gacha elegíveis; avança linearmente se a sorteada esgotar por corrida.
- `forgeMint(to, editionId, gender, name, referrerCode)`: só o Forge chama;
  incrementa `minted`, grava dados per-token, processa o vínculo de indicação e retorna
  `(tokenId, referrer, rateBps)`, `_safeMint`.
- `rename(tokenId, newName)`: só o dono; queima `renamePrice` BCKN; nome
  sanitizado on-chain (`[A-Za-z0-9 ]{1,24}`).
- **Venda avulsa (`obtainEdition`) foi removida** — edições especiais hoje dropam
  de ovo com peso baixo.

## Integrações entre domínios

- **Forge → NFT:** mint pós-VRF (ver [forge-gacha.md](forge-gacha.md)).
- **NFT → BCKN:** `burnFrom` de rename (ver [token-bckn.md](token-bckn.md)). A indicação não minta BCKN (recompensa em BNB).
- **Marketplace/Staking → NFT:** transferência, royalty, custódia (ver respectivos domínios).
- **Indexer:** `editions` é lida do contrato no bloco do evento (não do payload)
  para consistência; `nfts` deriva `burned` de `to == 0x0`.

## Evidência

- `RW.BC.Crypto/funcionalidades.md` — itens 2, 3, 5; `contratos.md` — `BitChickenNFT`.
- `RW.BC.Indexer/funcionalidades.md` — itens 3 e 4.
- `RW.BC.Api/funcionalidades.md` — itens 6 e 7.
- `RW.BC.DApp/funcionalidades.md` — itens 8 (Coleção) e 13 (Admin).
