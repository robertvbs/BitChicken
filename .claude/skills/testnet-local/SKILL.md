---
name: testnet-local
description: Sobe ou reseta a testnet interna em Docker (anvil chain 1337 + explorer Otterscan), implanta os contratos NFT do BitChicken (token + NFT + forge + staking + marketplace) e deixa o dApp lendo dela. Use ao testar com contratos frescos localmente, depois de mudar/recompilar contratos, ou quando pedirem "subir o ambiente local".
---

# Skill: testnet-local

Sobe a testnet interna. **Node 24** (`nvm use 24`). Duas formas:

## A) Tudo num comando (recomendado) — via Aspire

Na raiz do repo:
```bash
dotnet run --project RW.BC.AppHost -p:AllowMissingPrunePackageData=true
```
Sobe **Postgres + API + anvil (1337) + Otterscan + deploy/fund + forge:watch + o dApp** orquestrados.
dApp em `http://localhost:4200`, dashboard Aspire em `https://localhost:17190`. Chain efêmera (fresca a
cada run). Detalhes em `RW.BC.AppHost/README.md`. Precisa de Docker + `node_modules` instalado em
`RW.BC.Crypto`, `RW.BC.Indexer` e `RW.BC.DApp`.

## B) Só a chain + contratos (npm scripts) — sem a API

Em `RW.BC.Crypto/`:
1. `npm run node:up` — anvil em `http://localhost:8545` (chainId **1337**) + Otterscan em
   `http://localhost:5100`. Aguarde `eth_chainId` (`0x539`).
2. `npm run deploy:localhost` — implanta token **BCKN** + **NFT** + **forge** + **staking** +
   **marketplace** (endereços determinísticos) e semeia tier prices, edições 1–5 e staking.
3. `npm run fund:localhost` — 10000 BNB nas 10 contas dev (`FUND_ADDRESS=0x... npm run fund:localhost`
   p/ uma carteira específica). `seed-nfts:localhost` popula inventário extra.
4. `npm run forge:watch` — **deixe rodando em background**: auto-fulfill do VRF mock (senão os ovos
   ficam travados em "Chocando…").

Depois, em `RW.BC.DApp/`: `npm run start:local` → `http://localhost:4200` lendo do nó.

## Resetar (chain limpa)

`npm run node:reset` (apaga o volume) e refaça deploy → fund. Os endereços se repetem. (No modo A a
chain já é recriada a cada run.)

## Notas
- **MetaMask:** RPC `http://localhost:8545`, Chain ID **1337**, símbolo BNB; ligue "Mostrar redes de
  teste". No WSL, se `localhost` não conectar do Windows, use o IP do WSL (`ip -4 addr show eth0 | grep inet`).
- **Explorer local:** `http://localhost:5100` (Otterscan).
- O dApp usa a config `local` (`environment.local.ts`, `appKit.local: true`) — gitignored; copie de
  `environment.local.example.ts` se ainda não tiver um.
