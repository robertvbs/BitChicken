---
name: extract-ecosystem
description: >-
  Terceiro e último estágio do pipeline /docs-refresh do BitChicken. Lê a doc de
  cada projeto em docs/<projeto>/ (RW.BC.Crypto, RW.BC.DApp, RW.BC.Api, RW.BC.Indexer)
  e sintetiza a visão unificada do ecossistema (arquitetura + ADRs) em docs/meta/.
  Só roda depois de TODOS os generate-docs concluírem.
model: opus
tools: Bash, Read, Glob, Grep, Write
---

# extract-ecosystem

Cruza `integracoes.md`, `funcionalidades.md`, `regras-de-negocio.md`,
`stack.md` e `contratos.md` de cada projeto sob `docs/` e sintetiza a
arquitetura do ecossistema BitChicken. Convenções gerais vivem em
`.claude/rules/docs.md` — já no contexto.

**Pré-requisito:** o orquestrador `/docs-refresh` só invoca este agent depois
que `generate-docs` rodou para todos os projetos. Não verificar.

**Idioma:** PT-BR. Tabelas e Mermaid no lugar de prosa. Cada arquivo ≤ ~200 linhas.

> ⚠️ **Os exemplos abaixo são do modelo ANTIGO (ICO) e estão defasados.** Hoje o ecossistema é **NFT**
> (BCKN + NFT + Forge/gacha-VRF + Staking + Marketplace) e há um **backend** real: a API **`RW.BC.Api`**
> (.NET 10 + Aspire + Postgres + Firebase + Wolverine), com **contas (email/senha)** e **vínculo de
> carteira via SIWE**. O grafo NÃO é mais "sem backend": inclua dApp → API (HTTP/Firebase JWT) e
> API → Postgres/Firebase. Use o código e `docs/<projeto>/` reais como fonte; os exemplos são só de formato.

## I/O

**Lê** de `docs/RW.BC.Crypto/`, `docs/RW.BC.DApp/`, `docs/RW.BC.Api/` e `docs/RW.BC.Indexer/`:
`index.md`, `stack.md`, `integracoes.md` (crítico para o grafo), `funcionalidades.md`,
`regras-de-negocio.md`, e `contratos.md` (do Crypto). **Ignora** `docs/meta/`
(é o destino) e `docs/index.md` (é do orquestrador).

**Escreve** em `docs/meta/`:
- `arquitetura/README.md` (índice + resumo do stack das 2 partes)
- `arquitetura/visao-geral.md` (Mermaid `graph TB` por camada)
- `arquitetura/catalogo-componentes.md` (tabela completa de componentes)
- `arquitetura/mapa-comunicacao.md` (matriz de integrações + `sequenceDiagram`
  do fluxo crítico de compra)
- `arquitetura/fluxos-de-dados.md` (Mermaid `flowchart LR` para 2-3 fluxos
  cross-componente: compra+indicação, deploy/upgrade, cotação)
- `arquitetura/dominios/<dominio>.md` (1 por domínio identificado)
- `adr/README.md` (índice de ADRs)
- `adr/000N-<slug>.md` (1 por decisão de ecossistema)

## Fase 1 — Ingestão

`Glob docs/*/index.md` → lista de projetos (esperado: RW.BC.Crypto, RW.BC.DApp, RW.BC.Api,
RW.BC.Indexer). Leia cada um na ordem acima. Construa **na memória** (não escreva):
- **Componentes**: nome → tipo, linguagem, propósito, criticidade.
- **Grafo**: arestas `(de, para, protocolo, direção, criticidade)`. Eixos centrais:
  dApp (RW.BC.DApp) → contratos NFT/Forge/Staking/Marketplace/token (ethers, via carteira);
  dApp → API (RW.BC.Api) (HTTP/Firebase JWT); Indexer (RW.BC.Indexer) → contratos (leitura de eventos via
  RPC) e → Postgres (schema `indexer`, escrita); API → Postgres (EF, lê o schema `indexer` via `ToView` +
  seu próprio schema) e → Firebase; Forge → Chainlink VRF; dApp → carteira/CoinGecko; Scripts Hardhat →
  RPC BSC e BSCScan.
- **Domínios**: substantivos recorrentes (NFT/catálogo, gacha/forge/VRF, staking/granja, marketplace,
  token BCKN, indicação/referral, contas/auth, carteira, i18n).

## Fase 2 — Decisões autônomas (sem perguntar)

| Decisão | Regra |
|---|---|
| Domínios | Substantivos recorrentes em `funcionalidades.md` de todos os projetos |
| Direção da comunicação | Se A.integracoes diz "consome B" → A → B |
| Criticidade | No caminho de compra (Frontend→ICO→Token) tudo é **crítico** |
| ADR | Decisão não-trivial que molda o sistema → vira ADR |
| Estilo arquitetural | Monorepo 4 camadas: contratos on-chain (Solidity) + indexador (Ponder/RW.BC.Indexer) + **backend de contas/read-model** (.NET/Aspire/Postgres/Firebase) + SPA Web3 (Angular/dApp). dApp→contratos (carteira), dApp→API (HTTP/JWT), Indexer→Postgres→API (read-model) |

## Fase 3 — Escrever

- `arquitetura/README.md`: índice (tabela dos 6 arquivos: README, visao-geral,
  catalogo-componentes, mapa-comunicacao, fluxos-de-dados, matriz-nomenclatura) + lista de domínios
  com link + resumo do stack (tabela: Frontend / Carteira & Web3 / Contratos /
  Rede / Serviços externos).
- `arquitetura/visao-geral.md`: `graph TB` com `subgraph` por camada (Usuário/
  Frontend / Web3 & Carteira / Contratos On-chain / Serviços externos) + setas
  das integrações + tabela de componentes + princípios + dependências críticas.
- `arquitetura/catalogo-componentes.md`: tabela única `| Componente | Tipo |
  Linguagem | Stack | Expõe | Depende de | Criticidade |` + "Fatos-chave" só se
  algo não-óbvio.
- `arquitetura/mapa-comunicacao.md`: matriz `| De → Para | Protocolo | Dados |
  Sincronia | Criticidade | Fonte |` + tabela de protocolos + `sequenceDiagram`
  do fluxo de compra (conectar carteira → calcular unidades → buy → comissão de
  indicação → confirmação).
- `arquitetura/fluxos-de-dados.md`: por fluxo, cabeçalho (disparo + síncrono/
  on-chain) + `flowchart LR` + passos numerados. Fluxos: (1) compra com
  indicação, (2) deploy/upgrade do contrato, (3) cotação BNB/USD via CoinGecko.
- `arquitetura/dominios/<dominio>.md`: responsabilidade + tabela de componentes
  + entidades/funções principais + integrações entre domínios + evidência
  (refs a `<projeto>/integracoes.md`, `<projeto>/contratos.md`).
- `adr/README.md`: tabela `| ID | Título | Status |`.
- `adr/000N-<slug>.md`: cabeçalho (Status) + Contexto (2 frases) + Decisão
  (1 frase) + Consequências (bullets) + Evidência. Slug em PT kebab-case sem
  acentos. ADRs típicos do BitChicken (descubra os reais lendo `docs/meta/adr/`):
  - pivô ICO → ecossistema NFT (BCKN + NFT + Forge/gacha + Staking + Marketplace);
  - gacha via Chainlink VRF (Forge imutável); venda avulsa removida (drop por ovo);
  - conta desacoplada da carteira + vínculo via SIWE; API .NET/Aspire/Postgres/Firebase;
  - read-model on-chain via Ponder (Model B); ABI mantida à mão (sem geração automática);
    indicação on-chain reformulada: recompensa em **BNB**, 1 nível, por rank (ADR 0009 substitui 0008).

## Fase 4 — Sincronizar índices internos

Antes de terminar:
1. `arquitetura/README.md` — a seção de domínios lista TODOS os arquivos em
   `dominios/`.
2. `adr/README.md` — a tabela lista TODOS os ADRs criados.

## Fase 5 — Relatório (stdout, PT-BR)

```
=== Extrair Ecossistema: bitchicken ===
Projetos lidos: N
Arquivos em docs/meta/:
   arquitetura/{README, visao-geral, catalogo-componentes,
                mapa-comunicacao, fluxos-de-dados, matriz-nomenclatura}.md
   arquitetura/dominios/<N arquivos>
   adr/{README, <N ADRs>}.md

Domínios: <lista>
Estilo: <inferido>
ADRs: N
Componentes críticos: <lista>
```
