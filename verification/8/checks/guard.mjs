// Preloaded into the board process by lib.mjs (node --import). Not a check: run-checks.sh skips
// files that are neither *.sh nor executable.
// 1. No internet: fetch and raw socket connects to anything but this computer are refused and logged.
// 2. A clock the check can step: Date.now and performance.now add the offset (ms) in V8_CLOCK_FILE.
import fs from "node:fs";
import net from "node:net";

const log = process.env.V8_NET_LOG;
const clockFile = process.env.V8_CLOCK_FILE;
const LOCAL = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function refuse(what) {
  if (log) fs.appendFileSync(log, what + "\n");
  return new Error("network disabled by verifier guard");
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!LOCAL.has(url.hostname)) throw new TypeError("fetch failed", { cause: refuse("fetch " + url.href) });
  return realFetch(input, init);
};

const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const o = args[0];
  const host = o && typeof o === "object" && !Array.isArray(o) ? o.host : typeof args[1] === "string" ? args[1] : undefined;
  const path = o && typeof o === "object" ? o.path : undefined;
  if (!path && host && !LOCAL.has(host)) {
    const e = refuse("connect " + host);
    process.nextTick(() => this.destroy(e));
    return this;
  }
  return realConnect.apply(this, args);
};

if (clockFile) {
  const offset = () => { try { return Number(fs.readFileSync(clockFile, "utf8")) || 0; } catch { return 0; } };
  const realNow = Date.now.bind(Date);
  Date.now = () => realNow() + offset();
  const realPerf = performance.now.bind(performance);
  performance.now = () => realPerf() + offset();
}
