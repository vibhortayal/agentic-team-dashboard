#!/usr/bin/env node
// Starts the progress board. Used by `npm start`, the npx command and the one-file app.
import { main } from "./main.ts";

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
