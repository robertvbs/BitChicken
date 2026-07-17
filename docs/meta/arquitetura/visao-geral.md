# Visão Geral — Ecossistema BitChicken

Topologia de **4 projetos** organizada por camada. O caminho de leitura é
unidirecional (contratos → indexer → Postgres → API → dApp); o caminho de
escrita on-chain é direto do dApp aos contratos via carteira.

```mermaid
graph TB
    subgraph Usuario
        U[Usuario com carteira Web3]
    end

    subgraph Frontend
        DAPP[dApp Angular 22<br/>SPA zoneless signals]
    end

    subgraph Web3_Carteira
        WALLET[Reown AppKit / WalletConnect]
        ETHERS[ethers v6<br/>read JsonRpcProvider / write signer]
    end

    subgraph Backend
        API[App Backend .NET 10<br/>Minimal API + Wolverine]
        HUB[SignalR EventsHub<br/>marketChanged / forgeFulfilled]
    end

    subgraph Indexacao
        INDEXER[Indexer Ponder 0.16.6<br/>viem handlers por dominio]
    end

    subgraph Banco
        PGPUB[(Postgres schema public<br/>accounts / wallet_link_nonces)]
        PGIDX[(Postgres schema indexer<br/>12 tabelas read-model)]
    end

    subgraph Contratos_OnChain
        TOKEN[BCKN ERC-20]
        NFT[BitChickenNFT ERC-721<br/>tiers / catalogo / referral]
        FORGE[Forge gacha VRF]
        STAKING[Staking granja]
        MARKET[Marketplace P2P]
    end

    subgraph Externos
        FIRE[Firebase Auth]
        VRF[Chainlink VRF v2.5]
        CG[CoinGecko]
        PIN[Pinata IPFS]
        SCAN[BSCScan / Otterscan]
    end

    U --> DAPP
    DAPP --> WALLET
    DAPP --> ETHERS
    DAPP --> FIRE
    DAPP -->|HTTPS + Firebase JWT| API
    DAPP -->|WebSocket| HUB
    DAPP --> CG
    DAPP -->|admin upload| PIN

    ETHERS -->|read/write| TOKEN
    ETHERS -->|read/write| NFT
    ETHERS -->|requestObtain| FORGE
    ETHERS -->|stake/claim| STAKING
    ETHERS -->|list/obtain/swap| MARKET

    API -->|EF Core read/write| PGPUB
    API -->|EF Core read-only Gridify| PGIDX
    API -->|valida JWT OIDC| FIRE
    HUB -->|LISTEN/NOTIFY| PGIDX

    INDEXER -->|eventos via RPC| TOKEN
    INDEXER -->|eventos via RPC| NFT
    INDEXER -->|eventos via RPC| FORGE
    INDEXER -->|eventos via RPC| STAKING
    INDEXER -->|eventos via RPC| MARKET
    INDEXER -->|upsert read-model| PGIDX

    FORGE -->|requestRandomWords| VRF
    VRF -->|fulfillRandomWords| FORGE
    NFT -->|burnFrom rename| TOKEN
    STAKING -->|mint yield| TOKEN
    FORGE -->|pickEdition / forgeMint| NFT
    MARKET -->|transfer / royalty| NFT
```

## Componentes por camada

| Camada | Componente | Projeto |
|---|---|---|
| Frontend | dApp Angular | `RW.BC.DApp` |
| Web3 / Carteira | Reown AppKit, ethers v6 | `RW.BC.DApp` |
| Backend | API .NET (REST + SignalR) | `RW.BC.Api` |
| Indexação | Indexer Ponder | `RW.BC.Indexer` |
| Banco | Postgres `public` + `indexer` | compartilhado (API escreve `public`; Ponder escreve `indexer`) |
| Contratos on-chain | BCKN, NFT, Forge, Staking, Marketplace | `RW.BC.Crypto` |
| Serviços externos | Firebase, Chainlink VRF, CoinGecko, Pinata, BSCScan | terceiros |

## Princípios arquiteturais

- **Boundaries rígidos.** Os 4 projetos não compartilham código. Comunicação só
  via **ABI** (contratos↔dApp/indexer), **HTTP + Firebase JWT** (dApp↔API) e
  **schema Postgres compartilhado** (indexer→API).
- **CQRS de leitura off-chain.** Leituras pesadas (NFTs, listings, staking,
  referral, vendas) saem da cadeia: o indexer materializa e a API serve. O dApp
  só lê on-chain dados dinâmicos (`pendingYield`, `nextUnlock`) e config de admin.
- **Escrita sempre on-chain e não-custodial.** Toda mutação de estado (comprar
  ovo, stake, listar, comprar) é tx assinada pela carteira do usuário; a API
  nunca custodia chave nem assina por ele.
- **Identidade federada e desacoplada da carteira.** Conta = Firebase
  (email/senha); carteira vinculada por SIWE (assinatura ECDSA). Login local é
  proibido na API.
- **Upgradeabilidade seletiva.** Token/NFT/Staking/Marketplace são proxies
  transparentes (OZ); o **Forge é imutável** (substituível via `nft.setForge`).
- **ABI mantida à mão (sem geração automática).** Mudar a interface de um
  contrato exige espelhar a ABI no dApp **e** no indexer.

## Dependências críticas

| Dependência | Impacto se cair |
|---|---|
| Chainlink VRF (gacha) | Sem aleatoriedade não há mint de NFT — ovo fica preso em "Chocando…" |
| BSC RPC | Sem RPC não há leitura/escrita on-chain nem indexação |
| Firebase Auth | Sem auth, endpoints protegidos retornam 401 e o write-gate bloqueia escrita |
| Postgres | Sem DB, provisionamento de conta, wallet-link e read-models falham |
| Indexer Ponder | Sem indexer, os read-models ficam desatualizados (API não detecta lag) |
| MINTER_ROLE (Staking) | Sem o papel, o yield do staking não consegue mintar BCKN (a indicação paga em BNB, não minta) |
