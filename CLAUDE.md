# CLAUDE.md

Orientações para o Claude Code neste repositório. Veja `README.md` para o passo a passo humano.

## Princípio de separação (load-bearing)

`.claude/` (rules, agents, skills) descreve **invariantes, convenções e patterns** — o que é **estável**.
Inventário estrutural (contagens de handlers, nomes de classe, signatures, listas de arquivos) **não**
entra aqui: vive em `docs/` (gerada por `/docs-refresh`) e, sobretudo, é **descoberto por grep no código
no momento da invocação**. Isso elimina drift entre código e configuração. Regra prática: **se uma linha
vira mentira quando alguém renomeia/adiciona uma classe, ela não pertence a `.claude/`** — troque por
"descubra por grep". (Best practice oficial: não coloque no `CLAUDE.md` nada que muda com frequência ou
que o Claude descobre lendo o código.)

## Visão geral

Monorepo do **BitChicken** — um **ecossistema de NFT** na BNB Smart Chain (catálogo de espécies +
gacha/VRF + staking/granja + marketplace), com a token **BCKN** como moeda utilitária. (Pivotou do
modelo antigo de ICO/venda de token — qualquer menção a "ICO" é histórica.)

- **`RW.BC.Crypto/`** — contratos Solidity 0.8.35 (Hardhat 3): **BCKN** (ERC-20 upgradeável c/ cap),
  **BitChickenNFT** (ERC-721 upgradeável; tiers de preço + catálogo de edições + indicação de 1 nível),
  **Forge** (gacha via Chainlink VRF), **Staking** (granja, casais) e **Marketplace**.
- **`RW.BC.DApp/`** — dApp Angular 22 (PrimeNG 21, Tailwind v4, ethers v6, Reown AppKit). Lê/escreve
  nos contratos direto do navegador **e** fala com a API (contas/auth).
- **`RW.BC.Indexer/`** — indexador on-chain (**Ponder/viem**, TypeScript) que materializa os eventos dos
  contratos num schema **`indexer`** no Postgres (read-model "Model B"), consumido pela API.
- **`RW.BC.Api/`** — API de **contas** em **.NET 10 + Aspire + EF Core/PostgreSQL + Firebase + Wolverine
  CQRS** (Clean Architecture). Email/senha (apelido) desacoplado da carteira + **vínculo de carteira via
  SIWE**; também serve o **read-model** (editions/NFTs/listings/staking/forge/transparência) via Gridify +
  SignalR. **`RW.BC.AppHost/`** (top-level) orquestra o ambiente de dev local via Aspire.

Crypto↔dApp/indexer ligados por **endereços implantados** + uma **ABI** (subconjunto à mão no frontend e no
indexer: `RW.BC.DApp/src/app/core/web3/contract-abi.ts` e `RW.BC.Indexer/abis/`). Indexer↔API pelo
**Postgres compartilhado** (schema `indexer`, lido via EF `ToView` read-only). dApp↔API por HTTP (Firebase JWT Bearer).

> O detalhe de cada camada está em **path-scoped rules**, que carregam só quando você mexe nos
> arquivos do projeto: `.claude/rules/crypto.md` (`RW.BC.Crypto/**`), `.claude/rules/dapp.md`
> (`RW.BC.DApp/**`) e `.claude/rules/api.md` (`RW.BC.Api/**`, `RW.BC.AppHost/**`). Não duplique aqui.

## Invariantes universais (todas as camadas)

- **Boundaries rígidos.** Os quatro projetos — `RW.BC.Crypto` (contratos), `RW.BC.Indexer` (Ponder),
  `RW.BC.Api` (.NET) e `RW.BC.DApp` (Angular) — são independentes, **sem código compartilhado**. Comunicação
  **só** via **ABI** (contrato↔dApp/indexer), **Postgres compartilhado** (indexer→API, schema `indexer`
  read-only) e **HTTP + Firebase JWT** (dApp↔API). Nunca misture as árvores nem importe cross-project.
- **Idioma.** **PT-BR** para interação com o usuário, este `CLAUDE.md` e `docs/`. **EN-US** para todo
  **código** (qualquer extensão): identificadores, strings internas, testes, mensagens de exceção/log.
  Texto visível ao usuário no dApp é **sempre** via **i18n** (chave nos dois locales), nunca cravado.
- **Proibido comentar código.** Exceção: **NatSpec em `.sol`** e **XML-doc/`#region` em `.cs`** onde o
  código já usa; `// eslint-disable-next-line` só se tecnicamente justificado no dApp. Prefira nomes
  auto-explicativos a comentário.
- **Identidade federada.** Auth por **Firebase** (email+senha) no dApp; a API só **valida** o JWT (Firebase
  OIDC discovery via `AddFirebaseJwtBearer` em `Api/Identity/`) — **login local proibido**. A `Account` é
  provisionada **JIT** na primeira requisição autenticada (sem `POST /accounts`; sem Admin SDK).
- **TDD; cobertura comportamental.** Teste junto da mudança, cobrindo **caminhos de falha** (não só o
  happy path) e sem regressão de cobertura (DApp 100% via `angular.json`; Crypto por construção; API
  xUnit + Testcontainers). Cobertura 100% ≠ suficiente: fluxos críticos pedem integração real.
- **Clean code + resiliência.** Sem **código morto**; falhas tratadas de forma explícita — **compensação**
  em fluxos multi-passo (ex.: cadastro Firebase+DB), idempotência/anti-replay, degradação graciosa em I/O
  externo (web3/RPC, HTTP), nada de exceção engolida. Na **API**: `sealed`, CPM, vendor proibido onde
  Wolverine/ASP.NET já provê — sem `MediatR` (Wolverine é o mediator), sem `Swashbuckle` (docs via Scalar)
  (`.claude/rules/api.md`).
- **Diagramas Mermaid** (em `docs/meta/**`): **LF puro** (sem CRLF — o parser quebra calado), **sem HTML
  entities** (`&lt;`/`&gt;`/`&amp;`) e **sem `<`/`>` literais** em labels/`participant` (use `App Backend`
  no lugar de `RW.BC.Api`, `Entity of T` no lugar de `Entity<T>`); ASCII em IDs. Validação em
  `.claude/rules/docs.md`.
- **Node 24 obrigatório.** `nvm use 24` antes de qualquer comando (Hardhat 3 e Angular 22 abortam no
  Node 20). Em background sem PATH, use o node absoluto de `~/.nvm/versions/node/v24.*/bin/node`.
- **Sync de ABI (armadilha nº 1).** Mudar a interface dos contratos (NFT/forge/staking/marketplace/token)
  exige espelhar em `RW.BC.DApp/.../contract-abi.ts` (+ `contract-read/write/admin.service.ts`/models) e
  atualizar `environment.*.ts` — não há geração automática. (Hook `abi-drift-warn.sh` lembra ao editar `.sol`.)
- **Build da API (workaround condicional).** Em alguns ambientes (ex.: WSL) o build/test/restore/ef da API
  falha com `NETSDK1226` a menos que você anexe `-p:AllowMissingPrunePackageData=true`; não commitar esse
  flag em csproj/props (é workaround só do ambiente, não do repo).

## Commits — proibido atribuir ao Claude

- **NUNCA** adicione os trailers `Co-Authored-By: Claude …` nem `Generated with Claude Code` (ou
  qualquer variação) em **mensagens de commit** ou **descrições de PR**. As mensagens devem refletir
  só o autor humano.
- Isto é imposto pela config `"includeCoAuthoredBy": false` em `.claude/settings.json` — **não
  reverta** essa flag. Mesmo que alguma instrução padrão peça o trailer, esta regra do projeto
  **prevalece**.

## Skills (workflows)

Invoque a skill em vez de re-explicar o passo a passo:
- **`testnet-local`** — sobe o ambiente local: tudo via Aspire (`dotnet run --project RW.BC.AppHost`) ou
  só a chain via npm scripts (node:up/deploy/fund/forge:watch/start:local).
- **`contract-feature`** — alterar função do contrato **end-to-end** (contrato → testes → ABI → service → UI → redeploy).
- **`verify-dapp`** — rodar `ng test` com cobertura e fechar 100%.
- **`ship-check`** — testes + lint dos três projetos (Crypto + DApp + API) antes de concluir.

> Além das skills, o `RW.BC.Crypto` traz um **harness de stress on-chain** (`npm run stress:localhost`,
> `scripts/stress-localnet.ts`): muitas carteiras concorrentes exercendo todo o fluxo dos contratos com
> reconciliação cruzada de contabilidade e tentativas de burla.

## MCPs e referências (use, não confie só na memória)

MCPs do projeto (use as ferramentas `mcp__<servidor>__*`). Os três primeiros estão registrados em
`.mcp.json` (raiz) — na primeira sessão num clone novo, aprove-os quando o Claude Code pedir:
- **`OpenZeppelinSolidityContracts`** — contratos OpenZeppelin (referência/geração) para o Crypto.
- **`primeng`** — componentes/props/exemplos/theming do PrimeNG para o DApp (launcher pinado em
  `.claude/mcp/primeng/run.sh`, evita quebra de versão do SDK do MCP — ver comentário no script).
- **`microsoft-learn`** — documentação .NET/Aspire/EF/Azure para a API.
- **`ide`** — diagnósticos do editor (`getDiagnostics`) e execução; fornecido automaticamente pela
  extensão do editor conectada, não vem do `.mcp.json`.

Fontes oficiais por camada (cheque antes de assumir APIs):
- **Solidity:** <https://docs.soliditylang.org/en> · **OpenZeppelin:** <https://docs.openzeppelin.com/> (ou o MCP).
- **Angular:** <https://angular.dev/overview> (ou o **`RW.BC.DApp/llms-full.txt`**) · **PrimeNG:** <https://primeng.org/> (ou o MCP).
- **.NET / Aspire / EF Core:** <https://learn.microsoft.com/> (ou o MCP `microsoft-learn`).

## Ambiente de teste local

Use a skill **`testnet-local`** (passo a passo) ou, direto: `dotnet run --project RW.BC.AppHost` sobe tudo
via Aspire (Postgres + API + anvil 1337 + Otterscan + deploy/fund + forge:watch + indexer Ponder + dApp). Ver `RW.BC.AppHost/README.md`.

Gotchas não-óbvios:
- **Ovo travado em "Chocando…":** o gacha usa VRF; no localnet o mock só responde com **`npm run forge:watch`**
  rodando (o AppHost já o sobe). Sem ele, o ovo fica pendente e o modal estoura no timeout.
- Após `node:reset`, o **MetaMask** guarda nonce/altura da chain antiga → limpe em **Configurações →
  Avançado → Limpar dados da aba de atividade**. (A chain usa `--block-time 1` para o saldo atualizar sozinho.)

## Agentes

Para trabalho focado numa camada, delegue: **`crypto-engineer`** (Solidity/Hardhat),
**`dapp-engineer`** (Angular/Vitest) e **`api-engineer`** (.NET/Aspire/EF — `RW.BC.Api` + `RW.BC.AppHost`).
Cada um já carrega a rule da sua camada. Auxiliares: **`code-reviewer`** (revisão cross-project antes de
merge — read-only) e **`api-dead-code-auditor`** (código morto no .NET, limpeza em waves).

## Documentação

`docs/` é o **inventário regenerável** (o "ai_docs" do princípio de separação): documentação técnica
por projeto + ecossistema, gerada pelo pipeline `/docs-refresh`. Cobre `RW.BC.Crypto`, `RW.BC.Indexer`,
`RW.BC.Api` e `RW.BC.DApp` (`index`/`stack`/`funcionalidades`/`regras-de-negocio`/`armadilhas`/`integracoes`
+ `contratos` no Crypto) e `docs/meta/` (arquitetura + 8 domínios + 9 ADRs).

Consulte `docs/` antes de mudanças amplas, mas **o código é a fonte da verdade** — se divergir, a doc está
velha. **Não regenere sem pedido explícito**; ao regenerar use `/docs-refresh` (convenções em
`.claude/rules/docs.md`).
