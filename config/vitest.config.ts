import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The config file lives under `config/` but we want Vitest to resolve
// `include` and coverage paths from the repo root.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  test: {
    root: repoRoot,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/bin.ts"],
    },
  },
});
