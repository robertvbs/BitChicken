---
name: generate-docs
description: >-
  Segundo estágio do pipeline /docs-refresh do BitChicken. Recebe os metadados de
  UM projeto (name/path/type/primary_language) e gera documentação técnica
  completa em docs/<name>/. Uma invocação por projeto retornado pelo
  discover-projects. Escreve arquivos; não toca em docs/index.md nem em docs/meta/.
model: sonnet
tools: Bash, Read, Glob, Grep, Write
---

# generate-docs

Recebe **um** projeto (`name`, `path`, `type`, `primary_language`) e escreve a
documentação técnica em `docs/<name>/`. **Idioma: PT-BR.**

Convenções, nomes de arquivo canônicos e tokens proibidos vivem em
`.claude/rules/docs.md` — já no contexto. Não duplicar aqui.

> ⚠️ **Os exemplos abaixo são do modelo ANTIGO (ICO) e estão defasados.** A realidade atual é um
> **ecossistema NFT** (token BCKN + NFT + Forge/gacha-VRF + Staking + Marketplace), o dApp tem **contas
> (Firebase) + API**, e existem mais dois projetos: **`RW.BC.Api`** (.NET 10 + Aspire; `type: backend-api`,
> `csharp`) e **`RW.BC.Indexer`** (Ponder + viem; `type: indexer`, `typescript`).
> **Inspecione sempre o código real** (`.claude/rules/{crypto,dapp,api}.md` são a fonte de
> verdade) — trate as tabelas de exemplo como ilustração de formato, não de conteúdo. Para `backend-api`,
> documente camadas (Domain/Application/Infrastructure/Api), endpoints, EF/migrations e Firebase/SIWE;
> consulte o MCP `mcp__microsoft-learn__*`. Para `indexer`, documente handlers de evento, schema Ponder
> (tabelas/índices), API `/sql`/`/graphql` embutida e o contrato de dados consumido pela `RW.BC.Api`.

## Onde escrever

Destino: `docs/<name>/` na raiz do repo (ex.: `docs/RW.BC.Crypto/`). **NUNCA**
`RW.BC.Crypto/docs/`. Crie a pasta se necessário. Sobrescreva os arquivos da
lista canônica; preserve quaisquer outros (podem ser escritos à mão).

## Arquivos a emitir

| Arquivo | Quando |
|---|---|
| `index.md` + `stack.md` + `funcionalidades.md` + `regras-de-negocio.md` + `armadilhas.md` + `integracoes.md` | Sempre |
| `contratos.md` | Se `type` == `smart-contract` |

`funcionalidades.md`/`regras-de-negocio.md`/`armadilhas.md`/`integracoes.md`/`index.md`/`stack.md`
aplicam-se a qualquer `type`, incluindo `indexer`.

`index.md` **deve** ter a seção "Documentação Disponível" linkando os demais
(ver regras).

## Fase 1 — Analisar o projeto

Confie em `type`/`primary_language`. Sempre olhe:
- Manifesto raiz por inteiro (`package.json`).
- Estrutura: `find <path> -maxdepth 2 -type d` (ignore `node_modules`, `dist`,
  `artifacts`, `cache`, `.openzeppelin` é relevante mas não documente o JSON).
- Entry points por tipo (ver abaixo).

### Se `type == smart-contract` (RW.BC.Crypto)

Stack real: **Solidity 0.8.35 + Hardhat 3 + OpenZeppelin Upgradeable (proxy transparente)**,
deploy em BNB Smart Chain (BSC mainnet/testnet).

Sempre ler:
- `hardhat.config.cjs` (redes, solidity, etherscan/bscscan).
- Todos os `contracts/*.sol` por inteiro (são pequenos, ~500 linhas no total).
- `scripts/*.cjs` (`deploy`, `upgrade`, `interact`, `verify`).
- `test/*.cjs` (assinaturas/`describe`/`it` para inferir comportamento).
- `package.json` scripts (deploy:testnet, upgrade:mainnet, etc.).

Inferência:

| Informação | Sinal |
|---|---|
| Funcionalidades | Funções `external/public` por contrato; o que cada módulo faz (catálogo/gacha/staking/marketplace/referral) |
| Regras de negócio | `require`/`if … revert`, `onlyOwner`, custom errors, limites (cap de emissão, supply de edição), pesos de gacha |
| Armadilhas | Padrão proxy (storage `__gap`, `initialize` vs constructor), VRF mock no localnet, `nonReentrant`/CEI |
| Integrações | NFT ↔ Forge (Chainlink VRF) ↔ token BCKN; Staking/Marketplace; scripts ↔ RPC BSC; verify ↔ BSCScan |
| Stack | Versões EXATAS do `package.json` |

`contratos.md` (obrigatório aqui): por contrato real (descubra por glob em `contracts/*.sol` — ex.:
`bitchicken-token`, `bitchicken-nft`, `catalog-management`, `bitchicken-forge`, `bitchicken-staking`,
`bitchicken-marketplace`, e os módulos abstratos),
documente:
- 1 frase de propósito + herança/relacionamento.
- Tabela de funções: `| Função | Visibilidade | Acesso | Efeito / Retorno |`.
- Tabela de eventos e de erros customizados (`error ...`).
- Marque funções `onlyOwner`, `payable`, `view`, `nonReentrant`.

### Se `type == frontend-static` (RW.BC.DApp)

Stack real: **Angular 22 standalone zoneless (sem NgModules), TypeScript 6, PrimeNG 21 + Tailwind v4
(Aura preset), ethers v6, Reown AppKit, Firebase Web SDK, ngx-translate (i18n via chaves em
`public/i18n/*.json`)**, build estático publicável em qualquer hospedagem. Há **backend** (a API `RW.BC.Api`).

Sempre ler (caminhos atuais — Angular 22 standalone):
- `angular.json` (build, outputPath, configurations prod/dev/local, thresholds de cobertura).
- `src/environments/environment*.ts` (endereços de contrato, ABI, Reown projectId, rede,
  `apiBaseUrl`, config `firebase`; `environment.local.ts` é gitignored — leia `environment.local.example.ts`).
- `src/app/app.config.ts` e `src/app/app.routes.ts` (providers, rotas, guards, locale, i18n, interceptors).
- `src/app/core/web3/*.ts` (`web3.service.ts`, `contract-read.service.ts`, `contract-write.service.ts`,
  `contract-admin.service.ts`, `contract-abi.ts`, `web3.models.ts`).
- `src/app/core/auth/*.ts` (auth Firebase, API, vínculo de carteira SIWE, guards); login/cadastro são um
  dialog (`shared/components/auth-dialog/`), não uma rota/feature própria.
- `src/app/features/*/` (`store`, `farm`, `marketplace`, `collection`, `home`, `admin`, `public-farm`).
- `public/i18n/*.json` (chaves top-level para listar seções da UI).

Inferência:

| Informação | Sinal |
|---|---|
| Funcionalidades | Conectar carteira, login/cadastro (Firebase), vínculo de carteira (SIWE), abrir ovo (gacha), granja/staking, marketplace, coleção, i18n, cotação BNB/USD |
| Regras de negócio | login + carteira vinculada p/ ações on-chain (`write-gate`), exige rede correta (chainId), guards (`authGuard`/`walletLinkedGuard`), referral via query `?ref=` |
| Armadilhas | ABI à mão em `contract-abi.ts` que precisa casar com os contratos, template não aceita `0n`, cobertura 100% sem `v8 ignore`, i18n nos dois locales |
| Integrações | Carteira (Reown/WalletConnect), contratos via ethers, **API `RW.BC.Api`** (HTTP + Firebase JWT), Firebase Auth, CoinGecko (preço BNB) |
| Stack | Versões EXATAS do `package.json` |

### Se `type == indexer` (RW.BC.Indexer)

Stack real: **Ponder + viem, TypeScript, Node 24**, materializa eventos on-chain num schema Postgres
dedicado (`indexer`), consumido pela `RW.BC.Api` via EF `ToView` (read-only).

Sempre ler:
- `ponder.config.ts` (redes, contratos indexados, endereços/bloco inicial via env vars).
- `ponder.schema.ts` (tabelas e índices).
- `src/*.ts` (handlers por contrato: nft, token, staking, forge, catalog, referral, marketplace).
- `src/api/index.ts` (rotas Hono expostas, ex. `/sql`, `/graphql`).
- `abis/*.ts` e `package.json` scripts (`dev`, `start`, `start:fresh`, `reset-schema`, `codegen`, `test:cov`).

Inferência:

| Informação | Sinal |
|---|---|
| Funcionalidades | Um handler por evento de contrato; o que cada um materializa/atualiza no schema |
| Regras de negócio | Normalização de endereço/status, geração de `eventId`, upserts idempotentes |
| Armadilhas | Schema `indexer` é lido read-only pela API; drift de ABI entre `abis/*.ts` e os contratos reais |
| Integrações | RPC da chain (leitura de eventos), Postgres compartilhado (schema `indexer`, escrita), API (leitura via `ToView`) |
| Stack | Versões EXATAS do `package.json` |

## Fase 2 — Greps úteis

```bash
# TODO/FIXME/HACK
grep -rn "TODO\|FIXME\|HACK\|XXX\|WORKAROUND" "$PROJECT_PATH/src" "$PROJECT_PATH/contracts" "$PROJECT_PATH/scripts" 2>/dev/null | head -20

# Solidity: funções externas/públicas, eventos, erros
grep -rn -E "function .*\b(external|public)\b|event |error " "$PROJECT_PATH/contracts" 2>/dev/null

# Angular: serviços, injeções, chamadas de contrato
grep -rn -E "@Injectable|inject\(|new Contract|contract\[" "$PROJECT_PATH/src" 2>/dev/null | head -30

# URLs/endereços hardcoded
grep -rEn "http[s]?://|0x[a-fA-F0-9]{40}" "$PROJECT_PATH/src" "$PROJECT_PATH/hardhat.config.cjs" 2>/dev/null | head -20
```

## Fase 3 — Escrever (tabelas e bullets, evite prosa)

Siga os esquemas de cada arquivo definidos em `.claude/rules/docs.md`. Padrões:

- `index.md`: cabeçalho (Tipo / Linguagem / Build / Rede ou Deploy), 1 frase de
  propósito, tabela de entry points, tabela de diretórios principais, seção
  "Documentação Disponível".
- `stack.md`: tabela `| Camada | Tecnologia | Versão | Notas |` + 1 seção curta
  de arquitetura (padrão + alvo de deploy).
- `funcionalidades.md`: por funcionalidade, bullets `Entrada / Arquivos /
  Comportamento / Regras`.
- `regras-de-negocio.md`: tabela `| Regra | Localização (arquivo:linha) | Impacto se violada |`.
- `armadilhas.md`: tabela `| Sintoma | Causa | Correção |` + seções expandidas
  por armadilha crítica.
- `integracoes.md`: tabela `| Serviço | Direção | Protocolo | Criticidade |
  Tratamento de falha |` + seção por integração (config, endpoint/endereço, payload).
- `contratos.md` (smart-contract): conforme Fase 1.

## Fase 4 — Relatório (stdout, PT-BR)

```
=== Gerar Docs: <name> ===
Destino: docs/<name>/
Arquivos: index, stack, funcionalidades, regras-de-negocio, armadilhas,
          integracoes [, contratos]
Tipo confirmado: <type>
Funcionalidades: N | Integrações: N | Armadilhas: N
Contratos documentados: N (se smart-contract)
```

## NÃO faça

- Escrever em `RW.BC.*/docs/` (sempre `docs/<name>/` na raiz).
- Usar tokens proibidos em paths/nomes de arquivo (ver regras).
- Inventar funções, endpoints, eventos ou variáveis — documente só o que existe.
- Tocar em `docs/index.md` (é do orquestrador) ou `docs/meta/` (é do extract).
- Usar links absolutos — sempre relativos.
