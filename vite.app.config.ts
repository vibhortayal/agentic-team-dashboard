import { defineConfig } from "vite";

// Bundles the board's small server into one CommonJS file, for the one-file app and the npm package.
// The lock for secrets (tweetnacl, @noble/hashes) goes inside the file too: the app carries no node_modules.
export default defineConfig({
  ssr: { noExternal: true },
  build: {
    ssr: "server/cli.ts",
    outDir: "dist-server",
    emptyOutDir: true,
    target: "node22",
    rollupOptions: { output: { format: "cjs", entryFileNames: "board.cjs" } },
  },
});
