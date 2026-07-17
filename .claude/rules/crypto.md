---
paths:
  - "RW.BC.Crypto/**"
---

# Regras — RW.BC.Crypto (contratos)

Solidity 0.8.35 + **Hardhat 3**. Execute tudo a partir de `RW.BC.Crypto/` com **Node 24**
(`nvm use 24`). Há `.nvmrc` (24).

## Comandos

```bash
npm test                  # hardhat test (mocha test/*.test.ts)
npm run compile           # hardhat clean && compile
npm run lint              # solhint + eslint
npx hardhat test mocha test/catalog.test.ts        # um arquivo
npx hardhat test mocha --grep "should allow"       # por nome
npm run test:invariants   # testes Solidity (fuzz/invariantes) — foundry-test/invariants/*.t.sol
npm run coverage:forge    # cobertura forge desses invariantes

# Testnet local (Docker) e deploy — troque localhost por testnet|mainnet:
npm run node:up | node:down | node:reset           # anvil (chain 1337) + Otterscan via docker compose
npm run deploy:localhost  # scripts/deploy.ts (deploy + seed de tier prices, edições 1–5, staking)
npm run seed:localhost    # scripts/seed-local.ts        | seed-nfts:localhost p/ inventário extra
npm run fund:localhost    # scripts/fund-local.ts (BNB via anvil_setBalance; FUND_ADDRESS=0x..)
npm run forge:watch       # scripts/forge-watch.ts — auto-fulfill do VRF mock no localnet (ovos chocam)
npm run upgrade:localhost # scripts/upgrade.ts (upgrade dos proxies)
npm run stress:localhost  # harness de stress on-chain (scripts/stress-localnet.ts)
```

> **Ambiente completo num comando:** `dotnet run --project RW.BC.AppHost` (na raiz) sobe a chain +
> deploy/fund + forge:watch + o dApp (e a API+Postgres) via .NET Aspire. Veja `RW.BC.AppHost/README.md`.

## Convenções

- **Idioma:** código em **inglês (EUA)** (identificadores, strings, logs) — qualquer arquivo.
  **Comentários só em `.sol`** (NatSpec/explicações do contrato, em inglês EUA); nos demais
  (`.ts`/`.json`/configs) **sem comentários**. Documentação (`docs/`) é pt-BR.
- **ESM + TypeScript** (`"type": "module"`); config/scripts/testes em `.ts`. Solidity **0.8.35**,
  `evmVersion: "cancun"` fixado em `hardhat.config.ts`.
- **Modelo Hardhat 3** (sem `hre` global / `require('hardhat')`): `import hre from "hardhat"`,
  `const connection = await hre.network.create()` (passe o nome da rede p/ forçar uma específica),
  `const { ethers } = connection`. Upgrades é **factory**: `const api = await upgrades(hre, connection)`
  → `api.deployProxy/upgradeProxy`. Verificação via `verifyContract(...)` de
  `@nomicfoundation/hardhat-verify/verify`.
- **Cobertura:** o HH3 **não tem ferramenta de cobertura Solidity** (solidity-coverage é HH2). Cobrir
  **todo código novo por construção** — toda função, branch, erro custom, evento e caminho de revert,
  em mocha (`test/*.test.ts`) + fuzz/invariantes (`foundry-test/invariants/*.t.sol`, via
  `npm run test:invariants`). Mandato de 100%.

## Referências (consulte as fontes, não só a memória)

- **Solidity 0.8.35:** <https://docs.soliditylang.org/en/v0.8.35> (geral: <https://docs.soliditylang.org/en>).
- **OpenZeppelin:** MCP `mcp__OpenZeppelinSolidityContracts__*` (referência/geração de contratos) +
  <https://docs.openzeppelin.com/>. APIs do OZ upgradeable mudam entre versões — valide antes de usar.
- **Chainlink VRF v2.5** (usado pelo Forge): consulte a doc oficial da Chainlink para a interface do coordinator.

## Arquitetura dos contratos (ecossistema NFT BitChicken)

> Pivô: o projeto **não é mais ICO/venda de token** — é um **ecossistema NFT** (catálogo + gacha/VRF +
> staking + marketplace), com a token **BCKN** como moeda utilitária/recompensa.

- `contracts/bitchicken-token.sol` — **BCKN**: ERC-20 upgradeável (proxy), emissão com **cap**,
  `MINTER_ROLE`, pausable, burnable. Usado como recompensa de indicação, produção do staking e sink de rename.
- `contracts/bitchicken-nft.sol` — **BitChickenNFT**: ERC-721 **upgradeável (proxy transparente)**,
  `Ownable2Step`. Compõe três módulos abstratos: **MintTierManagement** (10 tiers de preço em BNB para
  ovos), **CatalogManagement** (registro de edições/espécies + seleção gacha ponderada) e
  **ReferralTreeManagement** (indicação de 1 nível; estado on-chain + tabela de níveis, recompensa em BNB
  paga pelo Forge no 1º ovo do indicado, pull-payment). `tokenURI` é montado on-chain
  (sem SSTORE de URI). `forgeMint` (só o Forge chama, pós-VRF). `rename` queima BCKN.
- `contracts/catalog-management.sol` — registro de `Edition` (stats fixos, rarity, maxSupply, janela,
  `distribution` (Gacha/DirectSale), `tierWeights[10]`) + `pickEdition(tier, randomWord)` (seleção
  ponderada cumulativa entre edições Gacha elegíveis). **Venda avulsa (`obtainEdition`) foi removida** —
  edições especiais hoje dropam de ovo com peso baixo.
- `contracts/bitchicken-forge.sol` — **gacha via Chainlink VRF v2.5**: `requestObtain(tier,...)` (paga
  `tierPrice`) → `fulfillRandomWords` → `pickEdition` + `forgeMint`. Eventos `ForgeRequested`/
  `ForgeFulfilled`/`RequestCancelled`. No localnet o VRF é um **mock** (`contracts/mocks/`) que só responde
  com `npm run forge:watch` rodando.
- `contracts/bitchicken-staking.sol` — **granja**: aloja **casais (macho+fêmea)** para gerar produção em
  BCKN por ciclo; bônus para casal "combinado".
- `contracts/bitchicken-marketplace.sol` — listar/comprar/propor swap de NFTs, com taxa configurável.
- `contracts/interfaces/` (`i-bitchicken-nft.sol`, `i-bitchicken-token.sol`) e `contracts/mocks/` (VRF).

## Armadilhas

- **Sync de ABI (armadilha nº 1):** mudar a interface de NFT/forge/staking/marketplace/token exige
  espelhar em `RW.BC.DApp/src/app/core/web3/contract-abi.ts` (+ `contract-read/write/admin.service.ts`/
  `web3.models.ts`) e atualizar os `environment.*.ts` ao redeployar — **não há geração automática**. O
  hook `abi-drift-warn.sh` lembra ao editar `.sol`.
- **Ovo travado em "Chocando…" no localnet:** o gacha usa VRF; o mock só responde se
  **`npm run forge:watch`** estiver rodando (`dotnet run --project RW.BC.AppHost` já sobe isso
  automaticamente).
- **`.env`** (gitignored): chaves de deploy, RPCs, `BSCSCAN_API_KEY`, endereços de proxy. Nunca commitar chaves.
- **`.openzeppelin/{bsc,bsc-testnet}.json`** (manifests de upgrade) devem ser commitados.
