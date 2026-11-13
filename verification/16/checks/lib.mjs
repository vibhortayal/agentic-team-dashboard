// Shared helpers for the #16 checks (not a check itself: it is not executable).
// The board runs from source with ../../8/checks/guard.mjs preloaded (no internet), via ../../10/checks/lib.mjs.
// GitHub is a fake on 127.0.0.1 that answers what the Settings page reads and writes:
//   GET  /repos/<repo>/contents/team-settings.json      Ella's list (404 when there is none)
//   GET  /repos/<repo>/actions/secrets                  names and dates only, as GitHub gives them
//   GET  /repos/<repo>/actions/variables                names and values (at most 30 a page, as GitHub)
//   GET  /repos/<repo>/actions/secrets/public-key       a real Curve25519 key; the fake keeps the private half
//   PUT  /repos/<repo>/actions/secrets/<NAME>           opened with the private key and kept in `opened`
//   PATCH/POST /repos/<repo>/actions/variables[/<NAME>]
// Each one can be made to fail on its own (fail[route] = 401 | 403 | 404 | 500 | 503 | "reset").
import { spawnSync } from "node:child_process";
import http from "node:http";
import nacl from "tweetnacl";
import { blake2b } from "@noble/hashes/blake2.js";
import { Board, filesUnder, run, tmpdir } from "../../10/checks/lib.mjs";
export { Board, filesUnder, run, tmpdir };

export const REPO = "acme/garden";
export const TOKEN = "ghp_VerifierSettingsToken0123456789abcd";
export const B64 = (s) => Buffer.from(s, "utf8").toString("base64");

// Open a sealed box the way GitHub does (crypto_box_seal_open), independently of the board's code path.
export function openSeal(b64, keyPair) {
  const c = new Uint8Array(Buffer.from(b64, "base64"));
  if (c.length < 32 + 16) return null;
  const epk = c.slice(0, 32);
  const nonce = blake2b(new Uint8Array([...epk, ...keyPair.publicKey]), { dkLen: 24 });
  const m = nacl.box.open(c.slice(32), nonce, epk, keyPair.secretKey);
  return m ? Buffer.from(m).toString("utf8") : null;
}

// The same with libsodium (PyNaCl's SealedBox). Returns {ok, value} or {ok:false, why} when PyNaCl is missing.
export function openSealLibsodium(b64, keyPair) {
  const py = `
import sys, base64
from nacl.public import PrivateKey, SealedBox
sk = PrivateKey(base64.b64decode(sys.argv[1]))
try:
    sys.stdout.write(base64.b64encode(SealedBox(sk).decrypt(base64.b64decode(sys.argv[2]))).decode())
except Exception as e:
    sys.stdout.write("ERR " + type(e).__name__)
`;
  const r = spawnSync("python3", ["-I", "-c", py, Buffer.from(keyPair.secretKey).toString("base64"), b64], { encoding: "utf8" });
  if (r.status !== 0) return { ok: false, why: "PyNaCl not available: " + (r.stderr || r.error || "").toString().split("\n").filter(Boolean).pop() };
  if (r.stdout.startsWith("ERR ")) return { ok: true, value: null, err: r.stdout };
  return { ok: true, value: Buffer.from(r.stdout, "base64").toString("utf8") };
}

export class FakeGitHub {
  constructor({ list = null, secrets = {}, variables = {} } = {}) {
    this.list = list; // raw text of team-settings.json, or null for none
    this.secrets = { ...secrets }; // name -> updated_at
    this.variables = { ...variables }; // name -> value
    this.keys = nacl.box.keyPair();
    this.keyId = "568250167242549743";
    this.fail = {}; // route -> code | "reset"
    this.calls = []; // {method, path, raw}
    this.opened = []; // {name, value, key_id, encrypted_value}
    this.server = http.createServer((req, res) => this.handle(req, res));
  }
  async start() {
    await new Promise((r) => this.server.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${this.server.address().port}`;
    return this;
  }
  stop() { this.server.close(); this.server.closeAllConnections?.(); }
  writes() { return this.calls.filter((c) => c.method !== "GET"); }
  handle(req, res) {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const u = new URL(req.url, "http://x");
      this.calls.push({ method: req.method, path: u.pathname + u.search, raw, auth: req.headers.authorization ?? "" });
      const send = (code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(data === undefined ? "" : JSON.stringify(data)); };
      const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (parts[0] !== "repos" || `${parts[1]}/${parts[2]}` !== REPO) return send(404, { message: "Not Found" });
      const rest = parts.slice(3).join("/");
      let route = "other";
      if (rest === `contents/team-settings.json`) route = "contents";
      else if (rest === "actions/secrets" && req.method === "GET") route = "secrets";
      else if (rest === "actions/variables" && req.method === "GET") route = "variables";
      else if (rest === "actions/secrets/public-key") route = "key";
      else if (rest.startsWith("actions/secrets/") && req.method === "PUT") route = "put";
      else if (rest.startsWith("actions/variables/") && req.method === "PATCH") route = "patch";
      else if (rest === "actions/variables" && req.method === "POST") route = "post";
      const f = this.fail[route];
      if (f === "reset") return req.socket.destroy();
      if (typeof f === "number") return send(f, { message: f === 401 ? "Bad credentials" : f === 403 ? "Resource not accessible by integration" : "Server Error" });
      const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      switch (route) {
        case "contents":
          if (this.list === null) return send(404, { message: "Not Found" });
          return send(200, { type: "file", name: "team-settings.json", path: "team-settings.json", encoding: "base64",
            content: B64(this.list).replace(/(.{60})/g, "$1\n") });
        case "secrets": {
          const all = Object.entries(this.secrets).map(([name, at]) => ({ name, created_at: at, updated_at: at }));
          return send(200, { total_count: all.length, secrets: page(all, u, 100) });
        }
        case "variables": {
          const all = Object.entries(this.variables).map(([name, value]) => ({ name, value, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" }));
          return send(200, { total_count: all.length, variables: page(all, u, 30) });
        }
        case "key":
          return send(200, { key_id: this.keyId, key: Buffer.from(this.keys.publicKey).toString("base64") });
        case "put": {
          const name = parts[5];
          let body = {};
          try { body = JSON.parse(raw); } catch {}
          this.opened.push({ name, value: openSeal(body.encrypted_value ?? "", this.keys), key_id: body.key_id, encrypted_value: body.encrypted_value });
          const isNew = !(name in this.secrets);
          this.secrets[name] = now;
          return send(isNew ? 201 : 204);
        }
        case "patch": {
          const name = parts[5];
          if (!(name in this.variables)) return send(404, { message: "Not Found" });
          this.variables[name] = JSON.parse(raw).value;
          return send(204);
        }
        case "post": {
          const b = JSON.parse(raw);
          if (b.name in this.variables) return send(409, { message: "Already exists" });
          this.variables[b.name] = b.value;
          return send(201);
        }
      }
      // Anything else the board page reads (issues, pulls, releases, deployments): nothing there.
      if (parts.length === 3) return send(200, { full_name: REPO, html_url: `https://github.com/${REPO}`, private: false });
      if (req.method === "GET") return send(200, []);
      return send(404, { message: "Not Found" });
    });
  }
}

function page(all, u, max) {
  const per = Math.min(Number(u.searchParams.get("per_page") ?? "30"), max);
  const p = Number(u.searchParams.get("page") ?? "1");
  return all.slice((p - 1) * per, p * per);
}

// The board for acme/garden, signed in with a fake GITHUB_TOKEN, started outside any project folder.
export async function startBoard(gh, { demo = false, env = {} } = {}) {
  const args = demo ? ["--demo"] : ["--repo", REPO];
  return Board.start(args, { github: demo ? undefined : gh, env: demo ? env : { GITHUB_TOKEN: TOKEN, ...env }, cwd: tmpdir("cwd") });
}

export async function settings(b) {
  const r = await b.get("/api/settings");
  let data = null;
  try { data = JSON.parse(r.text); } catch {}
  return { ...r, data };
}

export const sentences = (s) => (String(s).trim().match(/[.!?](\s|$)/g) ?? []).length;
export const JARGON = /\b[1-5]\d\d\b|\{|\}|undefined|null|Error:|ECONN|fetch failed|Bad credentials|Resource not accessible|Server Error/i;
