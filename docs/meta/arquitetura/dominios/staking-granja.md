# Domínio — Staking / Granja

## Responsabilidade

A "granja": o usuário coloca **casais (macho + fêmea)** em custódia do contrato
para gerar produção em BCKN por ciclo. Casais "ideais" (mesma edição) recebem
multiplicador de rendimento.

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| `BitChickenStaking` | `RW.BC.Crypto` | upgradeável; `stakePair`, `claim`, `unstakePair` |
| `staking.ts` (handler) | `RW.BC.Indexer` | indexa `staking_pairs` (`YieldClaimed` atualiza `last_claim_at`); sincroniza `staked`/`owner` dos NFTs |
| `staking_pairs` (view) | `RW.BC.Api` | `GET /accounts/{addr}/staking` (só `status="Staked"`) |
| Granja, Granja Pública | `RW.BC.DApp` | UI de stake/colheita; enriquece com `pendingYield`/`nextUnlock` on-chain |

## Funções e regras principais

- `stakePair(maleId, femaleId)`: gêneros complementares (`GendersNotComplementary`
  se male≠0 ou female≠1); NFTs transferidos para custódia do contrato.
- Yield por ciclo: `score = Σ(wH*H + wS*S + wM*M)` sobre os 2 NFTs;
  `rewardPerCycle = baseRate * score / SCALE`; casal ideal aplica
  `idealPairMultiplierBps` (padrão 2x).
- `CYCLE = 168h`; `lastClaimAt` avança por múltiplos exatos (sem drift).
- Imposto de claim: `taxed = gross * claimBurnBps / 10000`; a porção taxada **não
  é mintada** (não entra em circulação); `net` é mintado ao staker.
- `unstakePair`: auto-claim de ciclos inteiros antes de devolver os NFTs.
- `onERC721Received` rejeita NFT de contrato externo (`UnauthorizedNFT`).

## Integrações entre domínios

- **Staking → NFT:** custódia e devolução de tokens (ver [catalogo-e-nft.md](catalogo-e-nft.md)).
- **Staking → BCKN:** `mint` do yield líquido (exige `MINTER_ROLE`) (ver [token-bckn.md](token-bckn.md)).
- **dApp:** leituras de pares vêm da API (indexer); `pendingYield`/`nextUnlock`
  são lidos direto da cadeia por serem dinâmicos.
- **Indexer:** o handler de staking marca `staked=true` e `owner=staker` nos dois
  NFTs do par, para refletir posse lógica durante o stake.

## Evidência

- `RW.BC.Crypto/funcionalidades.md` — item 7; `contratos.md` — `BitChickenStaking`.
- `RW.BC.Indexer/funcionalidades.md` — item 6.
- `RW.BC.Api/funcionalidades.md` — item 9.
- `RW.BC.DApp/funcionalidades.md` — itens 6 (Granja) e 9 (Granja Pública).
