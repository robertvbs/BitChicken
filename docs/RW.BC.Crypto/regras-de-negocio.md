# Regras de Negocio — RW.BC.Crypto

| # | Regra | Localizacao (arquivo:linha aprox.) | Impacto se violada |
|---|---|---|---|
| 1 | `mint` de BCKN exige `totalMinted + amount <= emissionCap` | `bitchicken-token.sol:141` | Revert `EmissionCapExceeded(requested, available)` — emissao bloqueada |
| 2 | `setEmissionCap` nao pode reduzir abaixo de `totalMinted` | `bitchicken-token.sol:161` | Revert `CapBelowTotalMinted(proposed, minted)` — cap nao pode retroagir |
| 3 | Apenas `MINTER_ROLE` pode chamar `mint` no token | `bitchicken-token.sol:139` | Revert `AccessControlUnauthorizedAccount` (OZ) |
| 4 | Tier prices devem ser estritamente crescentes e todos > 0 | `mint-tier-management.sol:85-88` | Revert `InvalidTierPrices(index, value)` — schedule invalido rejeitado |
| 5 | `tierPrice` com index >= 10 → erro imediato | `mint-tier-management.sol:111` | Revert `TierOutOfRange(index)` |
| 6 | Stats de edicao (health/skill/morale) devem ser > 0 na criacao | `catalog-management.sol:227` | Revert `InvalidEditionStats` — edicao sem stats e inutilizavel |
| 7 | Nome de edicao: 1 a 64 bytes | `catalog-management.sol:229` | Revert `InvalidEditionName` |
| 8 | `mintEnd <= mintStart` (ambos != 0) → janela invalida | `catalog-management.sol:230` | Revert `InvalidEditionWindow` — edicao nunca poderia ser mintada |
| 9 | Edicao com `maxSupply != 0 && minted >= maxSupply` esta esgotada | `catalog-management.sol:269` | Revert `EditionSoldOut` — mint bloqueado |
| 10 | `pickEdition` exige ao menos uma edicao Gacha elegivel no tier | `catalog-management.sol:423` | Revert `NoAvailableEdition(tier)` |
| 11 | Apenas o Forge autorizado pode chamar `forgeMint` | `bitchicken-nft.sol:201` | Revert `CallerNotForge` — mint protegido |
| 12 | Nome de token: somente ASCII alfanumerico + espaco, 1-24 chars | `bitchicken-nft.sol:316-331` | Revert `InvalidName` — impede injecao de caracteres invalidos |
| 13 | `rename` so pode ser chamado pelo dono do token | `bitchicken-nft.sol:230` | Revert `NotTokenOwner(tokenId)` |
| 14 | `msg.value` em `requestObtain` deve ser exatamente `tierPrice(tier)` | `bitchicken-forge.sol:281` | Revert `IncorrectPayment(sent, required)` |
| 15 | Forge verifica disponibilidade antes de gastar gas VRF | `bitchicken-forge.sol:282` | Revert `NothingAvailable(tier)` — evita consumo de gas VRF sem edicao disponivel |
| 16 | `cancelStaleRequest` exige 256 blocos apos o pedido | `bitchicken-forge.sol:378` | Revert `RequestNotStale` — cancelamento prematuro bloqueado |
| 17 | `withdraw` do Forge nao pode drenar fundos de reembolso/indicacao pendentes | `bitchicken-forge.sol:456-458` | Revert `TransferFailed` se o calculo `balance - (totalPendingRefunds + totalPendingReferralBnb)` resultar em underflow (Solidity 0.8) |
| 18 | Staking exige par Male (genderBit 0) + Female (genderBit 1) | `bitchicken-staking.sol:310` | Revert `GendersNotComplementary(maleId, femaleId)` |
| 19 | NFT ja em par ativo nao pode ser reestacado | `bitchicken-staking.sol:303-304` | Revert `AlreadyStaked(tokenId)` |
| 20 | `claim` exige ao menos 1 ciclo completo (168h) desde `lastClaimAt` | `bitchicken-staking.sol:399` | Revert `CycleNotElapsed(pairId, nextUnlock)` |
| 21 | `claimBurnBps <= 10000` | `bitchicken-staking.sol:668` | Revert `InvalidBasisPoints(bps)` — impede taxa de 100%+ |
| 22 | `idealPairMultiplierBps >= 10000` (multipliador nao pode penalizar) | `bitchicken-staking.sol:681` | Revert `MultiplierTooLow(bps)` |
| 23 | `baseRate <= MAX_BASE_RATE (1e27)` | `bitchicken-staking.sol:640` | Revert `BaseRateTooHigh(value)` — previne hiperinflacao acidental |
| 24 | NFT de contrato externo rejeitado em `onERC721Received` | `bitchicken-staking.sol:279` | Revert `UnauthorizedNFT` — NFTs alheios nao ficam presos |
| 25 | `list` no marketplace exige aprovacao previa (fail-fast) | `bitchicken-marketplace.sol:298-300` | Revert `NotApproved` — listagem morta impossivel de criar |
| 26 | Token com listing ativo nao pode ter novo listing | `bitchicken-marketplace.sol:301` | Revert `AlreadyListed(tokenId)` |
| 27 | `obtain` verifica posse e aprovacao do vendedor no momento da compra | `bitchicken-marketplace.sol:335-338` | Revert `NotTokenOwner` ou `NotApproved` — listagem invalida no momento da compra |
| 28 | `platformFee + royaltyAmt <= price` e invariante do `obtain` | `bitchicken-marketplace.sol:345` | Revert `FeesExceedPrice` — evita underflow em `sellerProceeds` |
| 29 | Tabela de niveis da indicacao: `thresholds[0]==0`, crescente, lengths iguais, cada `rate <= MAX_REFERRAL_BPS` (1000 = 10%) | `referral-tree-management.sol` (`_setReferralLevels`) | Revert `InvalidLevels` — garante taxa valida e teto de 10% (lucratividade) |
| 30 | `registerReferrer` por endereco ja registrado → erro | `referral-tree-management.sol` (`_assignReferrerCode`) | Revert `AlreadyRegistered` — cada endereco tem apenas um codigo |
| 31 | Upline definido no 1º ovo do indicado (first-referrer-wins, imutavel); recompensa paga so nesse vinculo | `referral-tree-management.sol` (`_processReferral`) | Demais ovos do indicado nao pagam; a taxa usa a `referredCount` antes de contar o novo indicado |
| 32 | Auto-referencia e codigo invalido sao ignorados silenciosamente | `referral-tree-management.sol` (`_processReferral`) | Nao gera vinculo nem recompensa |
| 33 | Recompensa de indicacao em BNB reservada no Forge (nao sai no `withdraw`) | `bitchicken-forge.sol` (`withdraw`, `claimReferralBnb`) | `withdraw` drena `balance - (totalPendingRefunds + totalPendingReferralBnb)`; referrer saca via pull |
| 34 | `platformFeeBps <= 10000` no marketplace | `bitchicken-marketplace.sol:270` | Revert `InvalidBasisPoints` |
| 35 | `ZeroAddress` proibido em todos os inicializadores e setters criticos | `errors.sol:12`, usada em varios contratos | Revert `ZeroAddress` — enderecos zero bloqueados em posicoes criticas |
