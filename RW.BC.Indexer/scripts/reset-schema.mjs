import { existsSync, readFileSync } from "node:fs";
import { Client } from "pg";

import { resolveConnectionString } from "./lib/connection.mjs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
}

const connectionString = resolveConnectionString();
if (!connectionString) {
  throw new Error("No ConnectionStrings__bitchicken or DATABASE_URL available.");
}

const schema = process.env.DATABASE_SCHEMA ?? "indexer";
const client = new Client({ connectionString });

await client.connect();
await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
await client.query("DROP SCHEMA IF EXISTS ponder_sync CASCADE");
await client.end();

console.log(`[reset-schema] dropped "${schema}" + ponder_sync (ephemeral dev chain)`);
