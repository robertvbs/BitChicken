# Segurança — RW.BC.Crypto

Análise estática com **Slither 0.11.5** (imagem `trailofbits/eth-security-toolbox`).
Resultado após Onda 2: **0 findings ativos**.

## Fixes aplicados em código (Onda 2)

| # | Detector | Contrato / Local | Ação |
|---|----------|-----------------|------|
| 1 | `immutable-states` | `bitchicken-forge.sol` L71 — `IBitChickenNFT public nft` | Declarado `immutable`. Definido uma única vez no construtor; nenhuma função o reatribui. Reduz custo de SLOAD para PUSH32. |
| 2 | `reentrancy-events` | `bitchicken-forge.sol` — `claimRefund`, `claimReferralBnb`, `withdraw` | Eventos (`RefundClaimed`, `ReferralBnbClaimed`, `Withdrawn`) movidos para **antes** da chamada externa `call{value:}`. CEI-para-eventos aplicado; todas as funções já estavam protegidas por `nonReentrant` / `onlyOwner`. |
| 3 | `reentrancy-events` | `bitchicken-nft.sol` — `withdraw` | Evento `Withdrawn` movido para antes da chamada externa. Mesmo padrão CEI-para-eventos. |
| 4 | `arbitrary-send-eth` | `bitchicken-marketplace.sol` — `obtain()` L355 | **Falso positivo documentado:** supressão por linha (`slither-disable-next-line arbitrary-send-eth`). `obtain` é `nonReentrant`, segue CEI (`delete $.listings` antes de qualquer call), e `royaltyReceiver` é o endereço retornado por `nft.royaltyInfo` (configurado pelo owner via EIP-2981) — não é controlado pelo atacante. O detector permanece ativo para detectar futuros `arbitrary-send-eth` reais em outros locais. |

### Por que `reentrancy-events` em `fulfillRandomWords` e `requestObtain` não foram movidos

Em `requestObtain`, o `requestId` é o valor **retornado pela call** a `s_vrfCoordinator.requestRandomWords` — é impossível emitir `ForgeRequested(requestId)` antes de tê-lo.

Em `fulfillRandomWords`, `tokenId` e `editionId` vêm do retorno de `nft.forgeMint`, e `referrer`/`reward` são derivados do mesmo resultado — todos os eventos (`ForgeFulfilled`, `ReferralBnbAccrued`) dependem genuinamente dos dados pós-call. Esses sites são cobertos pela exclusão global de `reentrancy-events` (veja abaixo), mas o risco é mitigado pelo fato de que `fulfillRandomWords` só pode ser chamado pelo VRF coordinator (herdado de `VRFConsumerBaseV2Plus`).

## Supressões via `slither.config.json` (`detectors_to_exclude`)

### `assembly` ×7
Todos os 7 usos são o padrão `assembly { $.slot := SLOT }` de leitura do slot ERC-7201 — idioma padrão do OpenZeppelin para armazenamento com namespace em contratos upgradeáveis. Não há alternativa sem assembly para este padrão. Não removível.

### `naming-convention`
`__gap`, `__CatalogManagement_init`, `__MintTierManagement_init`, `__ReferralTreeManagement_init` e o struct `$` do ERC-7201 seguem convenções do OpenZeppelin Upgradeable. O prefixo `__` sinaliza funções internas de inicializador por design; `$` é a variável de ponteiro de storage — ambos são padrões estabelecidos pelo OZ, não erros de nomenclatura.

### `low-level-calls` ×7
Todos os `.call{value:}` são o padrão **correto** de encaminhar BNB nativo (refunds de comprador, pagamentos de royalty, repasses de seller/taxa). `transfer()` e `send()` foram depreciados (2300 gas fixo não é compatível com contratos receptores modernos). Cada site verifica o bool retornado e reverte com erro customizado em caso de falha — tratamento explícito e correto.

### `timestamp` ×6
Os ciclos de staking (7 dias) e as janelas de mint de edição (`mintStart`/`mintEnd`) são inerentemente dependentes de tempo. `block.timestamp` é a fonte de tempo canônica em EVM. A manipulação de timestamp por mineradores é ≤ ~15 segundos no BNB Chain — irrelevante para ciclos de 168h. Design intencional, não bug.

### `divide-before-multiply` ×4
O staking primeiro faz `floor(elapsed / CYCLE)` para obter o número de **ciclos inteiros** e depois multiplica pela recompensa por ciclo. O floor é **intencional**: não se quer recompensar frações de ciclo. A mesma lógica aplica-se a `pendingOf`. Em `_rewardPerCycle`, a divisão por `SCALE` define a precisão — não há perda de precisão relevante pois `baseRate` é dimensionado em unidades de 1e18.

### `calls-loop` ×3
`_rewardPerCycle` chama `nft.attributesOf` (2 calls por par) dentro de `claimRange`. Os pares são **por usuário** (cada staker tem sua própria `EnumerableSet`), e `claimRange` aceita `(start, count)` — o chamador pagina. Não há loop irrestrito sobre todos os pares do contrato. Risco de DoS controlado por design.

### `reentrancy-benign` ×2
Dois sites em `BitChickenForge` (dentro de `fulfillRandomWords` e `requestObtain`) escrevem estado após calls externas, mas:
- `fulfillRandomWords` só pode ser chamado pelo VRF coordinator (herdado de `VRFConsumerBaseV2Plus`).
- `requestObtain` escreve o mapping `requests[requestId]` após obter o `requestId` do coordinator — necessário por design.

O próprio Slither os classifica como "benign" (não como `reentrancy` de risco). Sem vetor de exploração.

### `reentrancy-events` (global exclusão)
Os sites que **não puderam ser reordenados** (porque os dados do evento dependem do resultado da call externa) estão em `fulfillRandomWords` e `requestObtain` — detalhados na seção "Fixes" acima. Os sites que **puderam** ser reordenados já foram corrigidos em código (Fix #2 e #3). A exclusão global cobre o residual inevitável.

### `cyclomatic-complexity`
`BitChickenMarketplace.obtain` tem complexidade ciclomática 14 (acima do limiar de 11 do Slither). A função lida com: validação de listing, verificação de ownership, verificação de aprovação, cálculo e guarda de fee + royalty, transferência de NFT, 4 pagamentos BNB distintos (taxa, royalty, seller, excesso), e refund de excesso — tudo em sequência linear. Dividir em funções menores obscureceria o fluxo de invariantes de accounting (soma de fees ≤ price). Complexidade estrutural aceita.

### `missing-inheritance`
Slither detecta que `BitChickenNFT` implementa todas as funções de `IBitChickenNFT` mas não a declara na herança. Ao tentar adicionar `is IBitChickenNFT`, o compilador Solidity 0.8.35 exige `override` explícito em `transferFrom`, `safeTransferFrom`, `tierPrice`, `tierHasAvailable` e `royaltyInfo` (herança múltipla com diamond-problem). Essas funções já são implementadas pelas bases `ERC721Upgradeable`, `ERC721RoyaltyUpgradeable`, `MintTierManagement` e `CatalogManagement`. Adicionar os overrides introduziria repetição de código sem benefício funcional e aumentaria o risco de divergência de visibilidade. A conformidade com a interface é verificada nos testes de integração (Forge, Staking, Marketplace usam `IBitChickenNFT` para chamar a instância real).

### `incorrect-equality`
`cycles == 0` em `_claimInternal` e `pendingOf` é uma guarda de existência/zero válida: verifica se menos de um ciclo completo passou. Não há risco de bypass — `cycles` é calculado como `elapsed / CYCLE` (inteiro), portanto só pode ser zero se `elapsed < CYCLE`. Não é uma comparação de balanço ou timestamp que pudesse ser manipulada para atravessar a igualdade.

### `unused-return`
Três categorias:
1. `$.ownerPairs[msg.sender].add(pairId)` e `.remove(pairId)` — `EnumerableSet` retorna `bool` indicando se o elemento estava ausente/presente. Aqui o pairId é gerado internamente (sempre novo no `add`) e só removido no `unstakePair` (sempre presente). O bool é genuinamente irrelevante.
2. `(editionM, gM, _) = $.nft.tokenData(maleId)` — o terceiro retorno é o nome do token, não usado em staking. Ignorar via `_` é o padrão idiomático Solidity.
3. `(h1, s1, m1, _) = nft.attributesOf(...)` — o quarto retorno é `genderBit`, verificado separadamente via `tokenData`. Ignorar é intencional.
