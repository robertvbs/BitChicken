---
paths:
  - "docs/**"
---

# Regras de documentação — BitChicken

Convenções compartilhadas pelos 3 subagents do pipeline `/docs-refresh`
(`discover-projects`, `generate-docs`, `extract-ecosystem`). Carregado no
contexto de todos eles. Não duplicar este conteúdo dentro dos agentes.

## Idioma e estilo

- **Tudo em PT-BR.** Títulos, prosa, tabelas.
- Prefira **tabelas, bullets e diagramas Mermaid** a parágrafos longos.
- Cada arquivo `.md` ≤ ~200 linhas (exceto índices de API/contratos, que
  não têm teto).
- Documente **apenas o que existe no código** — nunca invente endpoints,
  funções de contrato, eventos ou variáveis de ambiente.
- Sempre que citar código, use referência `caminho:linha` (clicável).

## Diagramas Mermaid (parser quebra calado — siga à risca)

Os diagramas vivem em blocos ```mermaid dentro dos `.md` de `docs/meta/**`. Invariantes:

- **LF puro**, UTF-8 — **nunca CRLF** (o parser falha em silêncio). Valide com `file <arquivo>.md` →
  deve indicar `UTF-8 text` **sem** `CRLF line terminators`.
- **Sem HTML entities** (`&lt;`, `&gt;`, `&amp;`) — o parser rejeita ("no viable alternative at input").
- **Sem `<` ou `>` literais** em labels e em `participant X as ...`: use `App Backend` no lugar de
  `RW.BC.Api`, `Entity of T` no lugar de `Entity<T>`. `<br/>` é permitido **só** como quebra dentro de label `[...]`.
- **ASCII** em IDs de nodes/participants (acentos só no texto visível do label).

## Solução

- Nome da solução: **`bitchicken`**.
- Raiz: a raiz do repositório (`.`).
- Três projetos de produto (RW.BC.AppHost é tooling — não rende docs):
  - `RW.BC.Crypto/` → contratos Solidity/Hardhat NFT (token BCKN, NFT, forge/VRF, staking, marketplace).
  - `RW.BC.DApp/` → frontend Angular 22 (dApp: ovos/granja/marketplace/coleção + contas).
  - `RW.BC.Api/` → API de contas .NET 10 + Aspire + Postgres + Firebase (email/senha + vínculo de carteira SIWE).

## Destino da documentação

Tudo é escrito sob **`docs/`** na raiz do repo — **NUNCA** dentro de
`RW.BC.Crypto/docs/`, `RW.BC.DApp/docs/` ou `RW.BC.Api/docs/`.

```
docs/
├── index.md                    # índice geral (mantido pelo orquestrador)
├── RW.BC.Crypto/               # docs do projeto de contratos
├── RW.BC.DApp/                  # docs do projeto frontend
├── RW.BC.Api/                  # docs da API .NET (contas)
└── meta/                       # visão de ecossistema (extract-ecosystem)
    ├── arquitetura/
    └── adr/
```

## Nomes de arquivo canônicos (por projeto)

Use **sempre** estes nomes em PT-BR. **Proibido** usar tokens em inglês
(`features.md`, `gotchas.md`, `business-rules.md`, `integrations.md`,
`apis.md`, `stack` é aceito por ser universal) em paths ou nomes de arquivo.

| Arquivo | Conteúdo |
|---|---|
| `index.md` | Cabeçalho (tipo/linguagem/build) + propósito + seção "Documentação Disponível" linkando os demais |
| `stack.md` | Tabela `Camada / Tecnologia / Versão / Notas` + nota de arquitetura |
| `funcionalidades.md` | Por funcionalidade: Entrada / Arquivos / Comportamento / Regras |
| `regras-de-negocio.md` | Tabela `Regra / Localização / Impacto se violada` |
| `armadilhas.md` | Tabela `Sintoma / Causa / Correção` + seções por armadilha crítica |
| `integracoes.md` | Tabela `Serviço / Direção / Protocolo / Criticidade / Tratamento de falha` + seção por integração |
| `contratos.md` | **Só para `smart-contract`**: por contrato, tabela de funções (assinatura, visibilidade, acesso, efeito), eventos e erros customizados |

`index.md` **deve** ter uma seção "Documentação Disponível" com links
relativos para todos os outros arquivos do projeto — caso contrário viram
órfãos na auditoria.

Links sempre **relativos**, nunca absolutos.

## Auditoria (checklist manual)

Após o pipeline, valide:

1. Todo `docs/<projeto>/index.md` lista todos os `.md` irmãos em
   "Documentação Disponível".
2. `docs/index.md` lista os três projetos (Crypto/DApp/Api) e a seção meta.
3. `docs/meta/arquitetura/README.md` lista todos os arquivos de
   `dominios/`.
4. `docs/meta/adr/README.md` lista todos os ADRs criados.
5. Nenhum token proibido em nome de arquivo.
6. Nenhum link quebrado (paths relativos corretos).
