# ADR 0004 — Conta desacoplada da carteira (Firebase + SIWE)

**Status:** Aceito

## Contexto

Identificar o usuário só pela carteira dificulta recuperação de acesso,
comunicação (e-mail) e UX para quem não domina Web3; acoplar identidade à chave
privada é frágil.

## Decisão

Separar **identidade** (conta por email/senha via **Firebase**, com apelido) do
**endereço EVM**, vinculado por **SIWE** (assinatura ECDSA verificada com
EcRecover). Uma carteira por conta, sem custódia de chave.

## Consequências

- Login local na API é **proibido**: a API só valida o JWT do Firebase (OIDC).
- Vínculo é desafio-resposta: nonce (TTL 5 min) → assinatura → verify; nonce
  consumido no commit (anti-replay); carteira/e-mail únicos (409 em duplicata).
- Toda escrita on-chain passa por um **write-gate** (login + carteira vinculada).
- A conta é provisionada **JIT** na 1ª requisição autenticada (sem `POST /accounts`).

## Evidência

- `RW.BC.Api/funcionalidades.md` (itens 1–5); `integracoes.md` (Firebase, Nethereum).
- `RW.BC.DApp/funcionalidades.md` (itens 2–4).
