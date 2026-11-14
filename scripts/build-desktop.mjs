// Builds the board for the Mac app in desktop/: the page, and the server as one file the app loads.
//   cd desktop && npm run board     (the release workflow and `npm run dist` do this for you)
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = join(root, "desktop", "app");
process.chdir(root); // the page's config finds web/ from here

rmSync(join(out, "dist"), { recursive: true, force: true });
rmSync(join(out, "server"), { recursive: true, force: true });

await build({ configFile: join(root, "vite.config.ts"), logLevel: "warn" });
cpSync(join(root, "dist"), join(out, "dist"), { recursive: true });

// The server, with startBoard() exported. Same settings as vite.app.config.ts, different entry.
await build({
  configFile: false,
  logLevel: "warn",
  ssr: { noExternal: true },
  build: {
    ssr: join(root, "server", "main.ts"),
    outDir: join(out, "server"),
    emptyOutDir: true,
    target: "node22",
    rollupOptions: { output: { format: "cjs", entryFileNames: "board.cjs" } },
  },
});
mkdirSync(join(out, "server"), { recursive: true });
cpSync(join(root, "server", "demo.json"), join(out, "server", "demo.json"));
console.log("Built the board into desktop/app/");
