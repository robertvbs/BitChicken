# Armadilhas — RW.BC.DApp

## Resumo

| Sintoma | Causa | Correção |
|---|---|---|
| Template Angular compila mas lança `SyntaxError` em runtime com `0n` | Literais `bigint` (`0n`) não são aceitos no compilador de templates | Crie um `computed()` booleano e use-o no template |
| Cobertura de testes cai abaixo de 100% após adicionar branch inalcançável | O builder de testes Angular não honra `/* v8 ignore */` em branches | Remova o código morto ou reestruture para que o branch seja testável |
| UI exibe dados de contrato desatualizados após transação | Caches de 30 s em `ContractReadService` não são invalidados automaticamente | Chame `invalidateInventoryCache()` ou `invalidateCatalogCache()` após transações relevantes |
| `ovo travado em "Chocando…"` — modal não fecha | `ForgeWaitService` aguardou 45 s sem resposta SignalR; fallback de API/polling também falhou | Verificar se `forge:watch` está rodando no Aspire (`npm run forge:watch`); sem ele, VRF não responde no localnet |
| MetaMask rejeita transação com nonce inválido após `node:reset` | MetaMask armazena nonce/altura de chain antiga; chain local foi resetada | Limpar em MetaMask → Configurações → Avançado → Limpar dados da aba de atividade |
| Contrato parece correto mas operações retornam dados zeros ou revertam com `reason: null` | ABI manual em `contract-abi.ts` está desatualizada em relação ao contrato reimplantado | Atualizar `contract-abi.ts`, `ContractReadService`/`ContractWriteService`/`ContractAdminService` (nomes de método/tipos) e `environment.*.ts` (endereços); não há geração automática |
| `authTokenInterceptor` injeta Bearer em chamada ao CoinGecko | URL não começa com `apiBaseUrl` mas interceptor usa `startsWith` case-sensitive | Garantir que `apiBaseUrl` em `environment.*.ts` tem a URL exata da API |
| Build falha com `NETSDK1226` | Flag `-p:AllowMissingPrunePackageData=true` ausente no comando `dotnet` no WSL | Não aplicável ao DApp (é erro da API); no DApp o build é `ng build` sem esse flag |
| Testes falham com `Cannot find module 'firebase/auth'` | Firebase deve ser mockado via `vi.mock('firebase/auth', ...)` nos specs | Usar `vi.mock(...)` como em `src/testing/web3-fakes.ts`; nunca importar o SDK real em testes unitários |
| Preço BNB não aparece / sempre zero | CoinGecko retornou erro e não há valor cacheado | Comportamento esperado — cotação é melhor-esforço; verificar console para erros de rede/rate-limit |
| Componente `Admin` acessa contratos mas lança `CALL_EXCEPTION` | `ContractAdminService` não está provisionado: foi injetado fora da rota `/admin` | `ContractAdminService` usa `@Injectable()` sem `providedIn: 'root'`; só existe no escopo da rota via `providers: [ContractAdminService]` em `app.routes.ts:83` |
| Link de referral gerado aponta para `/forja?ref=` mas rota redireciona para `/loja` | Rota `/forja` existe como `redirectTo: 'loja'` | Comportamento intencional; a URL de referral usa `/forja` mas o redirect preserva o `?ref=` |
| SignalR não reconecta após perda de rede | `withAutomaticReconnect()` habilitado, mas `subscribedAddresses` não é re-enviado antes da reconexão | `onreconnected` re-inscreve todos os endereços; aguardar ciclo de reconexão |
| `ng test` rodando em Node 20 falha ao iniciar | Angular 22 e Vitest 4 requerem Node 24 | `nvm use 24` antes de qualquer comando |
| `walletLinkedGuard` não abre modal em rota `/granja` | `WalletSyncPromptService.open()` retornou `false` (usuário cancelou) | Comportamento esperado; guard retorna `false` (bloqueio de rota) |

---

## Armadilha 1 — Sincronização de ABI (a mais crítica)

A ABI em `src/app/core/web3/contract-abi.ts` é um **subconjunto escrito à mão** — não é gerada a partir dos contratos Solidity. Há zero verificação automática de drift.

**Quando muda a interface de qualquer contrato (NFT, Forge, Staking, Marketplace, Token):**
1. Atualizar o array correspondente em `contract-abi.ts` (função, evento ou erro customizado).
2. Atualizar assinaturas de chamada em `ContractReadService`, `ContractWriteService` e `ContractAdminService`.
3. Atualizar interfaces em `web3.models.ts` se a estrutura de retorno mudou.
4. Atualizar os endereços nos três `environment.*.ts` após redeploy.

O hook `abi-drift-warn.sh` lembra ao editar `.sol`, mas não impede o build.

---

## Armadilha 2 — Literais `bigint` em Templates Angular

O compilador de templates Angular 22 rejeita literais `bigint` (`0n`, `1n`, etc.) com erro em tempo de compilação (ou runtime silencioso).

**Padrão correto:**
```typescript
// No componente:
readonly hasBalance = computed(() => this.balance() > 0n);

// No template — use o computed, não o literal:
@if (hasBalance()) { ... }
```

Nunca escreva `@if (balance() > 0n)` no template.

---

## Armadilha 3 — Cobertura de Testes e Branches Inalcançáveis

O builder `@angular/build:unit-test` (Vitest sob Angular) **não honra** comentários `/* v8 ignore next */` ou `/* v8 ignore */` para branches.

**Threshold atual (`angular.json`):** statements 100%, functions 100%, lines 100%, branches 98%.

Para alcançar 100% de branches:
- Remova o código morto (branches que nunca serão exercitados).
- Se o branch é defensivo mas inalcançável nos testes, o 2% de margem cobre isso.
- Nunca aumente o threshold do `angular.json` para contornar cobertura faltante.

---

## Armadilha 4 — `ContractAdminService` Não é Root-Level

`ContractAdminService` é anotado com `@Injectable()` sem `providedIn: 'root'`. Ele só existe no escopo do `EnvironmentInjector` da rota `/admin` (via `providers: [ContractAdminService]` em `app.routes.ts`).

Tentar injetá-lo em outro contexto (ex.: testes sem rota configurada, ou outro componente) lança `NullInjectorError`. Nos testes de painéis de admin, forneça-o via `TestBed.configureTestingModule({ providers: [ContractAdminService] })`.

---

## Armadilha 5 — Reset de Chain Local e MetaMask

Após `npm run node:reset` (ou restart do Aspire), a chain local reinicia do bloco 0 com um novo estado. O MetaMask mantém o nonce e a altura da chain anterior em cache.

**Sintoma:** MetaMask exibe "Nonce já usado" ou rejeita a transação.

**Correção:** MetaMask → Configurações → Avançado → Limpar dados da aba de atividade (Conta específica).

---

## Armadilha 6 — Tipos `bigint` vs `string` na API

Os DTOs da `RW.BC.Api` retornam campos numéricos grandes (tokenId, price, editionId, blockNumber) como **strings** (não `number` nem `bigint`). Isso evita perda de precisão no JSON.

Os mappers em `shared/market-data-mappers.ts` e os `dtoToRow` locais nos componentes fazem a conversão via `BigInt(dto.tokenId)`. Nunca assuma que o campo já é `bigint` diretamente da resposta HTTP.
