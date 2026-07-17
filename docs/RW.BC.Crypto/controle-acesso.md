# Controle de Acesso — RW.BC.Crypto

Mapa completo de controle de acesso dos cinco contratos do ecossistema BitChicken.
Fonte de verdade: os próprios contratos em `RW.BC.Crypto/contracts/`.

## BitChickenToken (`bitchicken-token.sol`)

Usa **AccessControlUpgradeable** do OpenZeppelin — sem hierarquia de `Ownable`, apenas roles.

### Roles definidas

| Constante | Valor (`keccak256`) | Quem recebe no deploy |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `0x00` (padrão OZ) | `admin` passado no `initialize` (deployer → transferido para `ADMIN_WALLET` no script) |
| `MINTER_ROLE` | `keccak256("MINTER_ROLE")` | No deploy inicial: deployer (revogado logo após); depois: **BitChickenStaking** (yield) |
| `PAUSER_ROLE` | `keccak256("PAUSER_ROLE")` | `pauser` passado no `initialize` (mesmo que `admin` no script de deploy) |

**Atenção:** o `BitChickenNFT` usa `burnFrom` (não `mint`) para queimar BCKN no rename — ele não
precisa de `MINTER_ROLE`. O Forge acumula recompensas de referral em BNB (não em BCKN), então
também não recebe `MINTER_ROLE`. Apenas o **Staking** recebe `MINTER_ROLE` para emitir yield.

### Funções gated por role

| Função | Role exigida | Efeito |
|---|---|---|
| `mint(address, uint256)` | `MINTER_ROLE` | Emite tokens até o `emissionCap`; reverte `EmissionCapExceeded` se exceder |
| `setEmissionCap(uint256)` | `DEFAULT_ADMIN_ROLE` | Atualiza o cap global (nunca abaixo do `totalMinted`) |
| `pause()` | `PAUSER_ROLE` | Para todas as transferências |
| `unpause()` | `PAUSER_ROLE` | Retoma transferências |
| `grantRole` / `revokeRole` | `DEFAULT_ADMIN_ROLE` (do role alvo) | Gerência de roles (padrão OZ AccessControl) |

---

## BitChickenNFT (`bitchicken-nft.sol`)

Usa **Ownable2StepUpgradeable**: transferência de ownership requer dois passos (`transferOwnership`
pelo owner atual + `acceptOwnership` pelo pendente), eliminando risco de perda por erro de endereço.

### Fluxo de ownership no deploy

No script `deploy.ts`, o deployer inicia `nft.transferOwnership(ADMIN_WALLET)`. O `ADMIN_WALLET`
deve chamar `acceptOwnership()` para finalizar. Até isso ocorrer, o deployer ainda é o owner.

### Gating especial: `forgeMint`

`forgeMint` não usa `onlyOwner` — usa verificação explícita de endereço:

```
if (msg.sender != $.forge) revert CallerNotForge();
```

O endereço autorizado é configurado via `setForge(forge_)` (que exige `onlyOwner`). Somente o
contrato `BitChickenForge` deployado pode chamar `forgeMint`.

### Funções `onlyOwner`

| Função | Efeito |
|---|---|
| `setForge(address)` | Define o endereço do Forge autorizado a chamar `forgeMint` |
| `setRenamePrice(uint256)` | Preço em BCKN para renomear um token (0 = grátis) |
| `setRoyalty(address, uint96)` | Configura royalty EIP-2981 padrão (destinatário + bps) |
| `registerEdition(...)` | Registra uma nova edição no catálogo (stats + supply + janela + pesos) |
| `setEditionActive(uint256, bool)` | Ativa ou desativa uma edição para o gacha |
| `setEditionWindow(uint256, uint64, uint64)` | Atualiza janela temporal de mint de uma edição |
| `updateTierPrices(uint256[10])` | Substitui a tabela de 10 preços de tier (BNB wei, estritamente crescentes) |
| `setReferralLevels(uint256[], uint16[])` | Substitui a tabela de níveis do programa de indicação |
| `pause()` / `unpause()` | Para / retoma mints e transferências |
| `withdraw()` | Drena o saldo BNB do contrato NFT para o owner (válvula de segurança) |

### Funções sem restrição de acesso (qualquer endereço)

| Função | Notas |
|---|---|
| `registerReferrer()` | Qualquer endereço pode se registrar como referenciador (código único, permanente) |
| `rename(uint256, string)` | Somente o **dono do token** pode renomear (verificação: `ownerOf(tokenId) != msg.sender`) |

---

## BitChickenForge (`bitchicken-forge.sol`)

Contrato **não-upgradeável**. Herda de `VRFConsumerBaseV2Plus`, que por sua vez herda de
`ConfirmedOwner`. O mecanismo de ownership é o `ConfirmedOwner` do Chainlink (padrão similar ao
`Ownable` do OZ, mas específico da Chainlink).

### Ownership pós-deploy

No construtor, o `owner_` é passado explicitamente. Se `owner_ != msg.sender`, é chamado
`transferOwnership(owner_)`. No script de deploy, `owner_` = `ADMIN_WALLET`.

### Funções `onlyOwner`

| Função | Efeito |
|---|---|
| `setVRFConfig(bytes32, uint256, uint32, uint16)` | Atualiza `keyHash`, `subId`, `callbackGasLimit`, `requestConfirmations` |
| `withdraw()` | Drena o saldo BNB do Forge para o owner, preservando escrow de refunds e referrals |

### `fulfillRandomWords` — apenas VRF coordinator

`fulfillRandomWords` é `internal override` herdado de `VRFConsumerBaseV2Plus`. O contrato base
garante que apenas o `s_vrfCoordinator` (definido no construtor) pode acionar o callback. Qualquer
chamada externa direta é impossível — a função não é `external`.

### Funções sem restrição de acesso (qualquer endereço)

| Função | Notas |
|---|---|
| `requestObtain(uint8, uint256, string)` payable | Qualquer endereço pode solicitar um ovo |
| `cancelStaleRequest(uint256)` | Somente o **comprador original** pode cancelar (verificação: `req.buyer != msg.sender`) |
| `claimRefund()` | Qualquer endereço pode sacar seu próprio saldo de reembolso |
| `claimReferralBnb()` | Qualquer endereço pode sacar seu próprio saldo de referral |

---

## BitChickenStaking (`bitchicken-staking.sol`)

Usa **Ownable2StepUpgradeable** (mesma proteção de dois passos do NFT).

### Funções `onlyOwner`

| Função | Efeito |
|---|---|
| `setBaseRate(uint256)` | Taxa base de yield (deve ser `<= MAX_BASE_RATE`) |
| `setWeights(uint256, uint256, uint256)` | Pesos de health, skill e morale no cálculo de yield |
| `setClaimBurnBps(uint256)` | Taxa de retenção no claim (bps, 0-10000; o montante retido não é mintado) |
| `setIdealPairMultiplierBps(uint256)` | Multiplicador de yield para casais do mesmo edition (>= 10000) |
| `pause()` / `unpause()` | Para / retoma stake, claim e unstake |

### Funções sem restrição de acesso

| Função | Notas |
|---|---|
| `stakePair(uint256, uint256)` | Qualquer endereço pode fazer staking de par que ele mesmo possua |
| `claim(uint256)` / `claimRange(uint256, uint256)` | Somente o **dono do par** pode fazer claim (verificação: `p.owner != staker`) |
| `unstakePair(uint256)` | Somente o **dono do par** pode desfazer o staking |

---

## BitChickenMarketplace (`bitchicken-marketplace.sol`)

Usa **Ownable2StepUpgradeable**.

### Funções `onlyOwner`

| Função | Efeito |
|---|---|
| `setPlatformFee(address, uint256)` | Atualiza o destinatário (`feeSink`) e a taxa da plataforma (bps) |
| `pause()` / `unpause()` | Para / retoma listagens e compras |

### Funções sem restrição de acesso

| Função | Notas |
|---|---|
| `list(uint256, uint96)` | Somente o **dono do token** pode listar (verificação: `nft.ownerOf(tokenId) != msg.sender`) |
| `cancel(uint256)` | Somente o **seller original** pode cancelar (verificação: `l.seller != msg.sender`) |
| `obtain(uint256)` payable | Qualquer endereço pode comprar um NFT listado |
| `proposeSwap(uint256, uint256)` payable | Somente o **dono do token oferecido** pode propor |
| `cancelSwap(uint256)` | Somente o **proposer original** pode cancelar |
| `acceptSwap(uint256)` | Somente o **dono do token desejado** pode aceitar |

---

## Tabela-resumo

| Contrato | Função administrativa | Quem pode chamar |
|---|---|---|
| **BitChickenToken** | `mint` | `MINTER_ROLE` (Staking) |
| **BitChickenToken** | `setEmissionCap` | `DEFAULT_ADMIN_ROLE` (ADMIN_WALLET) |
| **BitChickenToken** | `pause` / `unpause` | `PAUSER_ROLE` (ADMIN_WALLET) |
| **BitChickenNFT** | `setForge` | owner (ADMIN_WALLET) |
| **BitChickenNFT** | `registerEdition` / `setEditionActive` / `setEditionWindow` | owner (ADMIN_WALLET) |
| **BitChickenNFT** | `updateTierPrices` / `setReferralLevels` / `setRenamePrice` / `setRoyalty` | owner (ADMIN_WALLET) |
| **BitChickenNFT** | `pause` / `unpause` / `withdraw` | owner (ADMIN_WALLET) |
| **BitChickenNFT** | `forgeMint` | somente endereço `$.forge` (BitChickenForge) |
| **BitChickenForge** | `setVRFConfig` / `withdraw` | owner (ADMIN_WALLET, via ConfirmedOwner) |
| **BitChickenForge** | `fulfillRandomWords` | somente VRF coordinator (`internal`, não acessível externamente) |
| **BitChickenStaking** | `setBaseRate` / `setWeights` / `setClaimBurnBps` / `setIdealPairMultiplierBps` | owner (ADMIN_WALLET) |
| **BitChickenStaking** | `pause` / `unpause` | owner (ADMIN_WALLET) |
| **BitChickenMarketplace** | `setPlatformFee` | owner (ADMIN_WALLET) |
| **BitChickenMarketplace** | `pause` / `unpause` | owner (ADMIN_WALLET) |

---

## Postura de confiança e roadmap de segurança

**Fase de desenvolvimento (atual):** o owner de todos os contratos é uma EOA (`ADMIN_WALLET`,
configurada via `.env` em `scripts/deploy.ts`). Esse modelo é adequado para a fase de dev mas **não é
recomendado para mainnet** por expor o ecossistema a um único ponto de falha.

**Futuro (mainnet):** o owner dos proxies e do Forge deve ser substituído por um **Gnosis Safe
(multisig)** com um **TimelockController** interposto. Isso exige que qualquer função administrativa
seja proposta no Safe, aprovada por N/M signatários, aguarde o delay do Timelock e então execute.
O procedimento de upgrade já documenta esse requisito em
[upgrade-procedure.md](upgrade-procedure.md) (seção "Pós-desenvolvimento").

A possibilidade de fazer esse upgrade sem quebrar estado é garantida pelo padrão de proxy transparente
e pelo storage namespaced ERC-7201 — a troca de owner/multisig não requer redeploy dos proxies.
