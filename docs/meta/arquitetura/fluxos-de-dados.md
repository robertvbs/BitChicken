# Fluxos de Dados — Ecossistema BitChicken

Fluxos cross-componente que atravessam mais de um projeto. Cada um traz o gatilho,
se é síncrono/on-chain, um `flowchart` e os passos numerados.

---

## Fluxo 1 — Compra de ovo com indicação

- **Gatilho:** usuário confirma compra de ovo na loja.
- **Natureza:** escrita on-chain (assíncrona via VRF) + leitura off-chain (indexer → API).

```mermaid
flowchart LR
    U[Usuario] --> DAPP[dApp]
    DAPP --> GATE[WriteGate login + carteira]
    GATE --> FORGE[Forge requestObtain paga tierPrice]
    FORGE --> VRF[Chainlink VRF]
    VRF --> FORGE2[Forge fulfillRandomWords]
    FORGE2 --> NFT[NFT forgeMint retorna referrer e rateBps]
    FORGE2 --> PEND[Forge pendingReferralBnb split do preco]
    NFT --> IDX[Indexer indexa eventos]
    IDX --> PG[(schema indexer)]
    PG --> API[App Backend]
    API --> HUB[SignalR forgeFulfilled]
    HUB --> DAPP2[dApp reveal NFT]
```

1. O `WriteGate` exige login Firebase + carteira vinculada antes de qualquer escrita.
2. O dApp envia `forge.requestObtain(tier, referrerCode, name)` pagando `tierPrice` em BNB.
3. O Forge pede aleatoriedade ao Chainlink VRF e emite `ForgeRequested` (com `requestId`).
4. O VRF retorna `fulfillRandomWords`; o Forge chama `pickEdition` + `forgeMint`.
5. O `forgeMint` deriva gênero do bit menos significativo da palavra e processa o vínculo
   de indicação, retornando `(tokenId, referrer, rateBps)` — não-zero só no 1º ovo do indicado.
6. No sucesso, o Forge reserva `paid * rateBps / 10000` em `pendingReferralBnb` e emite
   `ReferralBnbAccrued`. O Indexer materializa `ForgeFulfilled`, `Minted`, `ReferralLinked` e
   `ReferralBnbAccrued` no schema `indexer`; a API publica `forgeFulfilled` via SignalR ao comprador.
7. O dApp resolve a espera (SignalR; fallbacks: `GET /forge-requests`, polling on-chain).

---

## Fluxo 2 — Deploy / upgrade dos contratos

- **Gatilho:** operador roda `npm run deploy:<rede>` ou `npm run upgrade:<rede>`.
- **Natureza:** síncrono on-chain via Hardhat; propaga manualmente para dApp e indexer.

```mermaid
flowchart LR
    OP[Operador] --> HH[Scripts Hardhat]
    HH --> RPC[BSC RPC]
    RPC --> CHAIN[Contratos via proxy OZ]
    HH --> SCAN[BSCScan verify]
    HH --> MANIF[.openzeppelin manifests commit]
    CHAIN --> ADDR[enderecos deployados]
    ADDR -.copia manual.-> DAPP[dApp environment + contract-abi]
    ADDR -.copia manual.-> IDX[Indexer abis + DEPLOYED_ADDRESSES_PATH]
```

1. Deploy completo na ordem Token → NFT → Staking → Marketplace → (VRFMock no
   localnet) → Forge; em seguida `setForge`, `grantRole(MINTER_ROLE)`,
   `setEmissionCap`, `updateTierPrices` e registro de edições de exemplo.
2. Upgrade usa `upgradesApi.upgradeProxy` com validação de storage; os manifests
   `.openzeppelin/{bsc,bsc-testnet}.json` devem ser commitados.
3. Verificação opcional na BSCScan via `npm run verify:<rede>`.
4. **Propagação manual (armadilha nº 1):** os novos endereços e qualquer mudança
   de interface precisam ser espelhados em `RW.BC.DApp` (`environment.*.ts` +
   `contract-abi.ts`) **e** em `RW.BC.Indexer` (`abis/*.ts` + endereços). Não há
   geração automática.

---

## Fluxo 3 — Indexação on-chain (read-model)

- **Gatilho:** qualquer evento emitido pelos contratos.
- **Natureza:** assíncrono (stream de eventos), _eventual consistency_.

```mermaid
flowchart LR
    CHAIN[Contratos BSC/Anvil] -->|eventos via RPC| IDX[Indexer Ponder]
    IDX -->|readContract getEdition| CHAIN
    IDX -->|upsert idempotente| PG[(schema indexer)]
    PG -->|EF Core Gridify read-only| API[App Backend]
    PG -->|LISTEN/NOTIFY| HUB[SignalR]
    API -->|REST paginado| DAPP[dApp MarketDataService]
    HUB -->|push| DAPP
```

1. O Ponder escuta eventos dos 5 contratos e, para edições, lê o estado canônico
   via `readContract({ functionName: "getEdition" })` no bloco do evento.
2. Cada handler faz `onConflictDoUpdate` (upsert idempotente) — reindexação é segura.
3. A API lê o schema `indexer` via EF `ToView` (somente leitura) com Gridify
   (filtro/paginação server-side) e nunca expõe estados não-ativos ao cliente.
4. O `MarketplaceEventsListener` detecta mudanças por LISTEN/NOTIFY (fallback
   polling 5 s) e publica `marketChanged`/`forgeFulfilled` via SignalR.

---

## Fluxo 4 — Cotação BNB/fiat (CoinGecko)

- **Gatilho:** qualquer view com preços (loja, marketplace, granja).
- **Natureza:** síncrono off-chain, com cache e degradação graciosa.

```mermaid
flowchart LR
    VIEW[View com precos] --> CG[CoinGeckoService]
    CG -->|cache 60s + dedup inflight| CACHE[(cache local)]
    CG -->|GET simple/price| API[CoinGecko API]
    API --> CG
    CG --> QUOTE[signal quote rate/currency/change24h]
    QUOTE --> VIEW
```

1. A moeda fiat é escolhida pelo idioma ativo (en-US → USD, pt-BR → BRL).
2. Cache local de 60 s por moeda; chamadas simultâneas compartilham a mesma
   `Promise` em voo; retry exponencial (3 tentativas).
3. Falha é silenciosa: retorna o último valor cacheado ou `null` — nunca bloqueia
   a renderização de preços em BNB.
