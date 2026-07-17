# Arquitetura — Ecossistema BitChicken

Síntese da arquitetura unificada do **BitChicken**: um ecossistema de **NFT** na
BNB Smart Chain (catálogo de espécies + gacha/VRF + granja de staking +
marketplace P2P), com a token **BCKN** como moeda utilitária, um **indexador
on-chain** que materializa eventos em read-models e um **backend de contas** que
serve esses read-models ao dApp.

> Pivô histórico: o projeto **não é mais** um modelo de ICO/venda de token.
> Qualquer menção a "ICO" é histórica.

## Índice de arquitetura

| Documento | Conteúdo |
|---|---|
| [visao-geral.md](visao-geral.md) | Diagrama `graph TB` por camada + componentes + princípios + dependências críticas |
| [catalogo-componentes.md](catalogo-componentes.md) | Tabela única de todos os componentes (tipo, stack, expõe, depende de, criticidade) |
| [mapa-comunicacao.md](mapa-comunicacao.md) | Matriz de integrações + protocolos + `sequenceDiagram` do fluxo de compra |
| [fluxos-de-dados.md](fluxos-de-dados.md) | `flowchart` de compra+indicação, deploy/upgrade, indexação e cotação |
| [matriz-nomenclatura.md](matriz-nomenclatura.md) | Matriz de nomenclatura ponto-a-ponto (evento do contrato → indexer → API → dApp), auditoria de drift de termos entre as 4 camadas |

## Domínios

| Domínio | Documento |
|---|---|
| Token BCKN | [dominios/token-bckn.md](dominios/token-bckn.md) |
| Catálogo e NFT | [dominios/catalogo-e-nft.md](dominios/catalogo-e-nft.md) |
| Forge / Gacha (VRF) | [dominios/forge-gacha.md](dominios/forge-gacha.md) |
| Staking / Granja | [dominios/staking-granja.md](dominios/staking-granja.md) |
| Marketplace | [dominios/marketplace.md](dominios/marketplace.md) |
| Indicação (Referral) | [dominios/indicacao.md](dominios/indicacao.md) |
| Contas e Autenticação | [dominios/contas-e-auth.md](dominios/contas-e-auth.md) |
| Read-model on-chain | [dominios/read-model-on-chain.md](dominios/read-model-on-chain.md) |

## Decisões de arquitetura

Os ADRs do ecossistema estão em [../adr/README.md](../adr/README.md).

## Estilo arquitetural

**Monorepo de 4 projetos** (contratos on-chain + indexador + backend + SPA Web3),
sem código compartilhado entre eles. A topologia atual de read-model é o **Model B**:
os contratos emitem eventos → o indexador Ponder materializa → o backend serve via
Gridify + SignalR → o dApp consome. O dApp **também escreve direto** nos contratos
(via carteira) e fala com a API (Firebase JWT).

```
Contratos (BSC)  ->  Indexer (Ponder)  ->  schema "indexer" (Postgres)  ->  App Backend (.NET)  ->  dApp (Angular)
       ^                                                                                                  |
       +--------------------------- escrita direta via carteira (ethers) --------------------------------+
```

## Resumo do stack

| Camada | Tecnologia | Notas |
|---|---|---|
| Frontend | Angular 22 (zoneless, signals) + PrimeNG 21 + Tailwind v4 | SPA estática (build publicável em qualquer hospedagem); 100% cobertura via Vitest |
| Carteira e Web3 | Reown AppKit / WalletConnect + ethers v6 | Leitura via `JsonRpcProvider`; escrita via signer |
| Backend | .NET 10 + ASP.NET Minimal API + Wolverine CQRS + EF Core | Clean Architecture; Gridify (paginação/filtro) + SignalR (realtime) |
| Indexador | Ponder 0.16.6 + viem (TypeScript/Node 24) | Event-driven; materializa schema `indexer` no Postgres |
| Banco | PostgreSQL 17 | Schema `public` (domínio) + schema `indexer` (read-models Ponder) |
| Identidade | Firebase Auth (email/senha) + SIWE | JWT validado na API via OIDC; carteira vinculada por assinatura ECDSA |
| Contratos | Solidity 0.8.35 + Hardhat 3 + OpenZeppelin Upgradeable 5 | Proxy transparente (Token/NFT/Staking/Marketplace); Forge imutável |
| Rede | BNB Smart Chain (56 mainnet / 97 testnet) + Anvil 1337 (local) | — |
| Serviços externos | Chainlink VRF v2.5, CoinGecko, Pinata (IPFS), BSCScan, GA4 | Gacha, cotação fiat, arte das edições, verificação, telemetria |
| Orquestração (dev) | .NET Aspire (`RW.BC.AppHost`) | Sobe Postgres + API + chain + deploy + indexer + dApp |
