// The progress board: a page on your own computer that shows where your project stands.
//
//   npm start        read this folder's GitHub project
//   npm run demo     sample data, no sign-in needed
//
// It only reads GitHub and only listens on this computer (127.0.0.1).

import { execFile } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CantRead, findToken, readProject, repoFromGit } from "./github.ts";
import { buildBoard, errorBoard, type Board, type GhComment, type GhItem } from "./model.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");
const CACHE_MS = 60_000; // read GitHub at most once a minute
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

function now(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

/** Where board data comes from, with a one-minute cache so GitHub is read gently. */
export class Source {
  private at = 0;
  private board: Board | null = null;
  private pending: Promise<Board> | null = null;
  private readonly repo: string;
  private readonly demo: boolean;
  private readonly clock: () => number;
  constructor(repo: string, demo: boolean, clock: () => number = Date.now) {
    this.repo = repo;
    this.demo = demo;
    this.clock = clock;
  }

  async get(): Promise<Board> {
    if (this.board && this.clock() - this.at <= CACHE_MS) return this.board;
    // One read at a time, even if several requests arrive together.
    this.pending ??= this.read().then((b) => {
      this.board = b;
      this.at = this.clock();
      this.pending = null;
      return b;
    });
    return this.pending;
  }

  private async read(): Promise<Board> {
    if (this.demo) {
      const data = JSON.parse(readFileSync(join(HERE, "demo.json"), "utf8")) as {
        repo: string; items: GhItem[]; comments: Record<string, GhComment[]>;
      };
      const comments = new Map(Object.entries(data.comments).map(([k, v]) => [Number(k), v]));
      return buildBoard(data.repo, data.items, comments, now());
    }
    if (!this.repo) return errorBoard("", now(), "The board doesn't know which project to show. Start it from your project's folder.");
    try {
      const { items, comments } = await readProject(this.repo, findToken());
      return buildBoard(this.repo, items, comments, now());
    } catch (e) {
      const msg = e instanceof CantRead ? e.message : "The board couldn't read your project just now. It will try again soon.";
      return errorBoard(this.repo, now(), msg);
    }
  }
}

export function makeServer(source: Source, port: number): Server {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return createServer(async (req, res) => {
    const send = (code: number, body: string | Buffer, type: string) => {
      res.writeHead(code, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:",
      });
      res.end(body);
    };
    // Only answer pages opened on this computer by name, so other websites can't read it.
    if (!allowedHosts.has(req.headers.host ?? "")) return send(403, "Forbidden", "text/plain");
    if (req.method !== "GET") return send(405, "Not allowed", "text/plain");
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/api/board") return send(200, JSON.stringify(await source.get()), "application/json");
    const file = normalize(join(DIST, path === "/" ? "index.html" : decodeURIComponent(path)));
    if (!file.startsWith(DIST + sep) || !existsSync(file) || !TYPES[extname(file)]) return send(404, "Not found", "text/plain");
    return send(200, readFileSync(file), TYPES[extname(file)]);
  });
}

function openBrowser(url: string): void {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  execFile(cmd, args, () => { /* if it can't open, the address is printed anyway */ });
}

async function listen(source: Source, first: number): Promise<number> {
  for (let p = first; p < first + 10; p++) {
    const server = makeServer(source, p);
    const ok = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(p, "127.0.0.1", () => resolve(true));
    });
    if (ok) return p;
  }
  throw new Error(`Ports ${first} to ${first + 9} are all busy. Close another copy of the board and try again.`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      repo: { type: "string" }, demo: { type: "boolean", default: false },
      port: { type: "string", default: "4321" }, "no-open": { type: "boolean", default: false },
    },
  });
  if (!existsSync(join(DIST, "index.html"))) {
    console.error("The page isn't built yet. Run: npm start  (or npm run demo)");
    process.exit(1);
  }
  const repo = values.repo ?? (values.demo ? "" : repoFromGit() ?? "");
  const port = await listen(new Source(repo, values.demo), Number(values.port));
  const url = `http://localhost:${port}`;
  console.log(`Your progress board is open at ${url}  (press Ctrl+C to stop it)`);
  if (!values["no-open"]) openBrowser(url);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
