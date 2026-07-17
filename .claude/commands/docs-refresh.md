---
description: Regenera toda a documentação do BitChicken (pipeline discover → generate → extract)
allowed-tools: Agent, Bash(find:*), Bash(ls:*), Read, Glob, Grep, Write, Edit
argument-hint: "[--only=RW.BC.Crypto|RW.BC.DApp|RW.BC.Api|RW.BC.Indexer] [--dry-run] [--skip-extract]"
---

Orquestra a **regeneração completa** da documentação do BitChicken em `docs/`.
Estágios — **na ordem**, sem pular:

1. **Descoberta** (subagent `discover-projects`) — encontra os projetos lógicos
   do repo e retorna um JSON.
2. **Geração** (subagent `generate-docs`) — uma invocação por projeto retornado,
   escrevendo em `docs/<nome>/`. Rode os projetos **em paralelo** (uma mensagem
   com múltiplos blocos Agent).
3. **Extração de ecossistema** (subagent `extract-ecosystem`) — só depois que
   TODOS os generate concluírem. Escreve em `docs/meta/arquitetura/` e
   `docs/meta/adr/`.
4. **Sincronização do índice raiz** (você, no fio principal) — atualize/crie
   `docs/index.md`.
5. **Auditoria** — apenas mencione no relatório final que o usuário pode rodar a
   checklist em `.claude/rules/docs.md` (seção "Auditoria"). Não audite sozinho.

As convenções (idioma, nomes de arquivo, destino) vivem em
`.claude/rules/docs.md` e são aplicadas pelos 3 subagents.

## Argumentos

`$ARGUMENTS` aceita:

- vazio → pipeline completo, todos os projetos.
- `--only=RW.BC.Crypto` (ou `RW.BC.DApp`/`RW.BC.Api`/`RW.BC.Indexer`) → roda generate só para esse
  projeto (discover ainda roda completo; extract ainda lê todos).
- `--skip-extract` → para na fase 3 sem rodar o extract.
- `--dry-run` → só roda discover e imprime o JSON; nenhuma escrita.

## Execução

### Passo 1 — Descoberta

Invoque o subagent `discover-projects` (retorna JSON). Capture a saída e parseie
a lista de projetos. Se `--dry-run`, imprima o JSON e pare.

### Passo 2 — Geração (paralela)

Filtre por `--only=` se fornecido. Para cada projeto, dispare um subagent
`generate-docs` passando os 4 campos (`name`, `path`, `type`,
`primary_language`). Dispare todos **em paralelo** (uma única mensagem com um
bloco Agent por projeto). Aguarde todos retornarem antes do passo 3.

### Passo 3 — Extração de ecossistema

Se `--skip-extract` → pule. Senão invoque `extract-ecosystem` — ele lê tudo de
`docs/RW.BC.Crypto/`, `docs/RW.BC.DApp/`, `docs/RW.BC.Api/` e `docs/RW.BC.Indexer/` automaticamente.

### Passo 4 — Índice raiz

Os subagents NÃO tocam `docs/index.md`. Garanta que ele exista e liste:
- os projetos (Crypto/DApp/Api/Indexer) com link `<nome>/index.md` e 1 frase de propósito;
- a seção meta com link para `meta/arquitetura/README.md` e `meta/adr/README.md`.

Edits cirúrgicos via Edit/Read se já existir; crie do zero se não existir.

### Passo 5 — Auditoria (manual)

Reporte:

```
✅ Pipeline concluído.
Para validar, siga a checklist em .claude/rules/docs.md (seção "Auditoria").
```

## Saída final (PT-BR)

```
=== /docs-refresh ===
Projetos descobertos:    <lista>
Projetos regenerados:    <lista filtrada>
Arquivos por projeto:    index, stack, funcionalidades, regras-de-negocio,
                         armadilhas, integracoes [, contratos]
Ecossistema:             arquitetura/ (6 arquivos) + dominios/ (N) + adr/ (N)
Índice raiz:             <criado | atualizado | inalterado>

Próximo passo: auditoria via .claude/rules/docs.md (seção "Auditoria")
```

## Erros e ordem (importante)

- **Discover falhou** (JSON inválido/vazio) → pare; reporte; não rode os
  próximos estágios.
- **Algum generate falhou** → rode os que sucederam, mas **não rode extract**
  (ele depende de docs consistentes). Reporte os falhos.
- **Extract falhou** → mantém o estado parcial; reporte.
- Nunca rode extract antes de TODOS os generate concluírem.
