# Domínio — Contas e Autenticação

## Responsabilidade

Identidade do usuário **desacoplada da carteira**: conta por email/senha (via
Firebase) com apelido, e vínculo de **uma** carteira EVM por **SIWE** (assinatura
ECDSA). A conta é pré-requisito (write-gate) para qualquer escrita on-chain.

## Componentes

| Componente | Projeto | Papel |
|---|---|---|
| `Account` (aggregate) + `WalletLinkNonce` | `RW.BC.Api` | invariantes de conta e vínculo |
| `AccountProvisioningMiddleware` | `RW.BC.Api` | JIT provisioning na 1ª requisição autenticada |
| `NethereumSignatureVerifier` | `RW.BC.Api` | EcRecover do endereço (100% local) |
| Firebase JWT (OIDC) | `RW.BC.Api` | validação de token via discovery |
| AuthService, WalletLinkService, WriteGate | `RW.BC.DApp` | login Firebase, SIWE, portão de escrita |
| Painéis de auth, guards | `RW.BC.DApp` | telas de login/cadastro; `authGuard`, `walletLinkedGuard` |

## Entidades e funções principais

- `Account`: Id = Firebase UID, Email (unique), Nickname, Status, WalletAddress?
  (unique, nullable), WalletLinkedAt?. Criada por `Account.Create` (factory).
- **JIT provisioning:** não há `POST /accounts`; a conta é criada
  automaticamente. E-mail duplicado com UID diferente → 409.
- **SIWE:** `POST /accounts/me/wallet/nonce` (TTL 5 min) → usuário assina →
  `POST /accounts/me/wallet` verifica EcRecover (≠ endereço → 422); nonce
  consumido no commit (anti-replay); carteira duplicada → 409.
- Carteira salva na forma recuperada (lowercase canônico). `DELETE` desvincula.

## Integrações entre domínios

- **dApp → Firebase → API:** o dApp autentica no Firebase Web SDK; a API só
  **valida** o JWT (login local proibido) e provisiona a conta.
- **Write-gate:** toda escrita on-chain exige login + carteira vinculada (abre
  modais se faltar). Isso liga este domínio a Forge, Staking e Marketplace.
- **Banco:** único domínio que escreve no schema `public` (accounts,
  wallet_link_nonces) — todos os demais leem do schema `indexer`.

## Evidência

- `RW.BC.Api/funcionalidades.md` — itens 1 a 5; `integracoes.md` — Firebase + Nethereum.
- `RW.BC.DApp/funcionalidades.md` — itens 2 (Auth), 3 (SIWE), 4 (Write Gate).
- `RW.BC.DApp/integracoes.md` — "Firebase Auth", "RW.BC.Api (REST)".
