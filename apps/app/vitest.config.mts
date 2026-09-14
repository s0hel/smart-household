import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json. Route handlers import
    // through it, so tests that exercise them need it resolved too.
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
