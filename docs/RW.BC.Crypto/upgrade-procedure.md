# Procedimento de Upgrade — RW.BC.Crypto

Como atualizar os contratos **upgradeáveis** com segurança. Os contratos usam **proxies transparentes
(OpenZeppelin)** + **storage namespaced ERC-7201**, então upgrades preservam estado se o layout for
compatível (apenas **append** de campos no fim de cada namespace).

## Quais contratos são upgradeáveis

| Contrato | Upgradeável? | Proxy |
|---|---|---|
| `BitChickenToken` | ✅ | transparente |
| `BitChickenNFT` | ✅ | transparente |
| `BitChickenStaking` | ✅ | transparente |
| `BitChickenMarketplace` | ✅ | transparente |
| `BitChickenForge` | ❌ **não-upgradeável** (imutável por design — VRF) | — |

## Regras de compatibilidade de storage

- **Permitido:** adicionar campos **no fim** de um struct ERC-7201 (`@custom:storage-location`).
- **Proibido:** reordenar, remover ou trocar o tipo de campos existentes; inserir antes dos existentes.
- **Inseguro (rejeitado pelo validador):** `selfdestruct`, `delegatecall`, variável `immutable`/constructor
  que escreve estado. Ver `test/upgrade.test.ts` (caso negativo).
- O `ReferralTreeManagement` (reescrito) usa ERC-7201 **sem `__gap`** — o namespace isola o storage e novos
  campos são appendados com segurança (ver [armadilhas.md](armadilhas.md)).

## Fluxo recomendado

1. **Validar (estático, sem rede):**
   ```bash
   npm run validate-upgrade        # valida upgrade-safety dos 4 contratos (scripts/validate-upgrade.ts)
   ```
   Roda no CI (job `crypto` em `.github/workflows/ci.yml`) e falha o build se algum contrato ficar
   não-upgrade-safe.
2. **Testar o upgrade E2E:**
   ```bash
   npx hardhat test mocha test/upgrade.test.ts
   ```
   Prova: estado preservado pós-`upgradeProxy` + nova função; implementação insegura é rejeitada.
3. **Executar o upgrade** (valida o layout vs. o manifest da rede e troca a implementação):
   ```bash
   npm run upgrade:localhost       # ou upgrade:testnet / upgrade:mainnet
   ```
   - Endereços dos proxies: lidos de `scripts/deployed-localhost.json` (localnet) ou das envs
     `TOKEN_PROXY`/`NFT_PROXY`/`STAKING_PROXY`/`MARKETPLACE_PROXY` (testnet/mainnet).
   - `UPGRADE_ONLY=token npm run upgrade:localhost` atualiza só um proxy.
4. **Commitar os manifests** `.openzeppelin/{bsc,bsc-testnet}.json` (são a fonte de verdade do layout por rede).

## Arquivos

- `scripts/upgrade.ts` — `validateUpgrade` + `upgradeProxy` para os 4 proxies.
- `scripts/validate-upgrade.ts` — `validateImplementation` (estático, para CI).
- `test/upgrade.test.ts` — E2E (estado preservado + rejeição de impl insegura).
- `contracts/mocks/bitchicken-token-v2.sol` / `bitchicken-token-bad-v2.sol` — fixtures do teste.

## Pós-desenvolvimento (produção)

Em mainnet, o owner dos proxies deve ser um **Gnosis Safe (multisig)** + `TimelockController`; o
`upgradeProxy` é proposto no Safe e executado após o delay do Timelock. (Fora do escopo da fase de dev.)
