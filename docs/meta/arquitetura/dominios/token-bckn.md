# Domínio — Token BCKN

## Responsabilidade

Moeda utilitária do ecossistema: ERC-20 upgradeável com **cap de emissão**.
Serve como produção (yield) do staking e _sink_ de rename de NFT. Não é vendido — entra
em circulação só por mint controlado. (A recompensa de **indicação** migrou para **BNB**;
ver [indicacao.md](indicacao.md).)

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| `BitChickenToken` (BCKN) | `RW.BC.Crypto` | ERC-20 upgradeável, `MINTER_ROLE`, pausable, burnable |
| `IBitChickenToken` | `RW.BC.Crypto` | interface consumida por NFT e Staking |
| `token.ts` (handler) | `RW.BC.Indexer` | indexa `Transfer` em `token_transfers` |
| Painel Token (admin) | `RW.BC.DApp` | `emissionCap`, pausar/despausar |
| Transparência | `RW.BC.Api` | `SUM(value)` de `token_transfers` (total BCKN) |

## Funções e invariantes principais

- `mint` reverte `EmissionCapExceeded` se `totalMinted + amount > emissionCap`.
- `totalMinted` é monotônico — queimas não o decrementam.
- `MINTER_ROLE` concedido **apenas ao Staking** (yield); revogado do deployer após
  bootstrap. O NFT **não** tem `MINTER_ROLE` (só usa `burnFrom` no rename).
- `setEmissionCap` reverte `CapBelowTotalMinted`; cap inicial = 0 (deploy seta 1e9 BCKN).
- `burnFrom` usado pelo NFT no rename (queima `renamePrice`).

## Integrações entre domínios

- **NFT → BCKN:** `burnFrom` (rename). A indicação **não** minta BCKN (recompensa em BNB).
- **Staking → BCKN:** `mint` (yield líquido por ciclo).
- **Read-model:** o indexer registra todas as transferências (incluindo mint
  `from=0x0` e burn `to=0x0`) para a página de Transparência.

## Evidência

- `RW.BC.Crypto/integracoes.md` — "BitChickenNFT → BitChickenToken", "BitChickenStaking → BitChickenToken".
- `RW.BC.Crypto/contratos.md` — `BitChickenToken`.
- `RW.BC.Indexer/funcionalidades.md` — item 8 (Transferências do Token BCKN).
- `RW.BC.Api/funcionalidades.md` — item 13 (resumo de transparência).
