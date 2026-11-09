import { fileURLToPath } from "url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Same "@/*" → project root mapping as tsconfig.json.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // .claude/worktrees holds other sessions' checkouts (with their own node_modules).
    exclude: ["**/node_modules/**", ".next/**", "generated/**", ".claude/**"],
  },
})
