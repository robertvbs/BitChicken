# RW.BC.Crypto

| Atributo | Valor |
|---|---|
| Tipo | smart-contract |
| Linguagem | Solidity 0.8.35 |
| Build | Hardhat 3 + OpenZeppelin Upgradeable 5 |
| Rede | BNB Smart Chain (mainnet chainId 56 / testnet chainId 97) |
| EVM target | cancun (contratos principais), paris (mock Chainlink) |

Ecossistema de NFT da **BitChicken**: token utilitário **BCKN** (ERC-20), NFTs de galinhas (**BitChickenNFT**, ERC-721), Forge gacha via Chainlink VRF v2.5, granja de staking por casais e marketplace peer-to-peer não-custodial, todos deployados via proxy transparente (OZ Upgradeable).

## Entry points

| Arquivo | Propósito |
|---|---|
| `contracts/bitchicken-token.sol` | Token ERC-20 BCKN (emissão com cap, MINTER_ROLE, pausable, burnable) |
| `contracts/bitchicken-nft.sol` | NFT ERC-721 BitChicken (compõe 3 módulos abstratos: tiers, catálogo, referral) |
| `contracts/catalog-management.sol` | Módulo abstrato: registro de edições + seleção gacha ponderada |
| `contracts/mint-tier-management.sol` | Módulo abstrato: 10 tiers de preço em BNB estritamente crescentes |
| `contracts/referral-tree-management.sol` | Módulo abstrato: estado da indicação de 1 nível (códigos, upline, contagem, tabela de níveis); recompensa em BNB no Forge |
| `contracts/bitchicken-forge.sol` | Gacha não-upgradeável via Chainlink VRF v2.5 |
| `contracts/bitchicken-staking.sol` | Granja: staking de casais (macho+fêmea) com yield em BCKN |
| `contracts/bitchicken-marketplace.sol` | Marketplace P2P: listagem + compra + swap atômico |
| `contracts/errors.sol` | Erros customizados compartilhados (ZeroAddress, TransferFailed, etc.) |
| `contracts/interfaces/` | IBitChickenNFT, IBitChickenToken |
| `contracts/mocks/` | VRFCoordinatorMock, RejectEtherReceiver (apenas testes) |
| `scripts/deploy.ts` | Deploy completo do ecossistema (token→nft→staking→marketplace→forge) |
| `scripts/upgrade.ts` | Upgrade de proxies via OZ Upgrades API |
| `scripts/verify.ts` | Verificação de contratos na BSCScan |
| `scripts/forge-watch.ts` | Auto-fulfill do VRF mock no localnet (dev) |
| `scripts/stress-localnet.ts` | Harness de stress on-chain multi-wallet |

## Diretórios principais

| Diretório | Conteúdo |
|---|---|
| `contracts/` | Contratos Solidity de produção + erros centralizados |
| `contracts/interfaces/` | Interfaces consumidas por forge, staking e marketplace |
| `contracts/mocks/` | Contratos de teste (VRF mock, receptor que rejeita BNB) |
| `scripts/` | Deploy, upgrade, verify, seed, stress e helpers de dev |
| `test/` | Suites mocha (catalog, forge, integration, marketplace, nft, referral-tree, staking, token, upgrade) |
| `.openzeppelin/` | Manifests de upgrade do OZ (devem ser commitados) |

## Documentacao Disponivel

- [stack.md](stack.md) — tecnologias, versoes e arquitetura
- [funcionalidades.md](funcionalidades.md) — funcionalidades por contrato
- [regras-de-negocio.md](regras-de-negocio.md) — regras e invariantes do ecossistema
- [armadilhas.md](armadilhas.md) — armadilhas e como evita-las
- [integracoes.md](integracoes.md) — integracoes externas (VRF, BSC, BSCScan)
- [contratos.md](contratos.md) — referencia completa de funcoes, eventos e erros por contrato
- [upgrade-procedure.md](upgrade-procedure.md) — como atualizar os proxies com seguranca (validacao + E2E)
- [controle-acesso.md](controle-acesso.md) — mapa completo de roles, owners e funcoes gated por contrato
- [vrf-procedure.md](vrf-procedure.md) — fluxo de duas fases do gacha (Chainlink VRF v2.5), localnet mock e provisionamento em testnet/mainnet
- [seguranca.md](seguranca.md) — configuracao do Slither, supressoes justificadas e postura de seguranca
