# Armadilhas — RW.BC.Crypto

## Tabela resumo

| Sintoma | Causa | Correcao |
|---|---|---|
| dApp nao consegue chamar funcoes do contrato / ABI error | ABI no frontend desatualizada apos alteracao de interface Solidity | Atualizar `contract-abi.ts` no DApp e `environment.*.ts` com novos enderecos pos-redeploy |
| Ovo fica em "Chocando..." indefinidamente no localnet | `forge:watch` nao esta rodando; VRF mock nao responde automaticamente | Iniciar `npm run forge:watch` ou usar `dotnet run --project RW.BC.AppHost` que o sobe automaticamente |
| `slot collision` ou storage corrompido apos upgrade | Modulo abstrato sem ERC-7201 namespace proprio ou `__gap` insuficiente | Nunca remover/reordenar variaveis de storage; usar namespace ERC-7201 em cada modulo abstrato; manter `uint256[50] private __gap` |
| `initialize` chamavel duas vezes | Construtor sem `_disableInitializers()` no contrato de implementacao | Todo contrato upgradeavel tem construtor com `_disableInitializers()` |
| MetaMask rejeita transacoes apos `node:reset` | Nonce/altura de bloco em cache no MetaMask desincronizados com a nova chain | Configuracoes → Avancado → Limpar dados da aba de atividade |
| `withdraw` do Forge reverte ou drena reembolsos pendentes | Chamada antes de `totalPendingRefunds` ser decrementado (bug pre-auditoria, ja corrigido) | Versao atual: `withdraw` drena `balance - totalPendingRefunds`; nunca toca fundos de compradores |
| `NoAvailableEdition` durante fulfillment do VRF | Todas as edicoes do tier ficaram esgotadas entre `requestObtain` e `fulfillRandomWords` (corrida) | Forge enfileira reembolso automaticamente via `pendingRefund`; comprador chama `claimRefund` |
| `FeesExceedPrice` em `obtain` | Royalty EIP-2981 configurado alto + taxa de plataforma somam mais que o preco do listing | Reduzir royalty (`setRoyalty`) ou taxa de plataforma (`setPlatformFee`); ou vendedor lista por preco maior |
| `EmissionCapExceeded` inesperado | `emissionCap` nao foi configurado ou foi configurado muito baixo antes de atividades de mint | Chamar `setEmissionCap` com valor adequado (padrao de deploy: 1 bilhao BCKN) |
| NFT preso no contrato de Staking | NFT enviado por contrato externo (nao BitChickenNFT) | `onERC721Received` reverte `UnauthorizedNFT` — NFT externo nunca entra |
| `CycleNotElapsed` em batch claim | `claimRange` foi chamado para um pair que nao completou 1 ciclo (168h) | `claimRange` pula silenciosamente pares sem ciclos completos; `claim` individual reverte corretamente |
| Listing "morto" (impossivel de comprar) | Vendedor vendeu/transferiu o NFT ou revogou aprovacao apos criar listing | Versao atual: `list` falha-rapido se marketplace nao estiver aprovado; `obtain` re-verifica posse e aprovacao |
| Deployment em rede errada | `.env` com `BSC_RPC_URL` ou `MAIN_PRIVATE_KEY` incorretos | Verificar `.env` antes de `npm run deploy:mainnet`; nunca commitar `.env` |

## Armadilhas criticas (detalhadas)

### 1. Sync de ABI (armadilha #1 do ecossistema)

Qualquer alteracao de interface publica nos contratos (assinaturas de funcoes, eventos, erros customizados) exige atualizacao manual no DApp:
- `RW.BC.DApp/src/app/core/web3/contract-abi.ts` — subconjunto da ABI em JSON inline.
- `RW.BC.DApp/src/app/core/web3/contract-read.service.ts`/`contract-write.service.ts`/`contract-admin.service.ts` — referencias de chamada.
- `RW.BC.DApp/src/app/core/web3/web3.models.ts` — tipos de retorno.
- `RW.BC.DApp/src/environments/environment.*.ts` — enderecos de proxy atualizados apos redeploy.

Nao ha geracao automatica de ABI. O hook `.claude/` `abi-drift-warn.sh` exibe aviso ao editar `.sol`, mas a responsabilidade de sincronizar e do desenvolvedor.

### 2. Proxy transparente — storage slot e initialize

- **Jamais reordenar nem remover** variaveis de estado nos contratos de implementacao (e nos modulos abstratos herdados). Adicionar apenas ao final, ou usar `__gap`.
- Cada modulo abstrato usa ERC-7201 com namespace proprio. `MintTierManagement` e `CatalogManagement` ainda mantem `uint256[50] private __gap`; o `ReferralTreeManagement` (reescrito) dispensa o gap — o namespace ERC-7201 isola o storage e novos campos sao appendados com seguranca.
- `initialize` so pode ser chamado uma vez (guard `initializer`); construtor chama `_disableInitializers()`.
- Manifests `.openzeppelin/{bsc,bsc-testnet}.json` devem ser commitados — sao a fonte de verdade do OZ Upgrades para validar compatibilidade de storage em upgrades futuros.

### 3. VRF mock no localnet — ovos presos

O Forge usa Chainlink VRF. No localnet o coordinator e o mock `VRFCoordinatorMock`. O mock **nao processa callbacks automaticamente** — o script `forge-watch.ts` escuta o evento `RandomWordsRequested` e chama `fulfillRandomWords` manualmente. Sem ele:
- A transacao `requestObtain` confirma e o ovo fica em estado "Chocando..." permanentemente.
- O modal do DApp pode estourar no timeout.

O `dotnet run --project RW.BC.AppHost` sobe o `forge:watch` automaticamente. Em uso direto (`npm run node:up && deploy:localhost`), lembrar de rodar `npm run forge:watch` em terminal separado.

### 4. Reentrada e padroes CEI

- `BitChickenNFT.forgeMint` e `rename` usam `nonReentrant` (transient) + CEI.
- `BitChickenForge.fulfillRandomWords`: limpa o request (`delete requests[requestId]`) antes das chamadas externas; em caso de revert nas chamadas `try/catch`, enfileira reembolso em vez de reverter o callback (que causaria retry infinito pelo coordinator).
- `BitChickenMarketplace.obtain`: deleta o listing antes de transferencias de BNB.
- `BitChickenForge.claimReferralBnb`: zera `pendingReferralBnb` e decrementa o total antes de transferir BNB (CEI).

### 5. Gas insuficiente no callback VRF

`callbackGasLimit` e configuravel via `setVRFConfig`. Limits:
- `MIN_CALLBACK_GAS = 50_000`
- `MAX_CALLBACK_GAS = 2_500_000`

Se `callbackGasLimit` for muito baixo para o `forgeMint` completar (catalog com muitas edicoes aumenta custo de `pickEdition`), o callback reverte e o Forge enfileira reembolso. Monitorar e aumentar via `setVRFConfig` se necessario.

### 6. `totalPendingRefunds` no withdraw do Forge

Antes da correcao na auditoria (Etapa 1), o `withdraw` poderia drenar BNB de compradores com reembolsos pendentes. A versao atual subtrai `totalPendingRefunds` do saldo disponivel. A variavel e incrementada por `cancelStaleRequest` e por falhas no fulfillment, e decrementada apenas por `claimRefund`. Nunca manipular `totalPendingRefunds` diretamente.
