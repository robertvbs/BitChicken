import { describe, it, expect } from "vitest";
import "../src/token";
import { getHandler } from "./stubs/registry";
import { FakeDb } from "./fake-db";
import { token_transfers } from "../ponder.schema";

const A = "0xaaaa000000000000000000000000000000000001";
const B = "0xbbbb000000000000000000000000000000000002";

describe("Token:Transfer", () => {
  it("inserts a normalized, immutable transfer row", async () => {
    const db = new FakeDb();
    const event = {
      args: { from: A.toUpperCase(), to: B.toUpperCase(), value: 1000n },
      block: { number: 50n },
      transaction: { hash: "0xtx" },
      log: { logIndex: 2 },
    };
    await getHandler("Token:Transfer")({ event, context: { db } });
    expect(db.rows(token_transfers)).toEqual([
      { id: "0xtx-2", from_addr: A, to_addr: B, value: 1000n, block_number: 50n },
    ]);
  });
});
