# Integracoes — RW.BC.Crypto

## Tabela resumo

| Servico | Direcao | Protocolo | Criticidade | Tratamento de falha |
|---|---|---|---|---|
| Chainlink VRF v2.5 | Saida (requestRandomWords) + Entrada (fulfillRandomWords callback) | on-chain (BSC) | Critica — sem VRF nao ha mint de NFT | Timeout: comprador cancela apos 256 blocos via `cancelStaleRequest`; falha no mint enfileira reembolso via `pendingRefund` |
| BNB Smart Chain RPC | Saida (deploy/upgrade/interact via Hardhat) | JSON-RPC HTTP | Critica para deploy | Configurar RPC confiavel em `.env` (BSC_RPC_URL / BSC_TESTNET_RPC_URL) |
| BSCScan | Saida (verify) | REST API (etherscan-compat) | Baixa (apenas verificacao de contrato) | Verificacao pode ser reexecutada manualmente via `npm run verify:mainnet` |
| BitChickenNFT → BitChickenToken | Interna on-chain (`burnFrom` de rename) | Chamada de contrato (IBitChickenToken) | Media — sem `MINTER_ROLE` (so `burnFrom`) | `burnFrom` falha se allowance/saldo insuficiente |
| BitChickenStaking → BitChickenToken | Interna on-chain (mint de yield) | Chamada de contrato (IBitChickenToken) | Alta — MINTER_ROLE necessario | `EmissionCapExceeded` impede mint; staker nao recebe yield ate cap ser aumentado |
| BitChickenForge → BitChickenNFT | Interna on-chain (pickEdition + forgeMint) | Chamada de contrato (IBitChickenNFT) | Critica — fluxo principal de mint | Revert em `forgeMint`: Forge enfileira reembolso BNB automaticamente |
| BitChickenMarketplace → BitChickenNFT | Interna on-chain (safeTransferFrom, royaltyInfo, ownerOf, getApproved) | Chamada de contrato (IBitChickenNFT) | Alta — compra/swap dependem do NFT | Revert em transferencia bloqueia `obtain`/`acceptSwap`; listing fica ativo |
| VRFCoordinatorMock (localnet) | Saida (testnet local) | on-chain (anvil) | Alta em dev — substitui VRF real | Sem `forge:watch`, callbacks nao chegam; ovo fica preso |
| forge-watch.ts | Entrada (escuta eventos) + Saida (chama fulfillRandomWords) | on-chain (ethers.js) | Alta em localnet | Script deve estar rodando continuamente; o AppHost garante isso |

## Detalhes por integracao

### Chainlink VRF v2.5

- **Interface:** `VRFConsumerBaseV2Plus` (herdada pelo Forge); `VRFV2PlusClient.RandomWordsRequest`.
- **Fluxo:**
  1. `requestObtain` chama `s_vrfCoordinator.requestRandomWords` com `numWords: 1`, `nativePayment: false` (pagamento em LINK).
  2. Coordinator emite `RandomWordsRequested`; apos `requestConfirmations` blocos, envia callback `fulfillRandomWords`.
  3. Forge usa `randomWords[0]` para gender (`& 1`) e para `pickEdition`.
- **Configuracao:**
  - `keyHash` — gas lane BSC (padrao deploy testnet: `0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc`).
  - `subId` — subscription ID criada via VRF UI da Chainlink; Forge deve ser adicionado como consumer.
  - `callbackGasLimit` — padrao 500 000; ajustar via `setVRFConfig` conforme tamanho do catalog.
  - `requestConfirmations` — padrao 3; aumentar para maior seguranca em mainnet.
- **Localnet:** `VRFCoordinatorMock` (`contracts/mocks/vrf-coordinator-mock.sol`); subscription criada no deploy via `vrfMock.createSubscription()` + `fundSubscription` + `addConsumer`.

### BNB Smart Chain

- **Redes configuradas em `hardhat.config.ts`:**
  - `localhost` — `http://127.0.0.1:8545` (anvil Docker, chain 1337).
  - `bscTestnet` — chainId 97; RPC de `BSC_TESTNET_RPC_URL` no `.env`.
  - `bscMainnet` — chainId 56; RPC de `BSC_RPC_URL` no `.env`.
- **Conta de deploy:** `MAIN_PRIVATE_KEY` no `.env` (nunca commitar).
- **Admin wallet:** `ADMIN_WALLET` no `.env` (scripts/deploy.ts:15) — vira o owner inicial dos contratos em producao; se ausente, o proprio deployer permanece como owner.

### BSCScan (verificacao)

- **Script:** `scripts/verify.ts` — chama `verifyContract` para cada contrato deployado.
- **API key:** `BSCSCAN_API_KEY` no `.env`.
- **Config:** secao `verify.etherscan` em `hardhat.config.ts`.
- **Proxies:** o OZ Upgrades nao verifica automaticamente implementacoes via BSCScan; verificacao manual pode ser necessaria para a logica de implementacao.

### Comunicacao inter-contratos (on-chain)

- **IBitChickenNFT** (`contracts/interfaces/i-bitchicken-nft.sol`): interface consumida por Forge, Staking e Marketplace. Expoe `attributesOf`, `tokenData`, `editionOf`, `tierPrice`, `tierHasAvailable`, `pickEdition`, `forgeMint`, `transferFrom`, `safeTransferFrom`, `royaltyInfo`, `ownerOf`, `isApprovedForAll`, `getApproved`.
- **IBitChickenToken** (`contracts/interfaces/i-bitchicken-token.sol`): interface consumida pelo NFT (`burnFrom` no `rename`) e pelo Staking (yield mint). Expoe `mint`, `burnFrom`, `emissionCap`, `totalMinted`.
- Apenas o **Staking** precisa de `MINTER_ROLE` (mint de yield), configurado no `deploy.ts`. O **NFT nao** precisa de `MINTER_ROLE` — a recompensa de indicacao e em BNB (paga pelo Forge) e o `rename` so usa `burnFrom`.

### Ambiente de desenvolvimento local (Aspire / Docker)

- **Docker Compose** (`node:up`/`node:down`/`node:reset`): sobe anvil na porta 8545 + Otterscan.
- **dotnet run --project RW.BC.AppHost**: orquestra tudo — chain + deploy/fund + forge:watch + API + DApp.
- **forge-watch.ts**: escuta `RandomWordsRequested` via `ethers.Contract.on` e chama `fulfillRandomWords` no mock. Deve estar rodando sempre que ovos forem abertos no localnet.
- **deployed-localhost.json** (`scripts/deployed-localhost.json`): enderecos deployados no localnet, lido pelo DApp via `environment.local.ts`.
