// Verifica drift entre o subconjunto de ABI mantido a mao no dApp
// (src/app/core/web3/contract-abi.ts) e a ABI canonica compilada dos contratos
// (RW.BC.Crypto/artifacts). Para cada funcao/erro o check compara o selector de
// 4 bytes; para cada evento, o topic0 (keccak da assinatura canonica). Se uma
// entrada do dApp nao existir no contrato com selector/topic identico, e drift:
// o ethers nao conseguiria codificar a chamada nem decodificar o evento/erro em
// runtime. Converte a "armadilha no 1" (falha silenciosa em producao) numa falha
// barulhenta de build/CI. Nao acopla as arvores: apenas LE os dois lados.
//
// Pre-requisito: artefatos frescos. Rode antes, em RW.BC.Crypto: `npm run compile`.
// Uso: node scripts/check-abi-drift.mjs   (ou `npm run check:abi-drift`)

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Fragment, Interface } from 'ethers';

const here = dirname(fileURLToPath(import.meta.url));
const ABI_TS = resolve(here, '../src/app/core/web3/contract-abi.ts');
const ARTIFACTS = resolve(here, '../../RW.BC.Crypto/artifacts/contracts');

const MAP = [
  { name: 'TOKEN_ABI', artifact: 'bitchicken-token.sol/BitChickenToken.json' },
  { name: 'NFT_ABI', artifact: 'bitchicken-nft.sol/BitChickenNFT.json' },
  { name: 'STAKING_ABI', artifact: 'bitchicken-staking.sol/BitChickenStaking.json' },
  { name: 'MARKETPLACE_ABI', artifact: 'bitchicken-marketplace.sol/BitChickenMarketplace.json' },
  { name: 'FORGE_ABI', artifact: 'bitchicken-forge.sol/BitChickenForge.json' },
];

function extractFragments(src, constName) {
  const re = new RegExp(`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const;`);
  const block = src.match(re);
  if (!block) throw new Error(`bloco "${constName}" nao encontrado em contract-abi.ts`);
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function fragmentId(fragStr) {
  const f = Fragment.from(fragStr);
  if (f.type === 'function') return { kind: 'function', id: f.selector };
  if (f.type === 'error') return { kind: 'error', id: f.selector };
  if (f.type === 'event') return { kind: 'event', id: f.topicHash };
  return null;
}

function contractIds(abiJson) {
  const iface = new Interface(abiJson);
  const fns = new Set();
  const errs = new Set();
  const evs = new Set();
  for (const f of iface.fragments) {
    if (f.type === 'function') fns.add(f.selector);
    else if (f.type === 'error') errs.add(f.selector);
    else if (f.type === 'event') evs.add(f.topicHash);
  }
  return { function: fns, error: errs, event: evs };
}

const src = readFileSync(ABI_TS, 'utf8');
let checked = 0;
const drifts = [];

for (const { name, artifact } of MAP) {
  const path = resolve(ARTIFACTS, artifact);
  if (!existsSync(path)) {
    console.error(`FATAL: artefato ausente ${artifact}. Rode 'npm run compile' em RW.BC.Crypto.`);
    process.exit(2);
  }
  const ids = contractIds(JSON.parse(readFileSync(path, 'utf8')).abi);
  for (const fragStr of extractFragments(src, name)) {
    let info;
    try {
      info = fragmentId(fragStr);
    } catch (err) {
      drifts.push(`[${name}] ILEGIVEL: "${fragStr}" (${err.message})`);
      continue;
    }
    if (!info) continue;
    checked++;
    if (!ids[info.kind].has(info.id)) {
      drifts.push(`[${name}] DRIFT: ${info.kind} "${fragStr}" (selector/topic ${info.id}) nao existe em ${artifact}`);
    }
  }
}

if (drifts.length > 0) {
  console.error(`\nABI DRIFT detectado (${drifts.length}):`);
  for (const d of drifts) console.error(`  - ${d}`);
  console.error(`\nSincronize contract-abi.ts com a interface dos contratos (ou recompile RW.BC.Crypto).`);
  process.exit(1);
}

console.log(`ABI em sincronia: ${checked} fragmentos verificados em ${MAP.length} contratos.`);
process.exit(0);
