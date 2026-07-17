# Catálogo de Componentes — Ecossistema BitChicken

Tabela única de todos os componentes do ecossistema, com criticidade relativa ao
caminho crítico de compra (Frontend → Forge/VRF → NFT) e de leitura
(Contratos → Indexer → Postgres → API → dApp).

| Componente | Tipo | Linguagem | Stack | Expõe | Depende de | Criticidade |
|---|---|---|---|---|---|---|
| dApp Angular | Frontend SPA | TypeScript 6 | Angular 22, PrimeNG 21, Tailwind v4, ethers v6, Reown AppKit | UI web (loja, granja, mercado, coleção, admin) | Carteira, BSC RPC, API, Firebase, CoinGecko | Crítica |
| Web3Service | Serviço frontend | TypeScript | Reown AppKit / WalletConnect | signals de carteira, `getSigner()` | Reown AppKit, EIP-1193 | Crítica |
| ContractReadService | Serviço frontend | TypeScript | ethers v6 (`JsonRpcProvider`) | leituras on-chain dinâmicas + cache 30s | BSC RPC | Alta |
| ContractWriteService | Serviço frontend | TypeScript | ethers v6 (signer) | `requestObtain`, stake, listar, comprar | Carteira, contratos | Crítica |
| ContractAdminService | Serviço frontend | TypeScript | ethers v6 (signer) | operações `onlyOwner` (rota `/admin`) | Carteira admin | Média |
| MarketDataService | Serviço frontend | TypeScript | RxJS/HttpClient | leituras paginadas (listings, NFTs, staking, referral, transparência) | API REST | Alta |
| AuthService | Serviço frontend | TypeScript | Firebase Web SDK v12 | login/cadastro email+senha, idToken | Firebase Auth | Alta |
| WalletLinkService | Serviço frontend | TypeScript | ethers signer + API | fluxo SIWE (nonce → assina → verify) | API, carteira | Alta |
| SignalrService | Serviço frontend | TypeScript | `@microsoft/signalr` | `marketChanged`, `forgeFulfilled` | API SignalR hub | Média |
| CoinGeckoService | Serviço frontend | TypeScript | HTTP REST | cotação BNB→fiat (USD/BRL) | CoinGecko API | Baixa |
| App Backend (API) | Backend REST + SignalR | C# 14 / .NET 10 | ASP.NET Minimal API, Wolverine, EF Core, Gridify | `/accounts/*`, `/editions`, `/marketplace/listings`, `/transparency/*`, hub `/hubs/events` | Postgres, Firebase OIDC | Crítica |
| EventsHub | Componente SignalR | C# | SignalR | grupos por endereço EVM | Postgres LISTEN/NOTIFY | Média |
| MarketplaceEventsListener | BackgroundService | C# | Npgsql LISTEN/NOTIFY | detecta mudanças e publica eventos | schema `indexer` | Média |
| Account aggregate | Domínio | C# | Clean Architecture | invariantes de conta + wallet-link | — | Alta |
| NethereumSignatureVerifier | Infra (SIWE) | C# | Nethereum.Signer | EcRecover do endereço a partir da assinatura | — (100% local) | Alta |
| Indexer Ponder | Indexador on-chain | TypeScript 5 | Ponder 0.16.6, viem | materializa 12 tabelas no schema `indexer` | BSC RPC, Postgres, ABIs | Alta |
| Postgres `public` | Banco relacional | SQL | PostgreSQL 17 | `accounts`, `wallet_link_nonces` | — | Crítica |
| Postgres `indexer` | Read-model | SQL | PostgreSQL 17 | 12 tabelas (listings, nfts, sales, forge_requests, …) | escrito pelo Ponder | Alta |
| BCKN (Token) | Smart contract | Solidity 0.8.35 | ERC-20 upgradeável (proxy) | `mint`, `burn`, `burnFrom`, cap | MINTER_ROLE (NFT, Staking) | Crítica |
| BitChickenNFT | Smart contract | Solidity 0.8.35 | ERC-721 upgradeável (proxy) | `forgeMint`, `tokenURI`, catálogo, tiers, referral | BCKN, Forge | Crítica |
| BitChickenForge | Smart contract | Solidity 0.8.35 | imutável + Chainlink VRF v2.5 | `requestObtain`, `claimRefund`, `cancelStaleRequest` | VRF, NFT | Crítica |
| BitChickenStaking | Smart contract | Solidity 0.8.35 | upgradeável (proxy) | `stakePair`, `claim`, `unstakePair` | NFT, BCKN (yield) | Alta |
| BitChickenMarketplace | Smart contract | Solidity 0.8.35 | upgradeável (proxy) | `list`, `obtain`, swap | NFT (transfer, royalty) | Alta |
| Scripts Hardhat | Tooling on-chain | TypeScript | Hardhat 3 + OZ Upgrades | deploy, upgrade, verify, forge-watch, stress | BSC RPC, BSCScan | Média |
| RW.BC.AppHost | Orquestrador (dev) | C# / .NET Aspire | Aspire 13.4 | sobe Postgres + API + chain + deploy + indexer + dApp | Docker | Dev-only |

## Fatos-chave (não-óbvios)

- **A API e o Indexer compartilham o mesmo banco, sem chamada entre si.** O
  Ponder escreve no schema `indexer`; a API lê esse schema via EF `ToView`
  (somente leitura, sem migrations). Não há HTTP entre indexer e API.
- **O dApp tem dois canais de leitura.** A maioria das leituras vai à API
  (alimentada pelo indexer, _eventual consistency_); apenas dados dinâmicos
  (`pendingYield`, `nextUnlock`) e config de admin são lidos direto da cadeia.
- **A ABI é mantida à mão em dois lugares**: `RW.BC.DApp/.../contract-abi.ts` e
  `RW.BC.Indexer/abis/*.ts`. Não há geração automática a partir do Crypto.
- **O Forge é o único contrato não-upgradeável** — é trocável via
  `nft.setForge(...)`, então não precisa de proxy.
- **A API HTTP embutida do Ponder (`/sql`, `/graphql`) não é consumida** pela
  API .NET; serve só para inspeção/debug.
