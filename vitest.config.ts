import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts", "layouts/**/*.test.ts"], testTimeout: 60000 },
});
