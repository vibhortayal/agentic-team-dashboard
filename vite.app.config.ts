import { defineConfig } from "vite";

// Bundles the board's small server into one CommonJS file, for the one-file app and the npm package.
export default defineConfig({
  build: {
    ssr: "server/cli.ts",
    outDir: "dist-server",
    emptyOutDir: true,
    target: "node22",
    rollupOptions: { output: { format: "cjs", entryFileNames: "board.cjs" } },
  },
});
