# Funcionalidades — RW.BC.Crypto

## 1. Token BCKN (ERC-20 upgradeavel)

- **Entrada:** chamadas a `mint`, `burn`, `burnFrom`, `pause`, `unpause`, `setEmissionCap`
- **Arquivos:** `contracts/bitchicken-token.sol`, `contracts/interfaces/i-bitchicken-token.sol`
- **Comportamento:**
  - Emissao controlada por `emissionCap`: `mint` reverte `EmissionCapExceeded` se `totalMinted + amount > emissionCap`.
  - `totalMinted` e monotonicamente crescente — queimas nao o decrementam.
  - `MINTER_ROLE` concedido **apenas ao Staking** (yield); revogado do deployer apos bootstrap. O NFT nao precisa do papel (indicacao paga em BNB; rename so usa `burnFrom`).
  - `PAUSER_ROLE` pausa/despausa transferencias como kill-switch de emergencia.
  - Suporte a `burnFrom` (NFT chama para queimar BCKN no rename).
- **Regras:**
  - `setEmissionCap` reverte `CapBelowTotalMinted` se novo cap < `totalMinted`.
  - Cap inicial = 0; owner deve chamar `setEmissionCap` antes de qualquer mint.
  - Deploy: cap configurado para 1 000 000 000 BCKN (1 bilhao * 1e18).

## 2. Catalogo de Edicoes (NFT)

- **Entrada:** `registerEdition`, `setEditionActive`, `setEditionWindow` (so owner do NFT)
- **Arquivos:** `contracts/catalog-management.sol`, `contracts/bitchicken-nft.sol`
- **Comportamento:**
  - Cada edicao tem: nome (1-64 bytes), artURI (IPFS), stats fixos (health/skill/morale > 0), rarity, maxSupply (0=ilimitado), janela de mint (mintStart/mintEnd), distribution (Gacha|DirectSale), pesos por tier (array de 10 uint16).
  - Stats e maxSupply sao imutaveis apos registro.
  - `active` e janela de tempo podem ser alterados pos-registro.
  - IDs de edicao comecam em 1 (0 e sentinel "sem edicao").
  - `pickEdition(tier, randomWord)`: selecao ponderada cumulativa em memoria (O(n) leituras de storage); se a edicao sorteada estiver esgotada por corrida, avanca linearmente para a proxima elegivel.
  - `tierHasAvailable(tier)`: retorna `true` se ao menos uma edicao Gacha elegivel existe para o tier.
- **Regras:**
  - `maxSupply != 0 && minted >= maxSupply` → `EditionSoldOut`.
  - `mintEnd <= mintStart` (ambos != 0) → `InvalidEditionWindow`.
  - Health/skill/morale == 0 → `InvalidEditionStats`.
  - `totalWeight == 0` (nenhuma edicao elegivel) → `NoAvailableEdition`.

## 3. Tiers de Preco de Mint

- **Entrada:** `updateTierPrices` (so owner do NFT), `tierPrice(index)`, `getTierPrices()`
- **Arquivos:** `contracts/mint-tier-management.sol`, `contracts/bitchicken-nft.sol`
- **Comportamento:**
  - 10 tiers de preco em BNB wei (indices 0-9), estritamente crescentes.
  - Tier 0 = mais barato; tier 9 = mais caro.
  - `updateTierPrices` substitui o array inteiro atomicamente.
- **Regras:**
  - `prices[0] == 0` ou `prices[i] <= prices[i-1]` → `InvalidTierPrices(index, value)`.
  - `index >= 10` → `TierOutOfRange(index)`.
  - Deploy localnet: tiers de 0.01 a 0.10 BNB em incrementos de 0.01.

## 4. Gacha via VRF (Forge)

- **Entrada:** `requestObtain(tier, referrerCode, name)` payable
- **Arquivos:** `contracts/bitchicken-forge.sol`
- **Comportamento:**
  - Comprador envia exatamente `tierPrice(tier)` BNB; contrato cria um `ForgeRequest` e chama `s_vrfCoordinator.requestRandomWords`.
  - VRF callback (`fulfillRandomWords`) chama `nft.pickEdition(tier, word)` + `nft.forgeMint(buyer, editionId, gender, name, referrerCode)`.
  - Gender e derivado do bit menos significativo da palavra aleatoria: `uint8(word & 1)`.
  - Em caso de falha no `forgeMint` (ex.: edicao esgotou por corrida), o BNB e enfileirado em `pendingRefund[buyer]` e `totalPendingRefunds` e incrementado.
  - Comprador cancela request parado apos 256 blocos via `cancelStaleRequest`.
  - Comprador resgata BNB via `claimRefund` (pull-payment, CEI).
  - Owner retira receitas via `withdraw()` — drena apenas `balance - totalPendingRefunds`.
- **Regras:**
  - `msg.value != tierPrice(tier)` → `IncorrectPayment`.
  - `!nft.tierHasAvailable(tier)` → `NothingAvailable` (verificado antes de gastar gas VRF).
  - Cancellation: `block.number < req.blockNumber + 256` → `RequestNotStale`.
  - `STALE_BLOCKS = 256`, `MIN_CALLBACK_GAS = 50_000`, `MAX_CALLBACK_GAS = 2_500_000`.

## 5. Mint de NFT (forgeMint)

- **Entrada:** `forgeMint(to, editionId, gender, name, referrerCode)` — so o Forge autorizado
- **Arquivos:** `contracts/bitchicken-nft.sol`
- **Comportamento:**
  - Incrementa `edition.minted`, atribui dados per-token (editionId, gender, nome sanitizado), processa o vinculo de indicacao (retorna referrer/rateBps), chama `_safeMint`.
  - `tokenURI` e puro-view: constroi JSON on-chain com stats da edicao + dados do token; retorna `data:application/json;base64,...`. Sem SSTORE de URI por token.
  - `rename(tokenId, newName)`: so o dono; queima `renamePrice` BCKN via `burnFrom`; nome sanitizado on-chain (alphanumerico ASCII + espaco, 1-24 chars).
- **Regras:**
  - `msg.sender != $.forge` → `CallerNotForge`.
  - Contrato em pausa → revert (via `whenNotPaused`).
  - Nome invalido (caracter fora de [A-Za-z0-9 ], tamanho 0 ou > 24) → `InvalidName`.
  - `rename`: `ownerOf(tokenId) != msg.sender` → `NotTokenOwner`.

## 6. Sistema de Indicacao (Referral)

- **Entrada:** `registerReferrer()`, `setReferralLevels` (owner) no NFT; `claimReferralBnb()` no Forge.
- **Arquivos:** `contracts/referral-tree-management.sol`, `contracts/bitchicken-nft.sol`, `contracts/bitchicken-forge.sol`
- **Comportamento:**
  - Indicacao **de 1 nivel** (direto): A indica B → A so ganha no B, nunca no C.
  - Qualquer endereco pode se registrar como referrer e receber um codigo unico >= 1000.
  - Upline e definido no **1º ovo** que usa o codigo (first-referrer-wins, imutavel); emite `ReferralLinked`.
  - Recompensa em **BNB** = fatia do preco do ovo (`paid * rateBps / 10000`), paga **uma vez** (no vinculo).
    `forgeMint` retorna `(tokenId, referrer, rateBps)`; o Forge acumula em `pendingReferralBnb[referrer]`.
  - **Taxa por nivel** do indicador, derivada da `referredCount` (indicados que abriram ≥1 ovo), avaliada
    **antes** de contar o novo indicado. Tabela padrao `[0,3,6,8,10]` → `[2%,4%,6%,8%,10%]`.
  - Saque via `claimReferralBnb()` (CEI); `withdraw()` reserva o pool de indicacao.
  - Auto-referencia e codigo invalido silenciosamente ignorados.
- **Regras:**
  - Tabela configuravel por `setReferralLevels`; teto `MAX_REFERRAL_BPS = 1000` (10%); `thresholds[0]==0`,
    crescente, lengths iguais → senao `InvalidLevels`.
  - `pendingReferralBnb == 0` em `claimReferralBnb` → `NothingToClaim`.
  - `registerReferrer` por endereco ja registrado → `AlreadyRegistered`.
  - O NFT **nao** precisa de `MINTER_ROLE` (a recompensa e BNB, nao mint de BCKN).

## 7. Staking de Casais (Granja)

- **Entrada:** `stakePair(maleId, femaleId)`, `claim(pairId)`, `claimRange(start, count)`, `unstakePair(pairId)`
- **Arquivos:** `contracts/bitchicken-staking.sol`
- **Comportamento:**
  - Casal = 1 NFT Male (genderBit 0) + 1 NFT Female (genderBit 1) transferidos para custodia do contrato.
  - Yield por ciclo: `score = Σ(wHealth*H + wSkill*S + wMorale*M)` sobre os dois NFTs; `rewardPerCycle = baseRate * score / SCALE`.
  - Casal "ideal" (mesma edicao): multiplicador `idealPairMultiplierBps` aplicado (padrao 20000 = 2x).
  - `lastClaimAt` avanca por multiplos exatos de `CYCLE = 168h` (sem drift).
  - Imposto de claim: `taxed = gross * claimBurnBps / 10000`; porcao taxada **nao e mintada** (nao e queimada — apenas nao entra em circulacao). `net = gross - taxed` e mintado ao staker.
  - `unstakePair`: auto-claim de ciclos inteiros pendentes antes de devolver NFTs.
  - `claimRange`: pula pares com 0 ciclos (sem revert), processa os demais.
- **Regras:**
  - `genderBit` do male != 0 ou do female != 1 → `GendersNotComplementary`.
  - NFT ja em par ativo → `AlreadyStaked`.
  - `claim` com 0 ciclos → `CycleNotElapsed(pairId, nextUnlock)`.
  - `claimRange` com `start >= total` → `RangeOutOfBounds`.
  - `baseRate > MAX_BASE_RATE (1e27)` → `BaseRateTooHigh`.
  - `weight > MAX_WEIGHT (1e36)` → `WeightTooHigh`.
  - `claimBurnBps > 10000` → `InvalidBasisPoints`.
  - NFT de contrato externo em `onERC721Received` → `UnauthorizedNFT`.
  - Deploy: `baseRate = 1e17`, weights = 1e18 cada, `claimBurnBps = 500` (5%), `idealPairMultiplierBps = 20000`.

## 8. Marketplace P2P

- **Entrada:** `list(tokenId, price)`, `cancel(tokenId)`, `obtain(tokenId)` payable, `proposeSwap(offeredId, wantedId)` payable, `cancelSwap(swapId)`, `acceptSwap(swapId)`
- **Arquivos:** `contracts/bitchicken-marketplace.sol`
- **Comportamento:**
  - **Nao-custodial**: NFT fica na carteira do vendedor ate `obtain` ser chamado.
  - `list` exige aprovacao previa (falha-rapida: garante que o listing nao seja "morto").
  - `obtain`: split de receitas — `platformFee → feeSink`, royalty EIP-2981 → receiver, restante → vendedor; excesso de BNB devolvido ao comprador.
  - **Swap**: proposer oferece `offeredId` + BNB opcional (`bnbLeg` travado no contrato) em troca de `wantedId`; aceitor chama `acceptSwap`; ambos NFTs trocam atomicamente; `bnbLeg` vai ao aceitor. Sem taxa de plataforma em swaps.
  - `cancelSwap` devolve `bnbLeg` ao proposer.
- **Regras:**
  - `price == 0` → `ZeroPrice`.
  - Listing ja existe para o token → `AlreadyListed`.
  - `msg.value < price` → `InsufficientPayment`.
  - `platformFee + royaltyAmt > price` → `FeesExceedPrice` (evita underflow aritmetico).
  - Vendedor nao eh mais dono no momento do `obtain` → `NotTokenOwner`.
  - Marketplace sem aprovacao no momento do `obtain` → `NotApproved`.
  - Deploy: `platformFeeBps = 250` (2.5%).

## 9. Deploy e Upgrade

- **Entrada:** `npm run deploy:<rede>` / `npm run upgrade:<rede>`
- **Arquivos:** `scripts/deploy.ts`, `scripts/upgrade.ts`
- **Comportamento:**
  - Deploy completo: Token → NFT → Staking → Marketplace → (VRFMock no localnet) → Forge.
  - Apos deploy: configura `setForge`, `grantRole(MINTER_ROLE)` **só para Staking**, `setEmissionCap`, `updateTierPrices`, registra 5 edicoes de exemplo, configura staking e a tabela de niveis da indicacao (`setReferralLevels`).
  - Upgrade: `upgradesApi.upgradeProxy` com validacao de compatibilidade de storage.
  - Manifests `.openzeppelin/{bsc,bsc-testnet}.json` devem ser commitados.
