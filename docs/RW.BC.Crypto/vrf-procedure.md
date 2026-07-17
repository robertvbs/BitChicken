# Procedimento VRF — RW.BC.Crypto

Como o **Chainlink VRF v2.5** é usado pelo `BitChickenForge` para randomizar o gacha de ovos,
e como provisionar/operar o VRF em localnet, testnet e mainnet.

## Visão geral: fluxo de duas fases

O gacha segue o padrão de comprometimento-e-revelação do Chainlink VRF para garantir que nenhuma
parte (nem o comprador, nem o operador) possa prever ou manipular o resultado antes da execução.

```
Comprador                    BitChickenForge               VRF Coordinator              BitChickenNFT
    |                               |                              |                          |
    |-- requestObtain(tier, ...) -->|                              |                          |
    |   (msg.value = tierPrice)     |-- requestRandomWords(...) -->|                          |
    |                               |   (subId, keyHash, gas)      |                          |
    |                               |<-- requestId ----------------| (N blocos depois)        |
    |                               |                              |                          |
    |                               |<-- fulfillRandomWords -------|                          |
    |                               |   (requestId, [randomWord])  |                          |
    |                               |-- nft.pickEdition(tier, w) ->|                          |
    |                               |<-- editionId ----------------|                          |
    |                               |-- nft.forgeMint(...) ------->|                          |
    |                               |<-- (tokenId, referrer, bps) -|                          |
    |                               |-- emit ForgeFulfilled ------->                          |
```

### Fase 1 — `requestObtain`

Chamada pelo comprador com `msg.value == nft.tierPrice(tier_)`.

1. Valida que `msg.value` é exato (`IncorrectPayment`) e que há edição disponível para o tier (`NothingAvailable`).
2. Armazena `ForgeRequest { buyer, tier, referrerCode, name, paid, blockNumber }` em `requests[requestId]`.
3. Reserva `msg.value` em `totalPendingRefunds` — `withdraw()` nunca drena esse escrow.
4. Chama `s_vrfCoordinator.requestRandomWords(...)` e recebe de volta o `requestId`.
5. Emite `ForgeRequested(buyer, requestId, tier)`.

### Parâmetros VRF configuráveis

| Parâmetro | Variável no contrato | Tipo | Descrição |
|---|---|---|---|
| `keyHash` | `bytes32 public keyHash` | gas lane | Identifica o job do Chainlink (latência e custo) |
| `subId` | `uint256 public subId` | subscription ID | Subscription que paga os pedidos de VRF em LINK |
| `callbackGasLimit` | `uint32 public callbackGasLimit` | wei de gás | Limite de gás para a execução do callback; válido entre `50_000` e `2_500_000` |
| `requestConfirmations` | `uint16 public requestConfirmations` | blocos | Mínimo de confirmações antes do VRF responder (>= 1) |
| `numWords` | fixo em `1` no código | — | Apenas 1 palavra aleatória é pedida por ovo |

Os parâmetros são definidos no **construtor** e atualizáveis via `setVRFConfig(...)` (apenas owner).

### Fase 2 — `fulfillRandomWords` (callback)

Chamado exclusivamente pelo VRF coordinator (protegido em `VRFConsumerBaseV2Plus`).

1. Lê e apaga `requests[requestId]` (CEI — estado primeiro).
2. Deriva `gender = uint8(randomWord & 1)` (bit menos significativo).
3. Chama `nft.pickEdition(tier, randomWord)` — seleção ponderada cumulativa entre edições elegíveis.
4. Chama `nft.forgeMint(buyer, editionId, gender, name, referrerCode)`.
5. Em caso de sucesso:
   - Libera `totalPendingRefunds -= paid` (BNB torna-se receita).
   - Se houver recompensa de referral, reserva `pendingReferralBnb[referrer] += reward`.
   - Emite `ForgeFulfilled(buyer, requestId, tokenId, editionId)`.
6. Em caso de falha em `pickEdition` ou `forgeMint` (ex.: edição esgotada no momento do callback):
   - `pendingRefund[buyer] += paid` (BNB permanece reservado, apenas move de escrow para pull-refund do comprador).
   - Emite `RequestCancelled(buyer, requestId, paid)`.

---

## Localnet — VRF Mock

No localnet (`localhost` / `hardhat`), o VRF coordinator real não existe. O deploy usa o contrato
`contracts/mocks/vrf-coordinator-mock.sol`, que é apenas um wrapper fino sobre
`VRFCoordinatorV2_5Mock` da Chainlink.

### Sequência de setup no deploy (`scripts/deploy.ts`)

```
1. Deployer instancia VRFCoordinatorMock(baseFee, gasPrice, weiPerUnitLink)
2. vrfMock.createSubscription()       → subId
3. vrfMock.fundSubscription(subId, 10 LINK-equivalentes)
4. Forge.deploy(vrfMockAddress, nftAddress, keyHash, subId, callbackGasLimit, confirmations, ADMIN_WALLET)
5. vrfMock.addConsumer(subId, forgeAddress)
6. nft.setForge(forgeAddress)
```

Tudo isso é executado automaticamente por `npm run deploy:localhost`.

### Auto-fulfill: `npm run forge:watch`

No localnet, o mock não responde automaticamente — alguém precisa chamar
`vrfMock.fulfillRandomWords(requestId, forgeAddress)` para que o callback ocorra.

O script `scripts/forge-watch.ts` faz exatamente isso: fica em polling (`setInterval 1500 ms`),
consulta eventos `ForgeRequested` novos e chama `fulfillRandomWords` no mock para cada `requestId`
ainda não processado.

```
forge:watch liga → polling de eventos ForgeRequested → fulfillRandomWords no mock → ForgeFulfilled
```

**Sem `forge:watch` rodando, o ovo fica travado em "Chocando…" indefinidamente.** O AppHost
(Aspire) sobe esse processo automaticamente; ao rodar só a chain manualmente, execute:

```bash
npm run forge:watch
```

O script lê os endereços de `scripts/deployed-localhost.json` (gerado pelo deploy).

---

## Testnet / Mainnet — VRF real

### 1. Criar uma subscription na Chainlink

Acesse [vrf.chain.link](https://vrf.chain.link) e conecte a carteira correspondente à rede alvo
(BNB Chain Testnet → chainId 97; Mainnet → chainId 56). Clique em **Create Subscription** e confirme
a transação. O `subscriptionId` gerado é o valor que vai em `VRF_SUB_ID` no `.env`.

### 2. Fundar a subscription com LINK

Na interface do VRF, na aba **Fund Subscription**, transfira LINK suficiente. Cada pedido de
aleatoriedade consome LINK. Recomendação inicial: pelo menos **5-10 LINK** para testes, mais para
produção (varia com o preço do LINK e o `callbackGasLimit` configurado).

### 3. Configurar o `.env` antes do deploy

```dotenv
VRF_COORDINATOR=<endereço do coordinator na rede>
VRF_KEY_HASH=<keyHash do gas lane desejado>
VRF_SUB_ID=<subscriptionId gerado acima>
VRF_CALLBACK_GAS_LIMIT=500000
VRF_REQUEST_CONFIRMATIONS=3
```

Para a BNB Smart Chain, os endereços e key hashes são publicados em
[docs.chain.link/vrf/v2-5/supported-networks](https://docs.chain.link/vrf/v2-5/supported-networks).

### 4. Deploy do Forge (testnet/mainnet)

Quando `connection.networkName !== 'localhost'`, o `deploy.ts` usa `vrfCoordinator` e `vrfSubId`
do `.env` diretamente, sem criar mock. O Forge é deployado com os parâmetros reais.

```bash
npm run deploy:testnet
# ou
npm run deploy:mainnet
```

### 5. Adicionar o Forge como consumer da subscription

Após o deploy, copie o endereço do Forge de `scripts/deployed-<rede>.json` e, na interface da
Chainlink (ou via contrato), chame `addConsumer(subId, forgeAddress)`. Sem esse passo, o coordinator
rejeitará os pedidos do Forge.

### 6. Verificar a configuração

Use `setVRFConfig` (apenas owner) se precisar ajustar parâmetros pós-deploy sem redeployar o Forge
(que é não-upgradeável).

---

## Resiliência e casos de borda

### Pedidos obsoletos (`cancelStaleRequest`)

Se o VRF coordinator não responder após `STALE_BLOCKS` (= 256 blocos), o comprador pode chamar
`cancelStaleRequest(requestId)`. O BNB pago é movido para `pendingRefund[buyer]` e pode ser sacado
via `claimRefund()`.

```
STALE_BLOCKS = 256 blocos ≈ ~13 minutos na BNB Chain (3-second block time)
```

### Escrow protegido (pull-payment)

O BNB de um pedido em voo está sempre reservado em `totalPendingRefunds`. A função `withdraw()`
do Forge só drena `balance - (totalPendingRefunds + totalPendingReferralBnb)`, garantindo que
o owner nunca possa sacar BNB que pertence a compradores ou referrers.

Para detalhes completos do modelo de escrow e dos invariantes de segurança, veja
[seguranca.md](seguranca.md).

### Falha no callback

Se `forgeMint` reverter durante `fulfillRandomWords` (ex.: edição esgotada entre o pedido e o
callback), o BNB não se perde: é movido para `pendingRefund[buyer]` automaticamente. O comprador
pode então sacar com `claimRefund()`.
