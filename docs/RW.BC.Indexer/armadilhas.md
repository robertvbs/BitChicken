# Armadilhas — RW.BC.Indexer

## Resumo

| Sintoma | Causa | Correcao |
|---|---|---|
| Indexador trava na inicializacao com erro de endereco invalido | `DEPLOYED_ADDRESSES_PATH` aponta para arquivo inexistente ou com valor `0x000...` no `.env.example` | Configurar env vars reais ou gerar o JSON com `deploy:testnet` no Crypto |
| Consulta por endereco nao retorna resultado | Endereco foi armazenado com case misto (EIP-55 checksum) em vez de lowercase | Sempre passar o endereco em lowercase nas queries; `normalizeAddress` garante isso nos handlers mas nao nas queries externas |
| Reindexacao falha com erro de chave primaria duplicada | Schema `indexer` tem dados da indexacao anterior sem `onConflictDoUpdate` em algum handler novo | Rodar `npm run start:fresh` (reset-schema + start) antes de reindexar |
| Dados de `editions` ficam zerados/incompletos apos `EditionRegistered` | Erro na chamada RPC `getEdition` (RPC indisponivel no bloco historico ou ABI desatualizada) | Verificar disponibilidade do RPC e que a ABI em `abis/BitChickenNFT.ts` bate com o contrato implantado |
| Listing aparece sem `edition_id` (nulo) | `Minted` nao foi indexado antes do `Listed` (ordem de eventos ou start block errado do NFT) | Verificar `NFT_START_BLOCK` <= bloco do primeiro mint; aguardar resync completo |
| NFT aparece com `burned=false` apos queima | ABI do contrato NFT nao emite `Transfer` para `0x0` (versao antiga) ou ABI desatualizada | Conferir que a ABI em `abis/BitChickenNFT.ts` reflete a versao implantada; redeployar se necessario |
| Campo `staked` do NFT diverge do estado real | Handler de staking nao encontrou o NFT pelo `token_id` (NFT nao indexado ainda) | Aguardar resync; conferir que `NFT_START_BLOCK` <= `STAKING_START_BLOCK` |
| Ponder nao processa eventos apos reset da chain local | Schema `ponder_sync` contem estado da chain anterior (altura/hashes invalidos) | Rodar `npm run start:fresh` ou `npm run reset-schema` antes de reiniciar |
| `start:fresh` nao dropa o schema correto | `DATABASE_SCHEMA` nao esta definido e o padrao `indexer` nao e o schema em uso | Definir `DATABASE_SCHEMA` no env antes de rodar o script |
| MetaMask/dApp mostra dados antigos apos reset | Ponder reindexou mas o SignalR/cache da API ainda serve o snapshot anterior | Reiniciar a `RW.BC.Api` para forcar reconexao ao Postgres e limpar cache do Gridify |
| Erro `Failed to read DEPLOYED_ADDRESSES_PATH` na inicializacao | Arquivo JSON nao existe no caminho especificado | Gerar o arquivo com o script de deploy ou usar as env vars individuais (`NFT_ADDRESS`, etc.) |
| `CHAIN_ID` errado conecta o Ponder ao RPC da rede errada | Variavel nao definida, usando padrao 1337 em testnet/mainnet | Sempre definir `CHAIN_ID` explicitamente em ambientes nao-locais |

---

## Armadilha Critica 1 — Drift de ABI entre Crypto e Indexer

**Sintoma:** handlers recebem `undefined` em campos de eventos ou chamadas `readContract` falham com
"function not found".

**Causa:** os arquivos em `abis/` sao copias manuais das ABIs geradas pelo Hardhat no projeto
`RW.BC.Crypto`. Nao ha sincronizacao automatica. Uma mudanca de assinatura nos contratos (adicao de
parametro em evento, renomeacao de funcao) nao e propagada automaticamente.

**Correcao:**
1. Apos qualquer mudanca em `RW.BC.Crypto/contracts/`, copiar os artefatos gerados para
   `RW.BC.Indexer/abis/` (cada arquivo TypeScript exporta a ABI tipada).
2. Rodar `npm run typecheck` no Indexer para detectar divergencias de tipo nos handlers.
3. Reindexar com `npm run start:fresh` se o schema de eventos mudou.

---

## Armadilha Critica 2 — Reset de Chain Local sem Reset de Schema

**Sintoma:** Ponder inicia mas nao processa nenhum evento novo; logs mostram altura de bloco ja
conhecida ou hashes invalidos.

**Causa:** o schema `ponder_sync` registra o progresso de sincronizacao por cadeia e contrato.
Quando a chain local e resetada (Anvil reiniciado), os blocos comecam do zero mas o Ponder
acredita ja ter processado ate uma altura maior.

**Correcao:** sempre rodar `npm run reset-schema` (ou `start:fresh`) apos qualquer reset da chain.
O AppHost do Aspire faz isso automaticamente via script de inicializacao.

---

## Armadilha Critica 3 — Start Blocks Incorretos em Producao

**Sintoma:** indexacao leva horas ou dias; ou eventos anteriores ao start block sao ignorados
permanentemente.

**Causa:** `resolveStartBlock` retorna 0 se a variavel de ambiente nao estiver definida. Em
mainnet/testnet, indexar desde o bloco 0 e proibitivo. Por outro lado, um start block maior que o
bloco de deploy do contrato perde eventos historicos.

**Correcao:** definir as vars `*_START_BLOCK` com o numero exato do bloco de deploy de cada
contrato. Esses valores estao disponiveis nos logs de deploy do `RW.BC.Crypto` (scripts
`deploy:testnet` / `deploy:mainnet`).

---

## Armadilha Critica 4 — Normalizacao de Endereco nas Queries Externas

**Sintoma:** a `RW.BC.Api` filtra por endereco e retorna lista vazia mesmo com dados no banco.

**Causa:** o Ponder normaliza todos os enderecos para lowercase antes de persistir
(`normalizeAddress`). Se a API receber o endereco em formato checksum (EIP-55, letras maiusculas)
e repassar diretamente ao Gridify/SQL, a comparacao falha pois `TEXT` no Postgres e case-sensitive.

**Correcao:** a `RW.BC.Api` deve normalizar (`.ToLowerInvariant()`) qualquer endereco recebido
antes de usá-lo em filtros de query contra o schema `indexer`.
