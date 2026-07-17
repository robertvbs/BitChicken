# Documentação — BitChicken

Inventário técnico **regenerável** do monorepo BitChicken (ecossistema de NFT na BNB Smart Chain: catálogo de espécies + gacha/VRF + staking/granja + marketplace, com a token **BCKN** como moeda utilitária). Gerado pelo pipeline `/docs-refresh`. **O código é a fonte da verdade** — se a doc divergir, ela está velha.

## Projetos

- **[RW.BC.Crypto](RW.BC.Crypto/index.md)** — Contratos Solidity 0.8.35 (Hardhat 3): BCKN (ERC-20 cap), BitChickenNFT (ERC-721 + catálogo + indicação), Forge (gacha via Chainlink VRF), Staking e Marketplace.
- **[RW.BC.Indexer](RW.BC.Indexer/index.md)** — Indexador on-chain (Ponder/viem, TypeScript) que materializa os eventos dos contratos num schema Postgres `indexer` (read-model Model B).
- **[RW.BC.Api](RW.BC.Api/index.md)** — API de contas em .NET 10 + Aspire + EF Core/PostgreSQL + Firebase + Wolverine CQRS (Clean Architecture); serve o read-model via Gridify + SignalR e faz o vínculo de carteira via SIWE.
- **[RW.BC.DApp](RW.BC.DApp/index.md)** — dApp Angular 22 (PrimeNG 21, Tailwind v4, ethers v6, Reown AppKit) que lê/escreve nos contratos e consome a API (Firebase JWT).

Cada projeto traz: `index`, `stack`, `funcionalidades`, `regras-de-negocio`, `armadilhas`, `integracoes` (+ `contratos` no Crypto).

## Ecossistema (meta)

- **[Arquitetura](meta/arquitetura/README.md)** — visão geral, catálogo de componentes, mapa de comunicação, fluxos de dados e os 8 domínios (Token BCKN, Catálogo e NFT, Forge/Gacha, Staking/Granja, Marketplace, Indicação, Contas e Auth, Read-model on-chain).
- **[ADRs](meta/adr/README.md)** — 9 decisões de arquitetura registradas (pivô ICO→NFT, gacha via VRF, conta desacoplada da carteira via SIWE, backend .NET/Aspire, read-model on-chain via Ponder, ABI à mão, indicação on-chain, etc.).

## Topologia

Contratos (BNB Smart Chain) → **Indexer** (Ponder) → schema `indexer` no Postgres → **API** (.NET, Gridify + SignalR) → **dApp** (Angular). O dApp também escreve direto nos contratos (carteira) e fala com a API (Firebase JWT). Ligação contrato↔dApp/indexer é por **ABI mantida à mão** (armadilha nº 1).
