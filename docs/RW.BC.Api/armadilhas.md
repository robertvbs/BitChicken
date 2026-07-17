# Armadilhas — RW.BC.Api

## Tabela rápida

| Sintoma | Causa | Correção |
|---|---|---|
| `NETSDK1226` em `dotnet build/test/restore` | SDK do WSL não encontra dados de pruning de pacotes | Sempre adicionar `-p:AllowMissingPrunePackageData=true`; nunca commitar em csproj/props |
| API retorna 404 no `GET /accounts/me` na primeira requisição | `AccountProvisioningMiddleware` não registrado ou não executado antes do handler | Verificar ordem dos middlewares no `Program.cs`; o middleware deve estar antes do `UseAuthorization` |
| 409 em provisionamento JIT simultâneo (stress) | Race condition na inserção — dois requests com mesmo UID chegam antes do commit do primeiro | Comportamento esperado e tratado; o segundo request absorve `ConflictException` de PK e retorna sem erro |
| 409 ao mudar e-mail no Firebase e logar novamente | E-mail do novo token já existe no `accounts` com outro UID (recriação de conta) | Deletar registro antigo em `accounts` (ou lidar na regra de negócio) — ver nota JIT email-collision |
| `410 Gone` ao tentar vincular carteira | Nonce expirado (TTL 5 min) ou nonce não gerado antes | Cliente deve chamar `POST /me/wallet/nonce` novamente |
| `422` em `POST /accounts/me/wallet` com assinatura válida | Endereço recuperado pelo EcRecover diverge do `address` enviado (maiúsculas/minúsculas, checksum EIP-55) | O endereço deve ser o que o MetaMask/Reown reporta — o EcRecover normaliza; verifique se o frontend envia o address exato |
| Listings do marketplace não aparecem | `status` no Ponder indexer não está `"Active"` (string exata) | O filtro é server-side (`where l.Status == "Active"`); verificar o Ponder para o valor correto do status |
| Pairs de staking não aparecem | `status` diferente de `"Staked"` ou `staker` com case diferente | Handler normaliza `address.ToLowerInvariant()`; verificar se o Ponder grava em lowercase |
| Valores BigInteger truncados no JSON (aparecem como número) | DTO usa tipo numérico (`long`, `decimal`) em vez de `string` para campos on-chain | Todos os campos de 78 dígitos devem ser `string` no DTO; `BigIntegerTypeConverter` resolve do lado do Gridify |
| Paginação retorna itens duplicados em páginas consecutivas | Falta de `DefaultOrderBy` — Postgres não garante ordem sem `ORDER BY` | Handlers de listings e staking já injetam `DefaultOrderBy`; novos handlers devem seguir o mesmo padrão |
| `NullReferenceException` em `GetSummaryHandler` quando DB está fora | `IMemoryCache.GetOrCreateAsync` retorna `null` se a factory lança antes de popular | Handler já trata com `?? new TransparencySummaryDto(0, "0", 0, 0, "0")` |
| `503` em `GET /transparency/summary` | `InfrastructureException` (DB offline) mapeada por `ProblemDetailsExceptionHandler` | Esperado; o cache de 30 s não ajuda se o DB cair — adicionar cache distribuído se necessário |
| `42P01` (tabela não existe) em `ForgeFulfillmentDetector`/`ListingsChangeDetector` | Schema `indexer` ainda não foi populado pelo Ponder | Silenciado intencionalmente; detectors retornam zero/null. Verificar se `RW.BC.Indexer` está rodando |
| `MarketplaceEventsListener` não reconecta após queda do Postgres | `CancellationToken` do host cancelado antes do `Task.Delay(RetryDelay)` | Comportamento correto — no shutdown, o loop termina; sem shutdown, reconecta automaticamente em 5 s |
| Wolverine não descobre handlers | Assembly errado passado para `opts.Discovery.IncludeAssembly` | Usar `typeof(Application._Extensions.DIExtension).Assembly` (o assembly `RW.BC.Application`) |
| `MediatorOnly` + tentativa de usar `PublishAsync` com domain events | Wolverine sem durabilidade não processa eventos assincronamente | Habilitar `WolverineFx.Postgresql` + `UseEntityFrameworkCoreTransactions()` + mudar `DurabilityMode` quando domain events forem introduzidos |
| Enum `AccountStatus` vaza no JSON como inteiro | Usar `AccountStatus` diretamente no DTO em vez de `AccountStatusDto` | DTOs devem usar `AccountStatusDto` (DTO-layer enum), convertido via cast `(AccountStatusDto)(byte)account.Status` |
| CORS bloqueia requisições do dApp | `AllowedHostSuffixes` ou `Origins` não configurados no `appsettings` | Configurar `Cors:Origins` e/ou `Cors:AllowedHostSuffixes` para os domínios do dApp e localhost |
| `EF Core migration` sem o startup project correto gera migration vazia | Migrations devem ser geradas a partir de `RW.BC.Api` como startup project | Usar `--project src/RW.BC.Infrastructure.Persistence --startup-project src/RW.BC.Api` |
| View `indexer.*` aparece nas migrations | Mapping com `ToView(...)` no EF não deveria gerar migration — mas se `DataContextModelSnapshot` incluir, o EF tentará criar a view | Nunca rodar `dotnet ef migrations add` sem revisar o snapshot; views do indexer são `ToView`, sem migration própria |
| `Version=` em `<PackageReference>` com `TreatWarningsAsErrors=true` | CPM (Central Package Management) ativo — versão em csproj gera warning NU1510, que vira erro | Versões somente em `Directory.Packages.props` |

---

## Armadilhas críticas (detalhadas)

### BigInteger em campos on-chain — usar `string` nos DTOs

**Problema:** Valores como `price`, `tokenId`, `requestId`, `maxSupply` vêm do Postgres como `numeric(78,0)`. Se mapeados para `long` (max ~9 × 10^18) ou `decimal` (max ~7.9 × 10^28), há overflow silencioso ou exceção.

**Solução implementada:**
- `BigIntegerConverters.Block`: `numeric(78,0)` → `long` apenas para block numbers (cabe em int64).
- Campos de ID e valor financeiro: `BigInteger` nos read-models, serializado como `string` nos DTOs.
- `BigIntegerTypeConverter` e `NullableBigIntegerTypeConverter` registrados em `DIExtension` para Gridify filtrar/ordenar por BigInteger.

**Atenção:** ao adicionar nova view do indexer, verificar se o campo cabe em `long` antes de usar `BigIntegerConverters.Block`; caso contrário, manter como `BigInteger`/`string`.

---

### JIT provisioning e race condition de e-mail

**Problema:** Se um usuário deleta e recria a conta no Firebase com o mesmo e-mail, o novo UID chegará no JWT. O middleware tentará provisionar e encontrará o e-mail no `accounts` com o UID antigo → 409.

**Causa:** `ix_accounts_email` é unique. O handler lança `ConflictException` com `ConstraintName = "ix_accounts_email"`.

**Mitigação atual:** A exceção não é absorvida (só o race condition de PK é absorvido). O fluxo falha com 409 até que o registro antigo seja removido manualmente ou por admin endpoint (não implementado).

**Atenção:** Não remover o `when (ex.ConstraintName != EmailConstraintName)` do catch — ele diferencia race de PK (absorvível) de colisão de e-mail (não absorvível).

---

### SIWE — endereço retornado pelo EcRecover vs. endereço enviado

**Problema:** `Nethereum.Signer.EthereumMessageSigner.EncodeUTF8AndEcRecover` retorna o endereço em lowercase hex (`0x...`). O cliente pode enviar o endereço com checksum EIP-55 (mixed case). A comparação usa `StringComparison.OrdinalIgnoreCase` — correto.

**Atenção:** `account.LinkWallet` valida regex `^0x[0-9a-fA-F]{40}$` (aceita mixed case). O endereço salvo é o que saiu do EcRecover (lowercase). Se o dApp comparar `WalletAddress` com endereço EIP-55, deve normalizar para lowercase.

---

### Schema `indexer` — leitura sem migrations

**Problema:** As views `indexer.*` são criadas e mantidas pelo Ponder (indexador externo). O EF Core mapeia com `ToView(...)` — **read-only, sem migrations**. Se o Ponder não rodou ou está atrasado, as queries retornam listas vazias (ou erro `42P01` na primeira inicialização).

**Atenção:** Nunca chamar `dotnet ef database update` esperando criar essas views — não estão no snapshot de migrations. Também nunca adicionar `builder.Entity<MarketplaceListing>().ToTable(...)` — quebraria o mapeamento.

---

### Wolverine em MediatorOnly — sem transação automática

**Problema:** Wolverine, no modo `MediatorOnly`, **não envolve o handler em transação**. Cada handler é responsável por chamar `unitOfWork.CommitAsync(cancellationToken)` explicitamente.

**Risco:** Se um handler fizer múltiplas operações sem um `CommitAsync`, as mudanças ficam na memória e são perdidas ao fim do request.

**Atenção ao introduzir domain events:** Religar `UseEntityFrameworkCoreTransactions()` e mudar `DurabilityMode` — ver comentário em `api.md`.
