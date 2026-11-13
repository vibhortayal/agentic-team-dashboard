import { fileURLToPath } from "node:url";
// The progress board: a page on your own computer that shows where your project stands.
// It only listens on this computer (127.0.0.1). It reads GitHub, and writes only a setting the
// person saves on the Settings page (settings.ts).

import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { demoData, insideApp, pageBuilt, pageFile } from "./assets.ts";
import { clientId, installUrl, pollSignIn, refresh, startSignIn } from "./auth.ts";
import * as config from "./config.ts";
import { CantRead, findToken, listProjects, readApp, readProject, REPO_NAME, repoFromGit } from "./github.ts";
import { DEMO_SETTINGS, readSettings, saveSetting, SaveRefused } from "./settings.ts";
import { buildBoard, errorBoard, NO_APP_DATA, type AppData, type Board, type GhComment, type GhItem } from "./model.ts";

const CACHE_MS = 60_000; // read GitHub at most once a minute
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

function now(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

/** Who is signed in and which project to show, from the saved file, then the computer's own sign-in. */
export class Session {
  readonly demo: boolean;
  readonly dir: string;
  private readonly startRepo: string;
  private readonly folderRepo: string;
  private readonly envToken: () => string | null;
  constructor(opts: { demo?: boolean; repo?: string; folderRepo?: string; dir?: string; envToken?: () => string | null } = {}) {
    this.demo = !!opts.demo;
    this.dir = opts.dir ?? config.configDir();
    this.startRepo = opts.repo ?? "";
    this.folderRepo = opts.folderRepo ?? "";
    this.envToken = opts.envToken ?? findToken;
  }

  /** --repo wins, then the project the person picked, then the project folder the board started in. */
  repo(): string {
    return this.startRepo || config.load(this.dir).repo || this.folderRepo || "";
  }

  savedSignIn(): boolean {
    return !!config.load(this.dir).token;
  }

  /** A working key, refreshed if the saved one has run out. */
  async token(): Promise<string | null> {
    const saved = config.load(this.dir);
    if (saved.token) {
      const id = clientId();
      if (saved.expires_at && saved.expires_at - 60_000 < Date.now() && saved.refresh_token && id) {
        const fresh = await refresh(id, saved.refresh_token).catch(() => null);
        if (fresh) {
          config.save({ token: fresh.token, refresh_token: fresh.refresh_token, expires_at: fresh.expires_at }, this.dir);
          return fresh.token;
        }
      }
      return saved.token;
    }
    return this.envToken();
  }
}

/** Board data with a one-minute cache, so GitHub is read gently. */
export class Source {
  private at = 0;
  private key = "";
  private board: Board | null = null;
  private pending: Promise<Board> | null = null;
  readonly session: Session;
  private readonly clock: () => number;
  constructor(session: Session, clock: () => number = Date.now) {
    this.session = session;
    this.clock = clock;
  }

  /** Forget the cached board, after a sign-in or a new project. */
  reset(): void {
    this.board = null;
  }

  async get(): Promise<Board> {
    const key = this.session.repo();
    if (this.board && key === this.key && this.clock() - this.at <= CACHE_MS) return this.board;
    // One read at a time, even if several requests arrive together.
    this.pending ??= this.read().then((b) => {
      this.board = b;
      this.key = key;
      this.at = this.clock();
      this.pending = null;
      return b;
    });
    return this.pending;
  }

  private async read(): Promise<Board> {
    if (this.session.demo) {
      const data = JSON.parse(demoData()) as { repo: string; items: GhItem[]; comments: Record<string, GhComment[]>; app?: AppData };
      const comments = new Map(Object.entries(data.comments).map(([k, v]) => [Number(k), v]));
      return buildBoard(data.repo, data.items, comments, now(), null, data.app ?? NO_APP_DATA);
    }
    const repo = this.session.repo();
    if (!repo) return errorBoard("", now(), "Pick which project to show.");
    try {
      const token = await this.session.token();
      const { items, comments } = await readProject(repo, token);
      const openPulls = items.filter((i) => i.pull_request !== undefined && i.state === "open");
      const waiting = openPulls.filter((i) => (i.labels ?? []).some((l) => (typeof l === "string" ? l : l.name) === "needs-human")).map((i) => i.number);
      const app = await readApp(repo, token, openPulls.length, waiting);
      return buildBoard(repo, items, comments, now(), null, app);
    } catch (e) {
      const msg = e instanceof CantRead ? e.message : "The board couldn't read your project just now. It will try again soon.";
      return errorBoard(repo, now(), msg);
    }
  }
}

interface Pending { device_code: string; interval: number; until: number; next: number }

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new Error("too big");
  }
  const data: unknown = body ? JSON.parse(body) : {};
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export function makeServer(source: Source, port: number, onStop: () => void = () => {}): Server {
  const session = source.session;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  let signIn: Pending | null = null;

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
    const json = (code: number, data: unknown) => send(code, JSON.stringify(data), "application/json");

    // Only answer pages opened on this computer by name, so other websites can't read it.
    const host = req.headers.host ?? "";
    if (!allowedHosts.has(host)) return send(403, "Forbidden", "text/plain");
    const path = (req.url ?? "/").split("?")[0];

    if (req.method === "POST") {
      // Changes only from the board's own page: same origin and a JSON body, which other sites can't send.
      if (req.headers.origin !== `http://${host}` || !(req.headers["content-type"] ?? "").startsWith("application/json")) {
        return send(403, "Forbidden", "text/plain");
      }
      let body: Record<string, unknown>;
      try {
        body = await readJson(req);
      } catch {
        return json(400, { error: "That request didn't make sense." });
      }
      if (session.demo && path !== "/api/stop") return json(400, { error: "The demo can't sign in, change project or save settings." });

      if (path === "/api/signin/start") {
        const id = clientId();
        if (!id) return json(400, { error: "This copy of the board can't sign in to GitHub yet." });
        try {
          const d = await startSignIn(id);
          signIn = { device_code: d.device_code, interval: d.interval * 1000, until: Date.now() + d.expires_in * 1000, next: 0 };
          return json(200, { user_code: d.user_code, verification_uri: d.verification_uri });
        } catch (e) {
          return json(502, { error: e instanceof Error ? e.message : "GitHub didn't start the sign-in." });
        }
      }
      if (path === "/api/signin/poll") {
        const id = clientId();
        if (!id || !signIn) return json(400, { state: "error", message: "Start the sign-in first." });
        if (Date.now() > signIn.until) {
          signIn = null;
          return json(200, { state: "expired", message: "The code ran out of time. Start again to get a new one." });
        }
        if (Date.now() < signIn.next) return json(200, { state: "pending" });
        const r = await pollSignIn(id, signIn.device_code).catch(() => ({ state: "pending" as const }));
        if (r.state === "slow_down") signIn.interval += 5000;
        signIn.next = Date.now() + signIn.interval;
        if (r.state === "done") {
          config.save({ token: r.tokens.token, refresh_token: r.tokens.refresh_token, expires_at: r.tokens.expires_at }, session.dir);
          signIn = null;
          source.reset();
          return json(200, { state: "done" });
        }
        if (r.state === "denied" || r.state === "expired" || r.state === "error") {
          signIn = null;
          return json(200, { state: r.state, message: r.message });
        }
        return json(200, { state: "pending" });
      }
      if (path === "/api/signout") {
        config.save({ token: undefined, refresh_token: undefined, expires_at: undefined }, session.dir);
        source.reset();
        return json(200, { ok: true });
      }
      if (path === "/api/project") {
        const repo = typeof body.repo === "string" ? body.repo.trim() : "";
        if (!REPO_NAME.test(repo)) return json(400, { error: "That doesn't look like a project name. It should look like owner/name." });
        config.save({ repo }, session.dir);
        source.reset();
        return json(200, { ok: true });
      }
      if (path === "/api/settings") {
        // { name, value } saves what the person pasted; { name, make: true } has the board make one up.
        const name = typeof body.name === "string" ? body.name : "";
        const typed = body.make === true ? null : typeof body.value === "string" ? body.value : "";
        const repo = session.repo();
        const token = await session.token();
        if (!repo || !token) return json(400, { error: "Sign in and pick your project first." });
        try {
          await saveSetting(repo, token, name, typed);
          return json(200, { ok: true });
        } catch (e) {
          return json(e instanceof SaveRefused ? 400 : 502, { error: e instanceof SaveRefused || e instanceof CantRead ? e.message : "GitHub didn't save it just now. Try again in a minute." });
        }
      }
      if (path === "/api/stop") {
        json(200, { ok: true });
        setTimeout(onStop, 100);
        return;
      }
      return send(404, "Not found", "text/plain");
    }

    if (req.method !== "GET") return send(405, "Not allowed", "text/plain");
    if (path === "/api/status") {
      const token = session.demo ? null : await session.token();
      return json(200, {
        demo: session.demo,
        signed_in: session.demo || !!token,
        saved_sign_in: session.savedSignIn(),
        can_sign_in: !!clientId(),
        install_url: installUrl(),
        repo: session.demo ? "" : session.repo(),
        inside_app: insideApp,
      });
    }
    if (path === "/api/board") return json(200, await source.get());
    if (path === "/api/settings") {
      if (session.demo) return json(200, DEMO_SETTINGS);
      const repo = session.repo();
      if (!repo) return json(400, { error: "Pick your project first." });
      return json(200, await readSettings(repo, await session.token()));
    }
    if (path === "/api/projects") {
      const token = await session.token();
      if (!token) return json(401, { error: "Sign in first." });
      try {
        return json(200, { projects: await listProjects(token) });
      } catch (e) {
        return json(502, { error: e instanceof CantRead ? e.message : "GitHub didn't answer. Try again." });
      }
    }
    const type = TYPES[extname(path === "/" ? "/index.html" : path)];
    const file = type ? pageFile(path) : null;
    return file ? send(200, file, type) : send(404, "Not found", "text/plain");
  });
}

function openBrowser(url: string): void {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  execFile(cmd, args, () => { /* if it can't open, the address is printed anyway */ });
}

async function listen(source: Source, first: number, onStop: () => void): Promise<{ port: number; server: Server }> {
  for (let p = first; p < first + 10; p++) {
    const server = makeServer(source, p, onStop);
    const ok = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(p, "127.0.0.1", () => resolve(true));
    });
    if (ok) return { port: p, server };
  }
  throw new Error(`Ports ${first} to ${first + 9} are all busy. Close another copy of the board and try again.`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      repo: { type: "string" }, demo: { type: "boolean", default: false },
      port: { type: "string", default: "4321" }, "no-open": { type: "boolean", default: false },
    },
  });
  if (!pageBuilt()) {
    console.error("The page isn't built yet. Run: npm start  (or npm run demo)");
    process.exit(1);
  }
  // From source in a project folder, show that project; the downloaded app asks instead.
  const folderRepo = values.demo || insideApp || values.repo ? "" : repoFromGit() ?? "";
  const source = new Source(new Session({ demo: values.demo, repo: values.repo ?? "", folderRepo }));
  const { port, server } = await listen(source, Number(values.port), () => {
    console.log("Board stopped. You can close this window.");
    server.close();
    process.exit(0);
  });
  const url = `http://localhost:${port}`;
  console.log(`Your progress board is open at ${url}`);
  console.log("Keep this window open while you use it. Close it to stop the board.");
  if (!values["no-open"]) openBrowser(url);
}

// `node server/main.ts` starts the board too (the #8 checks start it this way).
if (process.argv[1]?.endsWith("main.ts") && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
