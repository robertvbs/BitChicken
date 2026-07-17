# Política de segurança

## Como reportar uma vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança no BitChicken (contratos, dApp, API ou indexer),
reporte de forma privada em vez de abrir uma issue pública:

- Preferencial: abra um [GitHub Security Advisory](https://github.com/robertvbs/BitChicken/security/advisories/new)
  neste repositório. Isso permite discutir e corrigir o problema antes de qualquer divulgação pública.
- Alternativa: abra uma issue comum pedindo contato privado, sem incluir detalhes do exploit.

Inclua, se possível:

- Descrição da vulnerabilidade e seu impacto potencial.
- Passos para reproduzir (endereço do contrato/hash da tx, payload da requisição, etc., conforme o caso).
- Componente afetado (`RW.BC.Crypto`, `RW.BC.DApp`, `RW.BC.Api`, `RW.BC.Indexer`, `RW.BC.AppHost`).

## Escopo

- **Contratos** (`RW.BC.Crypto`): reentrância, bypass de controle de acesso, colisão de storage em
  upgrade/proxy, manipulação do VRF, exploits econômicos/de inteiros.
- **API** (`RW.BC.Api`): bypass de autenticação/autorização, problemas na validação de assinatura SIWE,
  injeção, IDOR.
- **dApp** (`RW.BC.DApp`): XSS, prompts de assinatura inseguros, spoofing de transação web3.
- **Indexer** (`RW.BC.Indexer`): problemas de reconciliação de eventos/estado que possam distorcer a
  verdade on-chain no read-model.

## Versões suportadas

Este é um projeto em desenvolvimento ativo, ainda sem política formal de LTS. Correções de segurança são
aplicadas na branch `main`; não há branches de release mantidas no momento.

## Divulgação

Buscamos confirmar o recebimento em poucos dias e combinar com quem reportou um cronograma de correção e
divulgação antes de qualquer publicação.
