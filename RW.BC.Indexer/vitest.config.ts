import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "ponder:registry": fileURLToPath(new URL("./test/stubs/registry.ts", import.meta.url)),
      "ponder:schema": fileURLToPath(new URL("./ponder.schema.ts", import.meta.url)),
    },
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/api/**"],
      reporter: ["text", "html"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
