# Funcionalidades — RW.BC.DApp

## 1. Conectar Carteira

- **Entrada:** botão na navbar ou ação que requer carteira
- **Arquivos:** `core/web3/web3.service.ts`
- **Comportamento:**
  - Abre modal Reown AppKit (`appKit.open()`)
  - Subscreve `subscribeAccount` e `subscribeNetwork`; expõe signals reativos: `address`, `isConnected`, `chainId`, `isCorrectNetwork`, `shortAddress`, `status`
  - `whenSettled()` aguarda estado inicial (timeout 4 s) antes de guards usarem o valor
  - `getSigner()` verifica rede correta antes de retornar o signer (lança `Web3Error WRONG_NETWORK` se chainId diferir)
  - `watchNft()` adiciona token ERC-721 à carteira via `wallet_watchAsset`
- **Regras:** carteira deve estar na rede configurada pelo ambiente (`bsc` / `bscTestnet` / localnet 1337)

## 2. Autenticação (Firebase)

- **Entrada:** dialog de login/cadastro (`AuthDialogService`, modos `login`/`signup`) — não são rotas
  dedicadas
- **Arquivos:** `core/auth/auth.service.ts`, `shared/components/auth-dialog/`
- **Comportamento:**
  - `signUp`: `createUserWithEmailAndPassword` + `updateProfile` (apelido) + força refresh de idToken
  - `signIn`: `signInWithEmailAndPassword`
  - `signOut`: `firebaseSignOut`
  - `onIdTokenChanged` mantém signal `currentUser` e `initialized` sempre atualizados
  - `AccountStore` carrega automaticamente `GET /accounts/me` ao detectar usuário autenticado (com deduplicação por `uid`)
- **Regras:** login e cadastro são pré-requisito para ações on-chain (gate via `WriteGateService`)

## 3. Vínculo de Carteira (SIWE)

- **Entrada:** modal disparado por `walletLinkedGuard` ou por `WriteGateService`
- **Arquivos:** `core/auth/wallet-link.service.ts`, `core/auth/auth-api.service.ts`, `shared/components/wallet-link-dialog/`
- **Comportamento:**
  - `POST /accounts/me/wallet/nonce` → obtém mensagem SIWE + nonce com validade
  - Usuário assina a mensagem com o signer da carteira conectada
  - `POST /accounts/me/wallet` com `{ address, signature }` → API valida e vincula
  - `DELETE /accounts/me/wallet` → desvincula
  - `AccountStore` atualiza `walletLinked` após cada operação
- **Regras:** carteira deve estar conectada antes de solicitar nonce; vínculo exige login ativo

## 4. Write Gate (portão de escrita)

- **Entrada:** qualquer ação on-chain que escreve no contrato
- **Arquivos:** `core/auth/write-gate.service.ts`
- **Comportamento:**
  - Verifica se usuário está autenticado (`AuthService.isAuthenticated`)
  - Se não: abre dialog de login via `AuthDialogService`; se o usuário cancelar, retorna `'not_authenticated'`
  - Verifica se carteira está vinculada (`AccountStore.walletLinked`)
  - Se não: abre `WalletSyncPromptService`; se não vincular, retorna `'not_linked'`
  - Retorna `'allowed'` se ambas as condições forem satisfeitas
- **Regras:** nenhuma transação on-chain é submetida sem esse check; o check é assíncrono e pode abrir modais

## 5. Loja — Comprar Ovo (Gacha / Forge)

- **Entrada:** `/loja` (rota pública)
- **Arquivos:** `features/store/store.ts`, `core/web3/contract-write.service.ts` (`requestObtain`), `core/realtime/forge-wait.service.ts`
- **Comportamento:**
  - Carrega tiers de preço via `ContractReadService.getMintTiers()` (cache 30 s)
  - Usuário seleciona tier, define nome (alfanumérico, 1–24 chars) e confirma
  - `ContractWriteService.requestObtain()`:
    - Estima gas e multiplica por 2x; fallback 3 000 000 gas se estimativa falhar
    - Envia tx `forge.requestObtain(tier, referrerCode, name)` pagando `tierPrice`
    - Extrai `requestId` do evento `ForgeRequested` no receipt
  - `ForgeWaitService.waitForFulfillment()`:
    - Conecta ao SignalR e aguarda evento `forgeFulfilled` (timeout 45 s)
    - Fallback 1: consulta `GET /accounts/:address/forge-requests?filter=requestId=<id>` via `ForgeApiService`
    - Fallback 2: polling direto de evento on-chain via `ContractReadService.awaitObtain()`
  - Exibe animação de chocagem (`EggHatch`) e reveal com stats do NFT
  - Invalida cache de inventário após conclusão
- **Regras:**
  - Nome do NFT: regex `/^[A-Za-z0-9 ]{1,24}$/`
  - Código de referral lido de `ReferralService` (via `?ref=` na URL, TTL 30 dias)
  - Usuário precisa ter saldo BNB suficiente para preço do tier + gas

## 6. Granja — Staking de Casais

- **Entrada:** `/granja` (rota privada: requer `authGuard` + `walletLinkedGuard`)
- **Arquivos:** `features/farm/farm.ts`, `core/web3/contract-write.service.ts`, `core/market-data/market-data.service.ts`
- **Comportamento:**
  - Carrega NFTs via `MarketDataService.getAllAccountNfts()` (paginação automática de até 100/página)
  - Carrega pares em stake via `MarketDataService.getAccountStaking()` (paginado, 10/página)
  - Enriquece cada par com dados dinâmicos on-chain (`pendingYield`, `nextUnlock`) via `ContractReadService`
  - Carrega info de referral via `MarketDataService.getAccountReferral()`
  - **Fazer stake:** seleciona macho + fêmea → `setApprovalForAll(staking, true)` → `stakePair(maleId, femaleId)`
  - **Colher:** `claimYield(pairId)` — só disponível se `pendingYield > 0` e `nextUnlock` atingido
  - **Desfazer stake:** `unstakePair(pairId)`
  - **Registrar referral:** `registerReferrer()` — gera código numérico on-chain
  - **Resgatar recompensa de referral (BNB):** `forge.claimReferralBnb()`
  - Exibe nível, taxa atual e pendente em **BNB**; "próximo nível em N indicados" derivado da contagem
  - QR code e botão de copiar link de referral (`/forja?ref=<code>`)
- **Regras:**
  - Par deve ser macho + fêmea; gêneros complementares validados on-chain (`GendersNotComplementary`)
  - Par casado (mesma `editionId`) recebe multiplicador de rendimento
  - Colheita queima porcentagem do yield (`claimBurnBps`) — configurável pelo admin

## 7. Marketplace

- **Entrada:** `/mercado` (rota pública; escrita requer carteira)
- **Arquivos:** `features/marketplace/marketplace.ts`, `core/web3/contract-write.service.ts`, `core/market-data/market-data.service.ts`, `core/realtime/signalr.service.ts`
- **Comportamento:**
  - Carrega listings ativos via `MarketDataService.getListings()` (paginado, 20/página; filtros: espécie, termo, ordenação)
  - Atualização em tempo real via SignalR `marketChanged` com debounce 300 ms e `RECONCILE_DELAYS [1500, 3000, 6000]` ms após tx
  - **Listar NFT:** wizard de 2 passos (selecionar NFT → definir preço BNB) → `listNft(tokenId, priceWei)` (inclui `setApprovalForAll` automático se necessário)
  - **Comprar:** `obtainNft(tokenId, price)` com `{ value: price }`
  - **Cancelar listagem:** `cancelListing(tokenId)` (só para o vendedor)
  - Preço exibido em BNB e fiat (CoinGecko)
- **Regras:**
  - Vendedor só pode cancelar sua própria listagem
  - Preço mínimo de listagem > 0 (validado no frontend)
  - Taxa de plataforma (`platformFeeBps`) e royalty cobrados on-chain pelo contrato

## 8. Coleção

- **Entrada:** `/colecao` (rota pública)
- **Arquivos:** `features/collection/collection.ts`, `core/market-data/market-data.service.ts`
- **Comportamento:**
  - Carrega catálogo de edições via `MarketDataService.getEditions()` (paginado, 10/página)
  - Se carteira conectada: cruza com NFTs do usuário (`getAllAccountNfts`) para marcar espécies possuídas e quantidades
  - Exibe progresso de coleção (% de espécies únicas possuídas / total)
- **Regras:** coleção é pública; carteira conectada opcional (habilita indicadores de posse)

## 9. Granja Pública

- **Entrada:** `/farms/:address` (rota pública)
- **Arquivos:** `features/public-farm/public-farm.ts`, `core/market-data/market-data.service.ts`
- **Comportamento:**
  - Exibe inventário de NFTs e pares em stake de um endereço arbitrário
  - Enriquece pares com dados dinâmicos on-chain (`pendingYield`, `nextUnlock`)
  - Paginação independente para inventário e pares
- **Regras:** endereço obrigatório na rota; endereço inválido exibe erro

## 10. Transparência

- **Entrada:** `/transparencia` (rota pública)
- **Arquivos:** `features/transparency/transparency.ts`, `core/market-data/market-data.service.ts`
- **Comportamento:**
  - Carrega resumo via `GET /transparency/summary` (totalVendas, volume total, contagem de NFTs/edições, BCKN transferido)
  - Carrega histórico de vendas via `GET /transparency/sales` (paginado, 20/página, ordenado por bloco desc)
  - Exibe preço, taxa de plataforma, royalty e endereços de cada venda
- **Regras:** sem autenticação necessária; dados provêm do indexador (eventual consistency)

## 11. Referral por URL

- **Entrada:** query string `?ref=<código>` em qualquer rota
- **Arquivos:** `core/referral/referral.service.ts`
- **Comportamento:**
  - Detecta `?ref=` via `NavigationEnd` e na inicialização
  - Persiste código em `localStorage` com TTL de 30 dias
  - Código é lido por `Store.referrerCode` e passado em `requestObtain`
- **Regras:** código deve ser inteiro positivo; TTL expira silenciosamente

## 12. Cotação BNB/Fiat

- **Entrada:** qualquer view com preços (loja, marketplace, granja)
- **Arquivos:** `core/market/coingecko.service.ts`
- **Comportamento:**
  - Chama `GET https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=<fiat>` com retry exponencial (3 tentativas)
  - Fiat selecionado por idioma ativo: en-US → USD, pt-BR → BRL
  - Cache local de 60 s por moeda; deduplicação de chamadas em voo
  - Expõe signal `quote` com `{ rate, currency, locale, change24h }`
- **Regras:** falha silenciosa (retorna último valor cacheado ou `null`)

## 13. Admin

- **Entrada:** `/admin` (requer `adminGuard`: carteira deve ser `environment.admin`)
- **Arquivos:** `features/admin/admin.ts`, `features/admin/panels/`, `core/web3/contract-admin.service.ts`
- **Comportamento:** painel em abas com 7 painéis:
  - **Editions:** registrar nova edição (`registerEdition`), ativar/desativar, alterar janela de mint
  - **NFT:** atualizar preços de tiers, royalty, rename price, level rates, referral reward, endereço do Forge; pausar/despausar; sacar fundos; aceitar ownership
  - **Forge:** sacar fundos; aceitar ownership
  - **VRF:** visualizar e atualizar configuração VRF (keyHash, subId, callbackGasLimit, requestConfirmations)
  - **Staking:** baseRate, weights (health/skill/morale), claimBurnBps, idealPairMultiplierBps; pausar/despausar; aceitar ownership
  - **Token:** emissionCap; pausar/despausar
  - **Marketplace:** platformFee (feeSink + bps); pausar/despausar; aceitar ownership
  - `ContractAdminService` é provisionado a nível de rota (`providers: [ContractAdminService]`) — não é root-level
  - Upload de imagem para IPFS via `PinataUploadService` (JWT configurado na sessão, armazenado em `localStorage`)
- **Regras:** `adminGuard` compara `web3.address()` com `environment.admin` (case-insensitive); acesso negado redireciona para `/`

## 14. Internacionalização (i18n)

- **Entrada:** seletor de idioma na navbar
- **Arquivos:** `core/i18n/language.service.ts`, `core/i18n/language.config.ts`, `public/i18n/en-US.json`, `public/i18n/pt-BR.json`
- **Comportamento:**
  - Suporta `en-US` (padrão) e `pt-BR`
  - Idioma detectado por query `?lang=` ou `localStorage`; fallback para `en-US`
  - Impacta cotação fiat (USD vs BRL) via `CoinGeckoService`
- **Regras:** nenhum texto visível ao usuário pode ser cravado no código — todas as strings passam por `TranslatePipe` ou `translate.instant()`

## 15. SEO / Metatags

- **Entrada:** navegação entre rotas
- **Arquivos:** `core/seo/seo.service.ts`, `core/seo/seo.config.ts`
- **Comportamento:**
  - Atualiza `<title>`, `og:*`, `twitter:*`, canonical, hreflang (x-default, en-US, pt-BR) a cada navegação e mudança de idioma
  - Na rota `/legal`: injeta script JSON-LD de `FAQPage` (Schema.org)
- **Regras:** título e descrição lidos das chaves `seo.<rota>.title` / `seo.<rota>.description` via i18n
