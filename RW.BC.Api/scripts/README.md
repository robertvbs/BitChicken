# Scripts — RW.BC API E2E (contas/auth)

Bash scripts (`curl` + `jq`) que exercitam a **API de contas** do BitChicken viva (Firebase JWT +
vínculo de carteira). Úteis como smoke após deploy e regressão após refactors.

> Exigem **Firebase real** + **API no ar**, então não rodam em CI / offline. São validados por sintaxe
> com `bash -n`.

> **E2E cross-stack (read-model):** estes scripts cobrem só **contas/auth**. A validação ponta-a-ponta do
> pipeline **contratos → indexer → API** (edições/NFTs/listings/forge/transparência) é o
> [`RW.BC.AppHost/e2e-smoke.sh`](../../RW.BC.AppHost/README.md) — ver a seção "E2E ponta-a-ponta" do README do AppHost.

## Provisionamento JIT (sem `POST /accounts`)

Não há endpoint de cadastro na API. O usuário é criado no **Firebase pelo dApp** (Web SDK, seta
`displayName = nickname`); a `Account` é provisionada **just-in-time** na **primeira requisição
autenticada** (o `AccountProvisioningMiddleware` chama o `EnsureAccountProvisionedHandler` idempotente).
Na prática: o primeiro `GET /accounts/me` com um Bearer válido **cria** a conta e devolve o perfil.

## Pré-requisitos

- **`curl`** e **`jq`** instalados.
- **API up**: `dotnet run --project ../../RW.BC.AppHost` (Aspire — sobe Postgres + API + chain + indexer).
  A **porta da API é dinâmica** (Aspire) — veja no dashboard (`https://localhost:17190`) ou descubra pelo
  processo: `ss -ltnp | grep RW.BC.Api`. Passe em `API_BASE_URL`.
- **Docker** rodando (Aspire usa container Postgres em dev).
- **Firebase configurado** no `appsettings` (`Identity:Firebase`):
  - `ProjectId` — id do projeto Firebase / Google Identity Platform (a API valida o JWT por OIDC discovery).
  - `WebApiKey` — Web API key do projeto (os scripts usam para o login REST e obter o ID token).

  No repositório ficam como **strings vazias** (placeholders) — preencha localmente (não commitar segredos).
  (Não há service account / Admin SDK: a API só **valida** o token, não gere usuários.)

## Variáveis de ambiente

| Var | Usado por | Default | Descrição |
|---|---|---|---|
| `API_BASE_URL` | ambos | `https://localhost:7180` | Base URL da API (use a **porta dinâmica** do Aspire) |
| `CURL_INSECURE` | ambos | `1` | `1` adiciona `-k` ao curl (TLS self-signed em dev) |
| `FIREBASE_API_KEY` | ambos | — | Web API key (= `Identity:Firebase:WebApiKey`) para o sign-in REST |
| `ACCOUNT_EMAIL` | ambos | obrigatório | Email do usuário Firebase (já existente) |
| `ACCOUNT_PASSWORD` | ambos | obrigatório | Senha |
| `ID_TOKEN` | ambos | — | ID token Firebase já obtido (pula o sign-in) |
| `WALLET_PRIVATE_KEY` | `test-wallet-link.sh` | — | Private key EVM; assina a mensagem localmente via node+ethers |
| `WALLET_ADDRESS` | `test-wallet-link.sh` | — | Endereço da carteira (obrigatório só se passar `SIGNATURE` pronta) |
| `SIGNATURE` | `test-wallet-link.sh` | — | Assinatura pré-computada sobre a mensagem do nonce |

## Scripts disponíveis

| Script | Auth | Endpoint | Fases |
|---|---|---|---|
| `_common.sh` | — | helpers compartilhados (`invoke_api`, `read_field`, `firebase_signin`, `print_summary`) | — |
| `test-account-me.sh` | Bearer | `GET /accounts/me` | login Firebase → 1 happy (200, **JIT-provisiona** na 1ª vez) + sem token (401) |
| `test-wallet-link.sh` | Bearer | `POST /accounts/me/wallet/nonce`, `POST /accounts/me/wallet`, `DELETE /accounts/me/wallet` | nonce (200) → link (200) → replay (410) → unlink (200) → sem token (401) |

### Shapes de response (sem envelope)

- `GET /accounts/me` → `200 AccountDto{ id, email, nickname, status, walletAddress?, walletLinked }`
- `POST /accounts/me/wallet/nonce` → `200 { message, nonce, expiresAt }` (mensagem SIWE-style a assinar)
- `POST /accounts/me/wallet` → body `{ address, signature }` → `200 AccountDto`
- `DELETE /accounts/me/wallet` → `200 AccountDto`

#### Fluxo de wallet link (prova de posse via assinatura, sem custódia de chave)

1. `POST /accounts/me/wallet/nonce` devolve a **mensagem canônica** exata a ser assinada
   (statement fixo + account id + nonce single-use + issued-at).
2. A carteira assina essa string (EIP-191 `personal_sign`). O `test-wallet-link.sh` faz isso
   localmente com `node` + `ethers` quando `WALLET_PRIVATE_KEY` está setada (`wallet.signMessage(message)`),
   ou aceita `SIGNATURE` + `WALLET_ADDRESS` já prontos. Sem material de assinatura, as fases de
   link/unlink são **puladas** com aviso (a fase de nonce ainda roda).
3. `POST /accounts/me/wallet { address, signature }` recupera o signer via Nethereum
   (`EncodeUTF8AndEcRecover`) e vincula se bater com `address`. O nonce é **consumido** (replay → 410).

Mapeamento de falhas (wallet link):

| Situação | Status |
|---|---|
| nonce ausente / expirado | `410 Gone` |
| assinatura não bate com `address` | `422 Unprocessable Entity` |
| wallet já vinculada (índice único) | `409 Conflict` |
| `address`/`signature` malformados (FluentValidation) | `400 Bad Request` |

## Como rodar

```bash
# 1. Subir a API (Aspire) e descobrir a porta dinâmica
dotnet run --project ../../RW.BC.AppHost -p:AllowMissingPrunePackageData=true
API_PORT=$(ss -ltnp 2>/dev/null | grep RW.BC.Api | grep -oE '127.0.0.1:[0-9]+' | cut -d: -f2 | head -1)

# 2. Ler o perfil autenticado (login Firebase via REST + Bearer) — provisiona JIT na 1ª vez
API_BASE_URL=https://localhost:${API_PORT} FIREBASE_API_KEY=AIza... \
  ACCOUNT_EMAIL=alice@example.com ACCOUNT_PASSWORD='Sup3rSecret!' ./test-account-me.sh

# 3. Vincular/desvincular carteira (assina o nonce localmente com ethers)
API_BASE_URL=https://localhost:${API_PORT} FIREBASE_API_KEY=AIza... \
  ACCOUNT_EMAIL=alice@example.com ACCOUNT_PASSWORD='Sup3rSecret!' \
  WALLET_PRIVATE_KEY=0xabc... ./test-wallet-link.sh

# Variantes
ID_TOKEN=eyJ... ./test-account-me.sh                                        # token já obtido
SIGNATURE=0x... WALLET_ADDRESS=0x... ID_TOKEN=eyJ... ./test-wallet-link.sh   # assinatura pronta
```

> O usuário Firebase precisa **existir** (criado pelo dApp). Os scripts fazem sign-in REST, não cadastro.

O `test-account-me.sh` obtém o ID token via Firebase Identity Toolkit REST API:

```bash
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"...","returnSecureToken":true}'
```

No frontend (dApp Angular) isso é o `signInWithEmailAndPassword` + `getIdToken()` do Firebase Web SDK.

## Saída

Cada fase imprime `[<n>] <descrição>` + status code + `PASS`/`FAIL`. Ao final, resumo `N passed, M failed`.
Exit code `0` se tudo passou, `1` caso contrário.

## Cleanup

`test-account-me.sh` **provisiona** uma linha em `accounts` (JIT) para o usuário autenticado. Para resetar em dev:

```bash
# Parar Aspire (Ctrl+C), dropar o volume Postgres
docker volume rm bitchicken-pg-data
# (usuários no Firebase Auth são geridos no Console — a API não os toca)
# Subir de novo (migrations rodam automáticas em Development)
dotnet run --project ../../RW.BC.AppHost
```

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| 401 em `/accounts/me` | ID token expirado (~1h) ou `FIREBASE_API_KEY` errado — refazer login |
| `firebase_signin` falha | `WebApiKey`/`FIREBASE_API_KEY` inválido, ou usuário não existe no Firebase |
| 422 em `POST /accounts/me/wallet` | Assinatura não confere com o `address` |
| `curl` erro de certificado | API em HTTPS self-signed — manter `CURL_INSECURE=1` |
| conexão recusada | porta errada — a API do Aspire é dinâmica, redescubra com `ss -ltnp \| grep RW.BC.Api` |
