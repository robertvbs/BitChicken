import * as schema from "../ponder.schema";

const PK: Record<string, string> = {
  listings: "token_id",
  nfts: "token_id",
  referral_registrations: "referrer",
  referral_links: "buyer",
  referral_bnb_accruals: "id",
  referral_bnb_claims: "id",
  sales: "id",
  swaps: "swap_id",
  token_transfers: "id",
  forge_requests: "request_id",
  staking_pairs: "pair_id",
  editions: "edition_id",
};

type Row = Record<string, unknown>;
interface Meta {
  name: string;
  pk: string;
}

const META = new Map<unknown, Meta>();
for (const [name, table] of Object.entries(schema)) {
  if (PK[name]) META.set(table, { name, pk: PK[name] });
}

export class FakeDb {
  readonly store = new Map<string, Map<string, Row>>();

  private meta(table: unknown): Meta {
    const m = META.get(table);
    if (!m) throw new Error("FakeDb: unknown table object");
    return m;
  }

  private bucket(name: string): Map<string, Row> {
    let b = this.store.get(name);
    if (!b) {
      b = new Map();
      this.store.set(name, b);
    }
    return b;
  }

  rows(table: unknown): Row[] {
    return [...this.bucket(this.meta(table).name).values()];
  }

  insert(table: unknown) {
    const { name, pk } = this.meta(table);
    const bucket = this.bucket(name);
    return {
      values: (obj: Row) => {
        const key = String(obj[pk]);
        return {
          onConflictDoUpdate: (fn: (existing: Row) => Row) => {
            const existing = bucket.get(key);
            if (existing) bucket.set(key, { ...existing, ...fn(existing) });
            else bucket.set(key, { ...obj });
            return Promise.resolve();
          },
          then: (resolve: (v?: unknown) => unknown, reject?: (e: unknown) => unknown) => {
            bucket.set(key, { ...obj });
            return Promise.resolve().then(resolve, reject);
          },
        };
      },
    };
  }

  update(table: unknown, key: Row) {
    const { name, pk } = this.meta(table);
    const bucket = this.bucket(name);
    const k = String(key[pk]);
    return {
      set: (objOrFn: Row | ((existing: Row) => Row)) => {
        const existing = bucket.get(k);
        if (existing) {
          const updates = typeof objOrFn === "function" ? objOrFn(existing) : objOrFn;
          bucket.set(k, { ...existing, ...updates });
        }
        return Promise.resolve();
      },
    };
  }

  find(table: unknown, key: Row): Promise<Row | null> {
    const { name, pk } = this.meta(table);
    return Promise.resolve(this.bucket(name).get(String(key[pk])) ?? null);
  }
}
