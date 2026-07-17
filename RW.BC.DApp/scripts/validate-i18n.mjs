import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/i18n/", import.meta.url));
const locales = ["en-US", "pt-BR"];

function flatten(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...flatten(v, path));
    else keys.push(path);
  }
  return keys;
}

const sets = {};
for (const locale of locales) {
  const json = JSON.parse(readFileSync(`${dir}${locale}.json`, "utf-8"));
  sets[locale] = new Set(flatten(json));
}

const [a, b] = locales;
const onlyInA = [...sets[a]].filter((k) => !sets[b].has(k));
const onlyInB = [...sets[b]].filter((k) => !sets[a].has(k));

if (onlyInA.length === 0 && onlyInB.length === 0) {
  console.log(`i18n OK: ${sets[a].size} chaves sincronizadas entre ${a} e ${b}.`);
  process.exit(0);
}

console.error("i18n DESSINCRONIZADO:");
if (onlyInA.length) console.error(`  só em ${a} (${onlyInA.length}): ${onlyInA.join(", ")}`);
if (onlyInB.length) console.error(`  só em ${b} (${onlyInB.length}): ${onlyInB.join(", ")}`);
process.exit(1);
