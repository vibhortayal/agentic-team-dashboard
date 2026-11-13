import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The page is built into dist/, which the board's small server hands to the browser.
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  test: { root: ".", include: ["server/**/*.test.ts"] },
});
