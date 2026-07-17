---
name: contract-feature
description: Guia para adicionar ou alterar uma função/evento de um contrato BitChicken (NFT, forge, staking, marketplace, token) end-to-end, garantindo a sincronia da ABI entre o contrato e o dApp. Use ao mexer em RW.BC.Crypto/contracts/*.sol que afete a interface usada pelo frontend.
---

# Skill: contract-feature

Mudar a interface de um contrato toca os dois projetos. Siga **na ordem** (cobertura 100% em cada passo).
**Node 24** (`nvm use 24`).

## 1. Contrato — `RW.BC.Crypto/`
- Edite o `.sol` relevante (`bitchicken-nft.sol`, `catalog-management.sol`, `bitchicken-forge.sol`,
  `bitchicken-staking.sol`, `bitchicken-marketplace.sol`, `bitchicken-token.sol` ou os módulos abstratos).
  Mantenha o padrão: eventos, erros custom, getters/setters `onlyOwner`, e CEI/`nonReentrant` onde houver valor.
- **Testes junto:** estenda os testes mocha (`test/nft.test.ts`, `test/catalog.test.ts`,
  `test/integration.test.ts`, etc.) e os fuzz `foundry-test/invariants/*.t.sol` — sucesso, reverts,
  eventos, branches. Rode `npm test` (mocha) e `npm run test:invariants` (fuzz). `npm run compile`
  para checar.
- OpenZeppelin: valide contra o MCP `mcp__OpenZeppelinSolidityContracts__*` / docs.openzeppelin.com.

## 2. Sincronia de ABI — `RW.BC.DApp/`  ⚠️ a armadilha nº 1
- `src/app/core/web3/contract-abi.ts` — ajuste a assinatura/eventos no ABI certo (NFT/forge/staking/
  marketplace/token).
- `src/app/core/web3/web3.models.ts` — atualize as interfaces (ex.: `Edition`, `Listing`, `StakedPair`) se o retorno mudou.
- `src/app/core/web3/contract-read.service.ts`/`contract-write.service.ts`/`contract-admin.service.ts` —
  leitura via `JsonRpcProvider` (use `safeRead` p/ getters que podem não existir) ou escrita via signer
  (padrão `requestObtain`/`stakePair`/`listNft`…).
- Atualize o mock `src/testing/web3-fakes.ts` se adicionou um método.

## 3. UI + i18n
- Exponha no componente relevante (`store`, `farm`, `marketplace`, `collection`, `admin`…). Lembre:
  **template Angular não aceita `0n`** — use `computed` booleano. Textos via `TranslatePipe` + chaves nos
  dois `public/i18n/*.json`. Se a ação escreve on-chain, ela passa pelo `write-gate` (login + carteira vinculada).
- Estenda os `.spec.ts` para **100%** e rode `npm test` (não `vitest` cru).

## 4. Aplicar na testnet local
- Recompile e redeploy: `dotnet run --project RW.BC.AppHost` (recria a chain e redeploya) ou, no fluxo
  só-chain, `npm run deploy:localhost`. Se mudou os endereços, atualize seu `environment.local.ts`
  (gitignored — copie de `environment.local.example.ts` se ainda não tiver um). Veja a skill
  **testnet-local**.
