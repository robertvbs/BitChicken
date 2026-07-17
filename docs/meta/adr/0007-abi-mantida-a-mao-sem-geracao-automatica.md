# ADR 0007 — ABI mantida à mão (sem geração automática)

**Status:** Aceito

## Contexto

O dApp e o indexer precisam da ABI dos contratos para codificar chamadas e
decodificar eventos, mas os três projetos têm boundaries rígidos e não compartilham
código nem build.

## Decisão

Manter a ABI **à mão** em cada consumidor: um subconjunto em
`RW.BC.DApp/.../contract-abi.ts` e cópias completas em `RW.BC.Indexer/abis/*.ts`.
Não há geração automática a partir do `RW.BC.Crypto`.

## Consequências

- **Armadilha nº 1:** mudar a interface de qualquer contrato exige espelhar a ABI
  no dApp **e** no indexer, além de atualizar endereços nos `environment.*.ts` /
  config do Ponder ao reimplantar.
- Divergência de ABI causa erro de decodificação em runtime (indexer) ou revert
  silencioso (dApp). Há um hook `abi-drift-warn.sh` que lembra ao editar `.sol`.
- Mantém os projetos desacoplados (sem dependência de build cruzada), ao custo de
  disciplina manual de sincronização.

## Evidência

- `.claude/rules/crypto.md` e `dapp.md` (Sync de ABI — armadilha nº 1).
- `RW.BC.Indexer/integracoes.md` (Integração 5 — ABIs, sincronização manual).
