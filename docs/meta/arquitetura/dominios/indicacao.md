# Domínio — Indicação (Referral)

## Responsabilidade

Programa de indicação **de 1 nível (direto)** embutido no ecossistema: qualquer endereço pode se
registrar e receber um código; quando um indicado abre o **primeiro ovo** com o código, o **indicador**
recebe uma **fatia em BNB do preço do ovo**, sacável via pull-payment. O **estado** vive no NFT; o **BNB**
vive no Forge. Ver [ADR 0009](../../adr/0009-indicacao-bnb-um-nivel-por-rank.md).

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| `ReferralTreeManagement` | `RW.BC.Crypto` | estado: códigos, upline, `referredCount`, tabela de níveis; `registerReferrer`, `setReferralLevels` |
| `BitChickenForge` | `RW.BC.Crypto` | split do preço, `pendingReferralBnb`, `claimReferralBnb()`, reserva no `withdraw()` |
| `referral.ts` (handler) | `RW.BC.Indexer` | indexa registros, links e BNB acumulado/sacado |
| views `referral_*` | `RW.BC.Api` | `GET /accounts/{addr}/referral` (código, upline, contagem, acumulado/sacado/pendente em BNB) |
| ReferralService, Granja | `RW.BC.DApp` | persiste `?ref=`; QR/link; `registerReferrer`; `forge.claimReferralBnb()`; exibe nível/taxa |

## Funções e regras principais

- `registerReferrer()`: gera código único ≥ 1000; `AlreadyRegistered` se repetido.
- Upline definido no **1º ovo** que usa o código (first-referrer-wins, imutável); auto-referência e
  código inválido são ignorados silenciosamente. O vínculo emite `ReferralLinked`.
- **Taxa por nível** do indicador, derivada da `referredCount` (indicados que abriram ≥1 ovo), avaliada
  **antes** de contar o novo indicado. Tabela padrão `[0,3,6,8,10]` → `[2%,4%,6%,8%,10%]`, configurável
  por admin (`setReferralLevels`), com **teto 10%** (`MAX_REFERRAL_BPS`).
- **Pago uma vez** (no vínculo): `forgeMint` retorna `(tokenId, referrer, rateBps)`; o Forge acumula
  `amt = paid * rateBps / 10000` em `pendingReferralBnb[referrer]` e emite `ReferralBnbAccrued`.
- Saque via `forge.claimReferralBnb()` (CEI); `NothingToClaim` se zero. `withdraw()` reserva
  `totalPendingRefunds + totalPendingReferralBnb`.

## Integrações entre domínios

- **Forge → Indicação:** o `referrerCode` viaja em `requestObtain` → `forgeMint`; o split do `paid` é
  reservado no Forge (ver [forge-gacha.md](forge-gacha.md)).
- **Indicação ↛ BCKN:** a recompensa é **BNB** (fatia do preço), não mais mint de BCKN — o NFT **não**
  precisa de `MINTER_ROLE`.
- **dApp:** o código `?ref=` é persistido em `localStorage` (TTL 30 dias) e passado na compra; o painel
  lê acumulado/sacado/pendente (BNB) e a contagem da API, e deriva o nível/taxa pela tabela.

## Evidência

- `RW.BC.Crypto/funcionalidades.md` (indicação); `integracoes.md` (split de BNB no Forge).
- `RW.BC.Indexer/funcionalidades.md`; `RW.BC.Api/funcionalidades.md`; `RW.BC.DApp/funcionalidades.md`.
