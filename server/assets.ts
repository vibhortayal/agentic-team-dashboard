// Files the board serves: the built page and the demo data.
// From source they come from disk; inside the one-file app they come from the app itself.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

interface Sea { isSea(): boolean; getAsset(key: string): ArrayBuffer }

function loadSea(): Sea | null {
  try {
    const sea = createRequire(import.meta.url)("node:sea") as Sea;
    return sea.isSea() ? sea : null;
  } catch {
    return null;
  }
}

const SEA = loadSea();
const HERE = dirname(fileURLToPath(import.meta.url));
// From source: server/ sits next to dist/. In the npm package the bundle sits in dist-server/.
const DIST = [join(HERE, "..", "dist")].find((d) => existsSync(join(d, "index.html"))) ?? join(HERE, "..", "dist");

export const insideApp = SEA !== null;

/** The built page's file at a URL path such as "/" or "/assets/x.js", or null if there is none. */
export function pageFile(urlPath: string): Buffer | null {
  const rel = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath).replace(/^\/+/, "");
  if (rel.split(/[\\/]/).includes("..")) return null;
  if (SEA) {
    try {
      return Buffer.from(SEA.getAsset(`dist/${rel}`));
    } catch {
      return null;
    }
  }
  const file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST + sep) || !existsSync(file)) return null;
  return readFileSync(file);
}

export function pageBuilt(): boolean {
  return pageFile("/") !== null;
}

export function demoData(): string {
  if (SEA) return Buffer.from(SEA.getAsset("demo.json")).toString("utf8");
  for (const p of [join(HERE, "demo.json"), join(HERE, "..", "server", "demo.json")]) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error("demo.json is missing");
}
