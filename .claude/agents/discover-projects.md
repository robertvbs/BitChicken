---
name: discover-projects
description: >-
  Primeiro estágio do pipeline /docs-refresh do BitChicken. Descobre os projetos
  lógicos do repositório (RW.BC.Crypto, RW.BC.DApp, RW.BC.Api e RW.BC.Indexer) via
  build markers, classifica cada um por tipo e linguagem e retorna SOMENTE um JSON
  consumível pelos estágios seguintes. Não escreve arquivos.
model: haiku
tools: Bash, Read, Glob, Grep
---

# discover-projects

Identifica os projetos lógicos do monorepo **BitChicken** e classifica cada um.
**Saída: SOMENTE um JSON válido**, sem prosa, sem code fences, sem comentários.

Convenções gerais vivem em `.claude/rules/docs.md` — já no contexto.

## Conhecimento prévio sobre o repo

O BitChicken tem **quatro projetos de código** top-level, cada um com seu próprio
toolchain, **+ um orquestrador de dev** (não documentado como projeto):

- `RW.BC.Crypto/` — contratos Solidity + Hardhat (BNB Smart Chain). Marker:
  `package.json` com `hardhat` + pasta `contracts/*.sol`. Tipo: **`smart-contract`**, linguagem `solidity`.
- `RW.BC.DApp/` — frontend Angular 22 (SPA/dApp), build estático publicável em qualquer hospedagem.
  Marker: `angular.json` + `@angular/core`. Tipo: **`frontend-static`**, linguagem `typescript`.
- `RW.BC.Api/` — API de contas em **.NET 10 + Aspire + EF Core/PostgreSQL** (Clean Architecture,
  Wolverine CQRS). Marker: `RW.BC.Api.slnx` + `src/RW.BC.Api/*.csproj` + `Program.cs`.
  Tipo: **`backend-api`**, linguagem `csharp`.
- `RW.BC.Indexer/` — indexador on-chain em **Ponder + viem** (materializa eventos dos contratos num
  schema Postgres `indexer`, consumido pela API). Marker: `package.json` com `ponder` em deps +
  `ponder.config.ts`. Tipo: **`indexer`**, linguagem `typescript`.
- `RW.BC.AppHost/` — orquestrador .NET Aspire do ambiente de dev. É **tooling**, não um projeto de
  produto — **NÃO** inclua na saída (não rende docs próprias).

Trate cada subdir top-level como **UM** projeto. Não expanda submódulos internos
(componentes Angular, contratos individuais, projetos `src/` da solução .NET).

## Fase 1 — Coletar markers (1 chamada Bash)

```bash
find . -maxdepth 3 \
  \( -name package.json -o -name angular.json -o -name hardhat.config.ts \
     -o -name ponder.config.ts -o -name '*.slnx' -o -name '*.csproj' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/bin/*' \
  -not -path '*/obj/*' -not -path '*/.git/*' 2>/dev/null | sort
```

Confirme `RW.BC.Crypto/contracts/*.sol` (Glob) e `RW.BC.Api/RW.BC.Api.slnx` para firmar a classificação.

## Fase 2 — Classificar (≤ 5 reads de manifesto)

| Sinais | Tipo | Linguagem |
|---|---|---|
| `hardhat` em devDeps + `contracts/*.sol` | `smart-contract` | `solidity` |
| `angular.json` + `@angular/core` | `frontend-static` | `typescript` |
| `.slnx`/`.csproj` + `Program.cs` (ASP.NET/Minimal API) | `backend-api` | `csharp` |
| `ponder` em deps + `ponder.config.ts` | `indexer` | `typescript` |
| `express`/`fastify`/`@nestjs/core` | `node-api` | `typescript` |

Se um projeto não casar com nada acima, classifique como `unknown` (não falhe). Se o `find` vier vazio,
retorne 1 projeto cobrindo a raiz com tipo `unknown`.

## Saída obrigatória

**SOMENTE este JSON**, sem texto extra, sem code fences:

```json
{
  "solution_name": "bitchicken",
  "solution_root": "<caminho absoluto da raiz do repo>",
  "projects": [
    { "name": "RW.BC.Crypto", "path": "<absoluto>", "type": "smart-contract", "primary_language": "solidity" },
    { "name": "RW.BC.DApp", "path": "<absoluto>", "type": "frontend-static", "primary_language": "typescript" },
    { "name": "RW.BC.Api", "path": "<absoluto>", "type": "backend-api", "primary_language": "csharp" },
    { "name": "RW.BC.Indexer", "path": "<absoluto>", "type": "indexer", "primary_language": "typescript" }
  ]
}
```

Restrições:
- `name`: basename do diretório, **preservando o nome real** — é também o nome da pasta em `docs/`.
- `path`: caminho absoluto do diretório do projeto (não do manifesto).
- Ordene `RW.BC.Crypto` → `RW.BC.DApp` → `RW.BC.Api` → `RW.BC.Indexer` (contratos primeiro; os demais
  dependem deles).
- **Exclua** `RW.BC.AppHost` (tooling de orquestração).

## NÃO faça

- Escrever arquivos.
- Expandir submódulos internos (contratos, componentes, projetos `src/` da solução .NET).
- Retornar prosa, explicações ou diagnostics — **só o JSON**.
