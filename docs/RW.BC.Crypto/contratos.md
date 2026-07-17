# Contratos — RW.BC.Crypto

Referencia completa de todos os contratos Solidity do ecossistema BitChicken.

---

## errors.sol — Erros Compartilhados

Declaracoes canonicas de erros usados por multiplos contratos. Centraliza seletores para evitar drift.

| Erro | Parametros | Significado |
|---|---|---|
| `ZeroAddress()` | — | Endereco zero em posicao critica |
| `TransferFailed()` | — | Falha em transferencia de BNB via low-level call |
| `NotTokenOwner(uint256 tokenId)` | tokenId | Chamador nao e dono do token |
| `InvalidBasisPoints(uint256 bps)` | bps | Basis points excedem 10000 (100%) |

---

## BitChickenToken

**Arquivo:** `contracts/bitchicken-token.sol`
**Proposito:** Token ERC-20 BCKN — moeda utilitaria do ecossistema (yield de staking, recompensas de referral, sink de rename).
**Heranca:** `Initializable`, `ERC20Upgradeable`, `ERC20BurnableUpgradeable`, `ERC20PausableUpgradeable`, `ERC20PermitUpgradeable`, `AccessControlUpgradeable`.
**Storage ERC-7201:** `bitChicken.BitChickenToken` (slot `0x2e076ce1b568fb1782924f5ed1d16e498b0e44798ce784242508b88ccb5d9a00`).

### Funcoes

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `initialize(name_, symbol_, admin, pauser, minter)` | `external` | `initializer` | Inicia ERC-20, roles; cap inicial = 0 |
| `mint(address to, uint256 amount)` | `external` | `MINTER_ROLE` | Minta tokens respeitando `emissionCap`; incrementa `totalMinted` |
| `setEmissionCap(uint256 newCap)` | `external` | `DEFAULT_ADMIN_ROLE` | Atualiza cap; reverte se `newCap < totalMinted` |
| `pause()` | `external` | `PAUSER_ROLE` | Pausa transferencias |
| `unpause()` | `external` | `PAUSER_ROLE` | Despausa transferencias |
| `totalMinted()` | `external view` | publico | Retorna total mintado (nao decrementado por queimas) |
| `emissionCap()` | `external view` | publico | Retorna cap de emissao atual |
| `burnFrom(account, amount)` | herdado (`ERC20Burnable`) | aprovacao do account | Queima tokens do account, deduzindo allowance do caller |

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `EmissionCapUpdated(uint256 oldCap, uint256 newCap)` | indexed x2 | `setEmissionCap` bem-sucedido |

### Erros customizados

| Erro | Parametros | Causa |
|---|---|---|
| `EmissionCapExceeded(uint256 requested, uint256 available)` | requested, available | `mint` ultrapassaria o cap |
| `CapBelowTotalMinted(uint256 proposed, uint256 minted)` | proposed, minted | Novo cap menor que `totalMinted` |

---

## MintTierManagement (abstrato)

**Arquivo:** `contracts/mint-tier-management.sol`
**Proposito:** Gerencia 10 tiers de preco em BNB com valores estritamente crescentes. Herdado por `BitChickenNFT`.
**Storage ERC-7201:** `bitChicken.MintTierManagement` (slot `0x19eab6994f823fcb52c95aa0de0267fadc01d12f16fa1510f95961b825cd5600`). Gap: `uint256[50]`.

### Funcoes

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `updateTierPrices(uint256[10] prices)` | `external virtual` | owner (override em NFT) | Substitui o array de 10 precos; valida ascendencia estrita e > 0 |
| `getTierPrices()` | `external view` | publico | Retorna array de 10 precos em BNB wei |
| `tierPrice(uint256 index)` | `public view` | publico | Retorna preco de um tier; reverte `TierOutOfRange` se index >= 10 |

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `TierPricesUpdated(uint256[10] prices)` | — | `updateTierPrices` bem-sucedido |

### Erros customizados

| Erro | Parametros | Causa |
|---|---|---|
| `InvalidTierPrices(uint256 index, uint256 value)` | index, value | Array nao estritamente crescente ou zero |
| `TierOutOfRange(uint256 index)` | index | Index >= 10 |

---

## CatalogManagement (abstrato)

**Arquivo:** `contracts/catalog-management.sol`
**Proposito:** Registro on-chain de edicoes/especies de NFT com selecao gacha ponderada por tier. Herdado por `BitChickenNFT`.
**Storage ERC-7201:** `bitChicken.CatalogManagement` (slot `0xd18054971e7df99c4c297871bc01acb57c40dc0dbcb1e329dd20e69f32b00600`). Gap: `uint256[50]`.

### Tipos

- **`Edition`**: name, artURI, health, skill, morale, rarity, maxSupply, minted, mintStart, mintEnd, price, distribution, active.
- **`Distribution`**: `Gacha = 0`, `DirectSale = 1` (reservado, sem uso ativo na rota de mint).

### Funcoes publicas/externas exposta pelo NFT (delegacao com onlyOwner)

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `getEdition(uint256 editionId)` | `external view` | publico | Retorna struct `Edition` completo |
| `editionCount()` | `external view` | publico | Retorna total de edicoes registradas |
| `getEditionTierWeights(uint256 editionId)` | `external view` | publico | Retorna array `uint16[10]` de pesos por tier |
| `tierHasAvailable(uint8 tier)` | `external view` | publico | `true` se ao menos 1 edicao Gacha elegivel existe para o tier |
| `pickEdition(uint8 tier, uint256 randomWord)` | `external view` | publico | Selecao ponderada cumulativa em memoria; retorna editionId |

### Funcoes internas (usadas pelo NFT)

- `_registerEdition(...)` — registra nova edicao com todos os parametros.
- `_incrementMinted(editionId)` — incrementa contador e verifica cap.
- `_setEditionActive(editionId, active)` — alterna flag ativo.
- `_setEditionWindow(editionId, mintStart, mintEnd)` — atualiza janela.

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `EditionRegistered(uint256 editionId, string name, uint8 distribution, uint8 rarity)` | indexed editionId | Nova edicao registrada |
| `EditionActiveSet(uint256 editionId, bool active)` | indexed editionId | Active flag alterado |
| `EditionWindowSet(uint256 editionId, uint64 mintStart, uint64 mintEnd)` | indexed editionId | Janela de mint atualizada |

### Erros customizados

| Erro | Parametros | Causa |
|---|---|---|
| `UnknownEdition(uint256 editionId)` | editionId | ID nao registrado (health == 0) |
| `EditionSoldOut(uint256 editionId)` | editionId | `minted >= maxSupply` |
| `NoAvailableEdition(uint8 tier)` | tier | Nenhuma edicao elegivel para o tier |
| `InvalidEditionStats()` | — | health, skill ou morale == 0 |
| `InvalidEditionWindow()` | — | `mintEnd <= mintStart` (ambos != 0) |
| `InvalidEditionName()` | — | Nome vazio ou > 64 bytes |

---

## ReferralTreeManagement (abstrato)

**Arquivo:** `contracts/referral-tree-management.sol`
**Proposito:** Estado da indicacao **de 1 nivel** (codigos, upline, contagem de indicados e tabela de niveis). A recompensa em si e em **BNB**, paga pelo **Forge** (split do preco do ovo) — este modulo so guarda o estado e informa a taxa. Herdado por `BitChickenNFT`. Ver [ADR 0009](../meta/adr/0009-indicacao-bnb-um-nivel-por-rank.md).
**Storage ERC-7201:** `bitChicken.ReferralTreeManagement` (slot `0xaf2bd85fe1340af2f384b035a02328d38727a002d838ba77a3025dacb1a81700`).
**Constante:** `MAX_REFERRAL_BPS = 1000` (teto de 10% — garante ≥90% do preco ao negocio).

### Funcoes

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `registerReferrer()` | `external` | qualquer | Registra caller como referrer; atribui codigo >= 1000 |
| `getReferrerCode(address account)` | `external view` | publico | Codigo do account ou 0 se nao registrado |
| `getUpline(address buyer)` | `external view` | publico | Upline direto ou address(0) |
| `getReferredCount(address referrer)` | `external view` | publico | Nº de indicados vinculados (que abriram ≥1 ovo) |
| `getReferralLevels()` | `external view` | publico | Tabela `(uint256[] thresholds, uint16[] ratesBps)` |
| `getReferralRateBps(address referrer)` | `external view` | publico | Taxa atual (bps) que o referrer ganharia num novo indicado |

> **Interno:** `_processReferral(buyer, code) → (referrer, rateBps)` paga so no **1º ovo** do indicado
> (vincula o upline, avalia a taxa pela `referredCount` **antes** de incrementar, emite `ReferralLinked`).
> `_rateBpsOf(count)` retorna a taxa do maior limiar ≤ count.

### Funcoes admin (delegadas do NFT com onlyOwner)

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `setReferralLevels(uint256[] thresholds, uint16[] ratesBps)` | `external` | owner (NFT) | Substitui a tabela de niveis; valida `thresholds[0]==0`, crescente, lengths iguais, cada `rate <= MAX_REFERRAL_BPS` |

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `ReferralLinked(address buyer, address referrer)` | indexed x2 | Vinculo do upline (1º ovo do indicado) |
| `ReferrerRegistered(address referrer, uint256 code)` | indexed x2 | `registerReferrer` |

> A recompensa (BNB) e seus eventos `ReferralBnbAccrued`/`ReferralBnbClaimed` ficam no **Forge** (abaixo).

### Erros customizados

| Erro | Causa |
|---|---|
| `AlreadyRegistered()` | Endereco ja tem codigo de referrer |
| `InvalidLevels()` | Tabela invalida: vazia, lengths diferentes, `thresholds[0]!=0`, nao-crescente, ou `rate > MAX_REFERRAL_BPS` |

---

## BitChickenNFT

**Arquivo:** `contracts/bitchicken-nft.sol`
**Proposito:** NFT ERC-721 do ecossistema — BitChicken com stats por edicao, mint exclusivo via Forge (gacha VRF), rename queimando BCKN, tokenURI on-chain sem SSTORE por token.
**Heranca:** `Initializable`, `ERC721Upgradeable`, `ERC721EnumerableUpgradeable`, `ERC721PausableUpgradeable`, `ERC721RoyaltyUpgradeable`, `Ownable2StepUpgradeable`, `ReentrancyGuardTransient`, `MintTierManagement`, `CatalogManagement`, `ReferralTreeManagement`.
**Storage ERC-7201:** `bitChicken.BitChickenNFT` (slot `0x5a03a8c914e3b6586ac93d72e1f92394401b69a932920cefae8e2afc04052a00`).

### Funcoes proprias

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `initialize(address owner_, address rewardToken_)` | `external` | `initializer` | Inicia ERC-721 "BitChicken" / "BCK", modulos, nextId = 1 |
| `forgeMint(address to, uint256 editionId_, uint8 gender_, string name_, uint256 referrerCode_)` | `external nonReentrant whenNotPaused` | so Forge autorizado | Minta NFT; incrementa edition.minted; processa o vinculo de indicacao; **retorna `(tokenId, referrer, referralRateBps)`** (referrer/rate != 0 so no 1º ovo do indicado) |
| `rename(uint256 tokenId, string newName_)` | `external nonReentrant whenNotPaused` | dono do token | Renomeia; queima `renamePrice` BCKN via burnFrom |
| `tokenURI(uint256 tokenId)` | `public view` | publico | JSON metadata on-chain (base64); sem SSTORE |
| `tokenData(uint256 tokenId)` | `external view` | publico | Retorna (editionId, gender, name) |
| `attributesOf(uint256 tokenId)` | `external view` | publico | Retorna (health, skill, morale, genderBit) da edicao |
| `editionOf(uint256 tokenId)` | `external view` | publico | Retorna editionId do token |
| `nextId()` | `external view` | publico | Proximo tokenId a ser mintado |
| `forge()` | `external view` | publico | Endereco do Forge autorizado |
| `renamePrice()` | `external view` | publico | Custo de rename em BCKN wei |
| `setForge(address forge_)` | `external` | `onlyOwner` | Define Forge autorizado |
| `setRenamePrice(uint256 price_)` | `external` | `onlyOwner` | Define custo de rename |
| `setRoyalty(address receiver_, uint96 bps_)` | `external` | `onlyOwner` | Define royalty EIP-2981 padrao |
| `registerEdition(...)` | `external` | `onlyOwner` | Delega para `_registerEdition` |
| `setEditionActive(uint256 editionId, bool active_)` | `external` | `onlyOwner` | Delega para `_setEditionActive` |
| `setEditionWindow(uint256 editionId, uint64 mintStart_, uint64 mintEnd_)` | `external` | `onlyOwner` | Delega para `_setEditionWindow` |
| `updateTierPrices(uint256[10] prices)` | `external override` | `onlyOwner` | Delega para `_updateTierPrices` |
| `setReferralLevels(uint256[] thresholds, uint16[] ratesBps)` | `external` | `onlyOwner` | Delega para `_setReferralLevels` (tabela de niveis da indicacao) |
| `withdraw()` | `external` | `onlyOwner` | Drena BNB acidental do contrato NFT (safety valve) |
| `pause()` | `external` | `onlyOwner` | Pausa mints e transferencias |
| `unpause()` | `external` | `onlyOwner` | Despausa |

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `Minted(address to, uint256 tokenId, uint256 editionId, uint8 gender, string name)` | indexed x3 | `forgeMint` bem-sucedido |
| `Renamed(uint256 tokenId, string newName, uint256 burned)` | indexed tokenId | `rename` bem-sucedido |
| `RenamePriceSet(uint256 newPrice)` | — | `setRenamePrice` |
| `ForgeSet(address forge)` | indexed forge | `setForge` |
| `Withdrawn(address to, uint256 amount)` | indexed to | `withdraw` |

### Erros customizados

| Erro | Causa |
|---|---|
| `CallerNotForge()` | `msg.sender != $.forge` em `forgeMint` |
| `MintWithdrawFailed()` | Falha em `withdraw` BNB do contrato NFT |
| `InvalidName()` | Nome fora do charset ASCII alfanumerico + espaco ou tamanho invalido |
| (herdados) | `ZeroAddress`, `NotTokenOwner`, `InvalidTierPrices`, `TierOutOfRange`, `UnknownEdition`, `EditionSoldOut`, `NoAvailableEdition`, `InvalidEditionStats`, `InvalidEditionWindow`, `InvalidEditionName`, `AlreadyRegistered`, `InvalidLevels` |

---

## BitChickenForge

**Arquivo:** `contracts/bitchicken-forge.sol`
**Proposito:** Contrato gacha nao-upgradeavel. Recebe BNB, solicita aleatoriedade ao Chainlink VRF v2.5, seleciona edicao e minta NFT via `forgeMint`. Gerencia reembolsos de compradores (`totalPendingRefunds`) **e a recompensa de indicacao em BNB** (`totalPendingReferralBnb`) com pull-payment e reserva no `withdraw`.
**Heranca:** `VRFConsumerBaseV2Plus` (Chainlink). Owner-controllable via `ConfirmedOwner` da Chainlink (herdado do VRFConsumerBaseV2Plus) — não é o `Ownable`/`Ownable2Step` da OZ usado nos demais contratos.

### Funcoes

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `constructor(vrfCoordinator_, nft_, keyHash_, subId_, callbackGasLimit_, requestConfirmations_, owner_)` | `public` | deploy | Inicializa; transfere ownership se `owner_ != msg.sender` |
| `requestObtain(uint8 tier_, uint256 referrerCode_, string name_)` | `external payable` | qualquer | Valida preco e disponibilidade; cria ForgeRequest; chama VRF; retorna requestId |
| `fulfillRandomWords(uint256 requestId, uint256[] randomWords)` | `internal override` | VRF coordinator | Seleciona edicao + gender; chama `forgeMint` e recebe `(tokenId, referrer, rateBps)`; em sucesso, se `referrer != 0`, acumula `paid * rateBps / 10000` em `pendingReferralBnb` e emite `ReferralBnbAccrued`; em falha enfileira reembolso |
| `cancelStaleRequest(uint256 requestId)` | `external` | comprador original | Cancela pedido apos 256 blocos; enfileira reembolso BNB |
| `claimRefund()` | `external` | qualquer (com saldo) | CEI: zera `pendingRefund`; decrementa `totalPendingRefunds`; transfere BNB |
| `claimReferralBnb()` | `external` | referrer (com saldo) | CEI: zera `pendingReferralBnb`; decrementa `totalPendingReferralBnb`; transfere BNB; reverte `NothingToClaim` |
| `setVRFConfig(keyHash_, subId_, callbackGasLimit_, requestConfirmations_)` | `external` | `onlyOwner` | Atualiza parametros VRF; valida limites de gas e confirmacoes |
| `withdraw()` | `external` | `onlyOwner` | Drena `balance - (totalPendingRefunds + totalPendingReferralBnb)` para o owner |
| `receive()` | `external payable` | — | Aceita BNB direto (necessario para OZ VRF) |

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `ForgeRequested(address buyer, uint256 requestId, uint8 tier)` | indexed x2 | `requestObtain` bem-sucedido |
| `ForgeFulfilled(address buyer, uint256 requestId, uint256 tokenId, uint256 editionId)` | indexed x3 | VRF fulfillment + forgeMint OK |
| `RequestCancelled(address buyer, uint256 requestId, uint256 amount)` | indexed x2 | `cancelStaleRequest` ou falha no fulfillment |
| `RefundClaimed(address buyer, uint256 amount)` | indexed buyer | `claimRefund` |
| `ReferralBnbAccrued(address referrer, address buyer, uint256 amount)` | indexed x2 | Split de indicacao acumulado no 1º ovo do indicado |
| `ReferralBnbClaimed(address referrer, uint256 amount)` | indexed referrer | `claimReferralBnb` |
| `Withdrawn(address to, uint256 amount)` | indexed to | `withdraw` |
| `VRFConfigSet(bytes32 keyHash, uint256 subId, uint32 callbackGasLimit, uint16 requestConfirmations)` | — | `setVRFConfig` |

### Erros customizados

| Erro | Parametros | Causa |
|---|---|---|
| `IncorrectPayment(uint256 sent, uint256 required)` | sent, required | `msg.value != tierPrice(tier)` |
| `NothingAvailable(uint8 tier)` | tier | Nenhuma edicao disponivel para o tier |
| `RequestNotStale()` | — | Menos de 256 blocos desde o pedido |
| `NotRequestOwner()` | — | Caller nao e o comprador do request |
| `UnknownRequest(uint256 requestId)` | requestId | Request nao encontrado |
| `CallbackGasLimitOutOfRange(uint32 value)` | value | Gas fora de [50_000, 2_500_000] |
| `RequestConfirmationsTooLow()` | — | `requestConfirmations < 1` |
| `NothingToRefund()` | — | `pendingRefund[caller] == 0` |
| `NothingToClaim()` | — | `pendingReferralBnb[caller] == 0` |
| (compartilhados) | | `TransferFailed`, `ZeroAddress` |

---

## BitChickenStaking

**Arquivo:** `contracts/bitchicken-staking.sol`
**Proposito:** Granja de staking: casais (Male+Female) geram yield em BCKN por ciclos semanais. Multiplicador para casal ideal (mesma edicao).
**Heranca:** `Initializable`, `Ownable2StepUpgradeable`, `PausableUpgradeable`, `ReentrancyGuardTransient`, `IERC721Receiver`.
**Storage ERC-7201:** `bitChicken.BitChickenStaking` (slot `0xa8dd34af241935807ef6f43b516ddb6e0cd68b5368cc2252a0c1457db5e38c00`).

### Funcoes

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `initialize(owner_, nft_, rewardToken_)` | `external` | `initializer` | Configura contratos; weights = 1e18; nextPairId = 1; idealMultiplier = 20000 |
| `stakePair(uint256 maleId, uint256 femaleId)` | `external nonReentrant whenNotPaused` | dono dos NFTs | Transfere par para custodia; cria Pair; retorna pairId |
| `claim(uint256 pairId)` | `external nonReentrant whenNotPaused` | dono do par | Clama ciclos completos; minta net para caller |
| `claimRange(uint256 start, uint256 count)` | `external nonReentrant whenNotPaused` | dono dos pares | Batch claim por indices; pula pares sem ciclos |
| `unstakePair(uint256 pairId)` | `external nonReentrant whenNotPaused` | dono do par | Auto-claim + devolve NFTs |
| `onERC721Received(...)` | `external view` | NFT contract | Valida origem; retorna selector |
| `getPairsCount(address staker)` | `external view` | publico | Total de pares ativos do staker |
| `getPairs(address staker, uint256 start, uint256 count)` | `external view` | publico | Pagina de IDs de pares |
| `getPair(uint256 pairId)` | `external view` | publico | Struct Pair completo |
| `pendingOf(uint256 pairId)` | `external view` | publico | Gross yield pendente (antes de taxa) |
| `pendingTotal(address staker)` | `external view` | publico | Soma de gross yield de todos os pares |
| `nextUnlock(uint256 pairId)` | `external view` | publico | Timestamp do proximo unlock |
| `isStaked(uint256 tokenId)` | `external view` | publico | `true` se NFT em custodia |
| `getConfig()` | `external view` | publico | Retorna (baseRate, wHealth, wSkill, wMorale, claimBurnBps, idealPairMultiplierBps) |
| `setBaseRate(uint256 rate_)` | `external` | `onlyOwner` | Define baseRate; limite MAX_BASE_RATE = 1e27 |
| `setWeights(uint256 wH_, uint256 wS_, uint256 wM_)` | `external` | `onlyOwner` | Define pesos de atributos; limite MAX_WEIGHT = 1e36 |
| `setClaimBurnBps(uint256 bps_)` | `external` | `onlyOwner` | Define taxa de claim (0-10000) |
| `setIdealPairMultiplierBps(uint256 bps_)` | `external` | `onlyOwner` | Define multiplicador de casal ideal; minimo 10000 |
| `pause()` | `external` | `onlyOwner` | Pausa stake/claim/unstake |
| `unpause()` | `external` | `onlyOwner` | Despausa |

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `PairStaked(address staker, uint256 pairId, uint256 maleId, uint256 femaleId, bool matched)` | indexed x2 | `stakePair` |
| `PairUnstaked(address staker, uint256 pairId, uint256 maleId, uint256 femaleId)` | indexed x2 | `unstakePair` |
| `YieldClaimed(address staker, uint256 pairId, uint256 gross, uint256 burned, uint256 net, uint256 cycles)` | indexed x2 | `claim`/`claimRange`/`unstakePair` com yield |
| `BaseRateSet(uint256 newRate)` | — | `setBaseRate` |
| `WeightsSet(uint256 wHealth, uint256 wSkill, uint256 wMorale)` | — | `setWeights` |
| `ClaimBurnBpsSet(uint256 bps)` | — | `setClaimBurnBps` |
| `IdealPairMultiplierBpsSet(uint256 bps)` | — | `setIdealPairMultiplierBps` |

### Erros customizados

| Erro | Parametros | Causa |
|---|---|---|
| `GendersNotComplementary(uint256 maleId, uint256 femaleId)` | maleId, femaleId | Par nao e Male+Female |
| `AlreadyStaked(uint256 tokenId)` | tokenId | NFT ja em par ativo |
| `NotPairOwner(uint256 pairId)` | pairId | Caller nao e dono do par |
| `CycleNotElapsed(uint256 pairId, uint256 nextUnlock)` | pairId, nextUnlock | Menos de 168h desde lastClaimAt |
| `RangeOutOfBounds()` | — | `start >= total` em `claimRange` |
| `MultiplierTooLow(uint256 bps)` | bps | `bps < 10000` |
| `UnauthorizedNFT()` | — | NFT externo em `onERC721Received` |
| `BaseRateTooHigh(uint256 value)` | value | `value > MAX_BASE_RATE` |
| `WeightTooHigh(uint256 value)` | value | `value > MAX_WEIGHT` |
| (compartilhados) | | `ZeroAddress`, `NotTokenOwner`, `InvalidBasisPoints` |

---

## BitChickenMarketplace

**Arquivo:** `contracts/bitchicken-marketplace.sol`
**Proposito:** Marketplace P2P nao-custodial para NFTs BitChicken. Suporta listagem a preco fixo (compra via `obtain`) e swap atomico bilateral (`proposeSwap`/`acceptSwap`). Taxa de plataforma + royalty EIP-2981 em compras.
**Heranca:** `Initializable`, `Ownable2StepUpgradeable`, `PausableUpgradeable`, `ReentrancyGuardTransient`.
**Storage ERC-7201:** `bitChicken.BitChickenMarketplace` (slot `0xe384b39b6f86c62bfc030671631978a1eae0a2b9ff7c04045a912b44bb8e1500`).

### Funcoes

| Funcao | Visibilidade | Acesso | Efeito / Retorno |
|---|---|---|---|
| `initialize(owner_, nft_, feeSink_, platformFeeBps_)` | `external` | `initializer` | Configura NFT, taxa e sink; nextSwapId = 1 |
| `list(uint256 tokenId, uint96 price)` | `external whenNotPaused` | dono + aprovacao previa | Cria listing; falha-rapido sem aprovacao |
| `cancel(uint256 tokenId)` | `external` | vendedor original | Remove listing |
| `obtain(uint256 tokenId)` | `external payable nonReentrant whenNotPaused` | qualquer (com BNB suficiente) | Compra NFT; split de receitas; refund de excesso |
| `proposeSwap(uint256 offeredId, uint256 wantedId)` | `external payable whenNotPaused` | dono do offeredId | Cria SwapProposal; trava BNB leg; retorna swapId |
| `cancelSwap(uint256 swapId)` | `external nonReentrant` | proposer original | Remove proposta; devolve BNB leg |
| `acceptSwap(uint256 swapId)` | `external nonReentrant whenNotPaused` | dono do wantedId | Troca atomica de NFTs; BNB leg para acceptor |
| `getListing(uint256 tokenId)` | `external view` | publico | Struct Listing (seller=0 se nao listado) |
| `getSwap(uint256 swapId)` | `external view` | publico | Struct SwapProposal (proposer=0 se inexistente) |
| `getFeeConfig()` | `external view` | publico | Retorna (feeSink, platformFeeBps) |
| `setPlatformFee(address feeSink_, uint256 bps_)` | `external` | `onlyOwner` | Atualiza taxa e sink |
| `pause()` | `external` | `onlyOwner` | Pausa operacoes |
| `unpause()` | `external` | `onlyOwner` | Despausa |

### Eventos

| Evento | Parametros | Quando emitido |
|---|---|---|
| `Listed(uint256 tokenId, address seller, uint96 price)` | indexed x2 | `list` |
| `Cancelled(uint256 tokenId, address seller)` | indexed x2 | `cancel` |
| `Sold(uint256 tokenId, address seller, address buyer, uint256 price, uint256 platformFee, uint256 royalty)` | indexed x3 | `obtain` |
| `SwapProposed(uint256 swapId, address proposer, uint256 offeredId, uint256 wantedId, uint96 bnbLeg)` | indexed x2 | `proposeSwap` |
| `SwapCancelled(uint256 swapId, address proposer)` | indexed x2 | `cancelSwap` |
| `SwapAccepted(uint256 swapId, address proposer, address acceptor, uint256 offeredId, uint256 wantedId)` | indexed x3 | `acceptSwap` |
| `FeeUpdated(address feeSink, uint256 platformFeeBps)` | indexed feeSink | `setPlatformFee` |

### Erros customizados

| Erro | Parametros | Causa |
|---|---|---|
| `ZeroPrice()` | — | `price == 0` em `list` |
| `AlreadyListed(uint256 tokenId)` | tokenId | Listing ativo ja existe |
| `NotListed(uint256 tokenId)` | tokenId | Nenhum listing ativo |
| `NotSeller(uint256 tokenId)` | tokenId | `cancel` por nao-vendedor |
| `InsufficientPayment(uint256 sent, uint256 required)` | sent, required | `msg.value < price` em `obtain` |
| `SwapNotFound(uint256 swapId)` | swapId | Proposta inexistente |
| `NotWantedOwner(uint256 swapId)` | swapId | Acceptor nao e dono do wantedId |
| `ProposerLostToken(uint256 swapId, uint256 tokenId)` | swapId, tokenId | Proposer nao tem mais o offeredId |
| `NotApproved(uint256 tokenId)` | tokenId | Marketplace sem aprovacao para o token |
| `RefundFailed()` | — | Falha em devolver excesso de BNB ao comprador |
| `FeesExceedPrice(uint256 platformFee, uint256 royaltyAmt, uint256 price)` | todos | Taxa + royalty > preco do listing |
| `NotProposer(uint256 swapId)` | swapId | `cancelSwap` por nao-proposer |
| (compartilhados) | | `ZeroAddress`, `TransferFailed`, `NotTokenOwner`, `InvalidBasisPoints` |

---

## Interfaces

### IBitChickenNFT (`contracts/interfaces/i-bitchicken-nft.sol`)

Consumida por Forge, Staking e Marketplace. Expoe: `attributesOf`, `editionOf`, `tokenData`, `tierPrice`, `tierHasAvailable`, `pickEdition`, `forgeMint`, `transferFrom`, `safeTransferFrom`, `royaltyInfo`, `ownerOf`, `isApprovedForAll`, `getApproved`.

### IBitChickenToken (`contracts/interfaces/i-bitchicken-token.sol`)

Consumida pelo NFT (`burnFrom` no rename) e pelo Staking (`mint` de yield). Expoe: `mint`, `burnFrom`, `emissionCap`, `totalMinted`.

---

## Mocks (apenas testes)

### VRFCoordinatorMock (`contracts/mocks/vrf-coordinator-mock.sol`)

Wrapper de `VRFCoordinatorV2_5Mock` da Chainlink. Usado no localnet para simular o VRF coordinator. Nao deve ser deployado em testnet/mainnet.

### RejectEtherReceiver (`contracts/mocks/reject-ether-receiver.sol`)

Contrato sem `receive`/`fallback`; usado em testes para verificar que falhas em transferencias de BNB para o marketplace surfacam os erros customizados corretos. Nao deve ser deployado em producao.
