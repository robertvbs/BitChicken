# Contribuindo com o BitChicken

Obrigado pelo interesse em contribuir! Este é um monorepo com quatro projetos independentes — leia o
[`CLAUDE.md`](CLAUDE.md) primeiro para entender os invariantes arquiteturais (boundaries entre projetos,
sync de ABI, convenções de idioma) antes de fazer qualquer mudança.

## Pré-requisitos

- **Node.js 24** (`nvm use 24` — exigido pelo Hardhat 3 e pelo Angular 22; há `.nvmrc` em `RW.BC.Crypto/`
  e `RW.BC.Indexer/`).
- **.NET 10 SDK**.
- **Docker** (chain local via Anvil/Foundry, Postgres, Testcontainers dos testes de integração da API).

## Estrutura do projeto

- `RW.BC.Crypto/` — contratos Solidity 0.8.35 (Hardhat 3).
- `RW.BC.DApp/` — frontend Angular 22.
- `RW.BC.Indexer/` — indexador on-chain Ponder/viem.
- `RW.BC.Api/` — API de contas .NET 10 (Aspire, EF Core, Wolverine CQRS).
- `RW.BC.AppHost/` — orquestrador .NET Aspire para o ambiente de dev local.

Esses projetos só se comunicam pela ABI dos contratos, um schema Postgres compartilhado e HTTP — nunca
por código compartilhado ou import cross-project. Veja o [`README.md`](README.md) para subir o ambiente
localmente (o caminho mais rápido é `dotnet run --project RW.BC.AppHost`).

## Fazendo uma mudança

1. Faça um fork do repositório e crie uma branch a partir de `main`.
2. Mantenha a mudança dentro do boundary de um único projeto. Se você alterar a interface pública de um
   contrato, também precisa atualizar o espelho da ABI em
   `RW.BC.DApp/src/app/core/web3/contract-abi.ts` (veja `.claude/rules/crypto.md` /
   `.claude/rules/dapp.md` para detalhes — não há geração automática de ABI).
3. Escreva os testes junto da mudança, cobrindo caminhos de falha além do caminho feliz:
   - `RW.BC.Crypto`: `npm test` (Hardhat mocha + testes Solidity) — sem ferramenta de cobertura no HH3,
     então cubra código novo por construção.
   - `RW.BC.DApp`: `npm test` (`ng test`) — 100% statements/functions/lines, 98% branches impostos pelo
     `angular.json`.
   - `RW.BC.Api`: `dotnet test` (xUnit + Testcontainers).
   - `RW.BC.Indexer`: `npm run test:cov`.
4. Rode o lint do(s) projeto(s) que você tocou (`npm run lint` / `dotnet build`).
5. Mantenha as mensagens de commit focadas no "porquê", não só no "o quê".

## Antes de abrir um pull request

Rode o equivalente ao checklist do `ship-check` para o que você alterou:

```bash
# Crypto
cd RW.BC.Crypto && npm test && npm run lint

# dApp
cd RW.BC.DApp && npm test && npm run lint && npm run check:abi-drift && npm run lint:i18n

# API (anexe -p:AllowMissingPrunePackageData=true se o NETSDK1226 aparecer)
dotnet build RW.BC.Api/RW.BC.Api.slnx
dotnet test  RW.BC.Api/RW.BC.Api.slnx

# Indexer
cd RW.BC.Indexer && npm run typecheck && npm run test:cov
```

## Estilo de código

- Código (qualquer extensão) é escrito em **inglês**; texto visível ao usuário passa por i18n
  (`RW.BC.DApp/public/i18n/*.json`), nunca cravado.
- Comentários não são usados no código, exceto NatSpec em Solidity e XML-doc em C# onde o código já
  depende deles.
- Sem código morto; trate caminhos de falha explicitamente (compensação em fluxos multi-passo,
  idempotência, degradação graciosa em I/O externo).

## Reportando bugs / problemas de segurança

- Bugs funcionais: abra uma issue no GitHub com passos para reproduzir.
- Vulnerabilidades de segurança: veja [`SECURITY.md`](SECURITY.md) — não abra uma issue pública para isso.
