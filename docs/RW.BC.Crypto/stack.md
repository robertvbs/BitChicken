# Stack — RW.BC.Crypto

## Tecnologias

| Camada | Tecnologia | Versao | Notas |
|---|---|---|---|
| Linguagem | Solidity | 0.8.35 | Contratos de producao; evmVersion `cancun`, `viaIR: true`, optimizer 200 runs |
| Linguagem | Solidity | 0.8.19 | Apenas VRFCoordinatorMock; evmVersion `paris` |
| Framework | Hardhat | ^3.9.0 | HH3: sem `hre` global; `hre.network.create()` + factory upgrades |
| Token padrao | OpenZeppelin Contracts Upgradeable | ^5.6.1 | ERC-20, ERC-721, AccessControl, Ownable2Step, Pausable, ReentrancyGuardTransient |
| Token padrao | OpenZeppelin Contracts | ^5.6.1 | ReentrancyGuardTransient, Strings, Base64, EnumerableSet |
| Upgrades | @openzeppelin/hardhat-upgrades | ^4.0.2 | Proxy transparente; manifests em `.openzeppelin/` |
| Aleatoriedade | Chainlink VRF v2.5 | @chainlink/contracts ^1.5.0 | `VRFConsumerBaseV2Plus`, `VRFV2PlusClient`; pagamento em LINK (nativePayment: false) |
| Toolbox | @nomicfoundation/hardhat-toolbox-mocha-ethers | ^3.0.7 | ethers, mocha, chai, typechain |
| Testes | Mocha + Chai | ^11.7.6 / ^6.2.2 | Suites: token, nft, catalog, forge, staking, marketplace, referral, integration |
| Linguagem (scripts/testes) | TypeScript | ~6.0.2 | ESM (`"type": "module"`), configs em `.ts` |
| Lint | solhint + eslint | ^6.2.1 / ^10.4.1 | `npm run lint` |
| Formatacao | prettier-plugin-solidity | ^2.3.1 | `npm run format` |
| Verificacao | BSCScan via @nomicfoundation/hardhat-verify | incluido no toolbox | `verifyContract` de `@nomicfoundation/hardhat-verify/verify` |
| Rede alvo | BNB Smart Chain | chainId 56 (mainnet) / 97 (testnet) | RPC via `.env`; localnet anvil porta 8545 |
| Localnet | Foundry Anvil (Docker) | via `docker compose` | Chain ID 1337; Otterscan como explorer |
| Runtime | Node.js | >=22 (recomendado 24 via `.nvmrc`) | Hardhat 3 e toolbox exigem Node 22+ |

## Arquitetura

**Padrao:** proxy transparente (OpenZeppelin) para todos os contratos atualizaveis (Token, NFT, Staking, Marketplace). O Forge e nao-atualizavel (sem `Upgradeable`) pois e substituivel via `nft.setForge(...)`.

**Modularidade:** `BitChickenNFT` e composto por tres contratos abstratos herdados:
- `MintTierManagement` — 10 tiers de preco em BNB com ERC-7201 storage namespace proprio.
- `CatalogManagement` — registro de edicoes/especies com selecao gacha ponderada.
- `ReferralTreeManagement` — estado da indicacao de 1 nivel (codigos, upline, contagem, tabela de niveis); recompensa em BNB paga pelo Forge.

**Erros centralizados:** `contracts/errors.sol` declara os erros compartilhados (`ZeroAddress`, `TransferFailed`, `NotTokenOwner`, `InvalidBasisPoints`) importados por todos os contratos que os usam, eliminando drift de selector.

**Storage ERC-7201:** cada contrato (e modulo abstrato) usa namespace proprio para evitar colisao de slots em upgrades. Slots sao calculados via formula `keccak256(abi.encode(uint256(keccak256(namespace)) - 1)) & ~bytes32(uint256(0xff))`.

**Deploy alvo:** BSC mainnet/testnet. Dev local via `dotnet run --project RW.BC.AppHost` (Aspire) ou `npm run node:up && npm run deploy:localhost` direto.
