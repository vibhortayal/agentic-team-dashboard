// The Settings page: keys and settings the project needs on GitHub, set without opening GitHub.
//
// Ella keeps the list in the project's `team-settings.json` (names, what each is for, where to get
// it; never a secret's value). The board shows which are set and lets the person paste a value.
// Secrets are locked on this computer with GitHub's public key (seal.ts) and are never shown again,
// not even to the board: GitHub only says that a secret exists.
//
// The checks' own settings (CHECK_SETTINGS) control the team's safety checks, so the board only
// shows whether they are set. Ella sets them from the chat after the owner says yes.

import { CantRead, look, send } from "./github.ts";
import { randomValue, seal } from "./seal.ts";

export const LIST_FILE = "team-settings.json";
export const CHECK_SETTINGS = new Set(["TEAM_OWNER", "TEAM_CHECKER", "TEAM_RECEIPTS", "LINT_CMD", "SETUP_CMD", "DOCS_BUDGET"]);
const NAME = /^(?!GITHUB_)[A-Z_][A-Z0-9_]{0,99}$/;
export const MAX_VALUE = 8_000;
export const TOO_LONG = "That's too long to be a key. Check you copied the right thing.";

export interface Wanted {
  name: string;
  kind: "secret" | "variable";
  why: string;
  get?: string; // https page where the person gets the key
  steps?: string; // short plain steps for that page
  value?: string; // a known value (variables); Ella fills these in
  make?: "random"; // secrets the board can make up itself
}

export interface SettingView {
  name: string;
  kind: "secret" | "variable";
  why: string;
  get: string | null;
  steps: string | null;
  checks: boolean; // a checks setting: shown, never changed here
  is_set: boolean;
  value: string | null; // only for app variables that are set; never for secrets or checks settings
  updated_at: string | null;
  can_make: boolean;
}

export interface SettingsView {
  items: SettingView[];
  problem: string | null; // a plain sentence when the board can't show the whole picture
  skipped: number; // list entries the board ignored because they don't make sense
}

function https(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

const text = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** Ella's list, keeping only entries that make sense. Unknown fields are ignored. */
export function parseList(raw: string): { wanted: Wanted[]; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { wanted: [], skipped: 1 };
  }
  const list = data && typeof data === "object" && Array.isArray((data as { settings?: unknown }).settings)
    ? (data as { settings: unknown[] }).settings : [];
  const wanted: Wanted[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const e of list.slice(0, 50)) {
    const o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const kind = o.kind === "secret" || o.kind === "variable" ? o.kind : null;
    const why = text(o.why, 300);
    if (!NAME.test(name) || !kind || !why || seen.has(name)) { skipped++; continue; }
    seen.add(name);
    const w: Wanted = { name, kind, why };
    const getUrl = https(o.get);
    if (getUrl) w.get = getUrl;
    const steps = text(o.steps, 600);
    if (steps) w.steps = steps;
    if (kind === "variable" && typeof o.value === "string") w.value = o.value;
    if (kind === "secret" && o.make === "random") w.make = "random";
    wanted.push(w);
  }
  return { wanted, skipped: skipped + Math.max(0, list.length - 50) };
}

interface Current { variables: Map<string, { value: string; updated_at: string }>; secrets: Map<string, string> }

export function view(wanted: Wanted[], now: Current, problem: string | null, skipped: number): SettingsView {
  const items = wanted.map((w): SettingView => {
    const checks = CHECK_SETTINGS.has(w.name);
    const v = w.kind === "variable" ? now.variables.get(w.name) : undefined;
    const s = w.kind === "secret" ? now.secrets.get(w.name) : undefined;
    return {
      name: w.name, kind: w.kind, why: w.why, get: w.get ?? null, steps: w.steps ?? null, checks,
      is_set: !!(v || s),
      value: v && !checks ? v.value : null,
      updated_at: v?.updated_at ?? s ?? null,
      can_make: !checks && w.make === "random",
    };
  });
  return { items, problem, skipped };
}

const NO_PERMISSION = "The board isn't allowed to see this project's settings yet. Ask Ella to give the board permission for settings.";

async function readList(repo: string, token: string | null): Promise<{ wanted: Wanted[]; skipped: number } | string> {
  const r = await look(`/repos/${repo}/contents/${LIST_FILE}`, token);
  if (r.status === 404) return { wanted: [], skipped: 0 };
  if (r.status === 401) return "Your GitHub sign-in didn't work. Ask Ella to help you sign in again.";
  if (r.status === 403) return NO_PERMISSION;
  const content = (r.data as { content?: unknown } | null)?.content;
  if (typeof content !== "string") return "GitHub had a problem just now. Try again in a minute.";
  return parseList(Buffer.from(content, "base64").toString("utf8"));
}

/** Every page of a list (GitHub gives at most 30 variables or 100 secrets a page), or the status that stopped it. */
async function all<T>(path: string, key: string, per: number, token: string | null): Promise<T[] | number> {
  const out: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await look(`${path}?per_page=${per}&page=${page}`, token);
    if (r.status !== 200) return r.status;
    const got = ((r.data as Record<string, unknown> | null)?.[key] ?? []) as T[];
    out.push(...got);
    if (got.length < per) break;
  }
  return out;
}

async function readCurrent(repo: string, token: string | null): Promise<Current | string> {
  const vars = await all<{ name: string; value: string; updated_at: string }>(`/repos/${repo}/actions/variables`, "variables", 30, token);
  const secs = await all<{ name: string; updated_at: string }>(`/repos/${repo}/actions/secrets`, "secrets", 100, token);
  if (vars === 401 || secs === 401) return "Your GitHub sign-in didn't work. Ask Ella to help you sign in again.";
  if (typeof vars === "number" || typeof secs === "number") return [vars, secs].some((s) => s === 403 || s === 404)
    ? NO_PERMISSION : "GitHub had a problem just now. Try again in a minute.";
  const variables = new Map<string, { value: string; updated_at: string }>();
  for (const v of vars) variables.set(v.name.toUpperCase(), { value: v.value, updated_at: v.updated_at });
  const secrets = new Map<string, string>();
  for (const s of secs) secrets.set(s.name.toUpperCase(), s.updated_at);
  return { variables, secrets };
}

const EMPTY: Current = { variables: new Map(), secrets: new Map() };

/** What the Settings page shows. Never throws; problems come back as a sentence. */
export async function readSettings(repo: string, token: string | null): Promise<SettingsView> {
  try {
    const list = await readList(repo, token);
    if (typeof list === "string") return view([], EMPTY, list, 0);
    if (!list.wanted.length) return view([], EMPTY, null, list.skipped);
    const now = await readCurrent(repo, token);
    return typeof now === "string" ? view(list.wanted, EMPTY, now, list.skipped) : view(list.wanted, now, null, list.skipped);
  } catch (e) {
    return view([], EMPTY, e instanceof CantRead ? e.message : "The board couldn't read your settings just now.", 0);
  }
}

export class SaveRefused extends Error {}

/**
 * Save one setting the person typed (or asked the board to make up). Only names on Ella's list,
 * never a checks setting. The value is never logged or sent back.
 */
export async function saveSetting(repo: string, token: string, name: string, typed: string | null): Promise<void> {
  const list = await readList(repo, token);
  if (typeof list === "string") throw new SaveRefused(list);
  const w = list.wanted.find((x) => x.name === name);
  if (!w) throw new SaveRefused("That setting isn't on Ella's list for this project.");
  if (CHECK_SETTINGS.has(w.name)) throw new SaveRefused("Ella sets this one for the team's checks. Ask her in your chat.");
  let value: string;
  if (typed === null) {
    if (w.make !== "random") throw new SaveRefused("The board can't make this one up. Paste the real value.");
    value = randomValue();
  } else {
    value = typed.trim();
    if (!value) throw new SaveRefused("The box is empty. Paste the value first.");
    if (value.length > MAX_VALUE) throw new SaveRefused(TOO_LONG);
  }

  const refuse = (status: number): never => {
    if (status === 401) throw new SaveRefused("Your GitHub sign-in didn't work. Ask Ella to help you sign in again.");
    if (status === 403 || status === 404) throw new SaveRefused("The board isn't allowed to save settings yet. Ask Ella to give the board permission for settings.");
    throw new SaveRefused("GitHub didn't save it just now. Try again in a minute.");
  };

  if (w.kind === "secret") {
    const k = await look(`/repos/${repo}/actions/secrets/public-key`, token);
    const key = k.data as { key?: unknown; key_id?: unknown } | null;
    if (k.status !== 200 || typeof key?.key !== "string" || typeof key.key_id !== "string") refuse(k.status === 200 ? 500 : k.status);
    const st = await send("PUT", `/repos/${repo}/actions/secrets/${w.name}`, token, { encrypted_value: seal(value, key!.key as string), key_id: key!.key_id });
    if (st !== 201 && st !== 204) refuse(st);
    return;
  }
  let st = await send("PATCH", `/repos/${repo}/actions/variables/${w.name}`, token, { name: w.name, value });
  if (st === 404) st = await send("POST", `/repos/${repo}/actions/variables`, token, { name: w.name, value });
  if (st !== 201 && st !== 204) refuse(st);
}

/** The demo's Settings page: one of each kind, nothing saved anywhere. */
export const DEMO_SETTINGS: SettingsView = view([
  { name: "SETUP_CMD", kind: "variable", why: "How the team's checks get your app ready to test.", value: "npm ci && npm run build" },
  { name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write replies with an AI model.", get: "https://platform.openai.com/api-keys", steps: "Sign in, press \"Create new secret key\", then copy it." },
  { name: "SESSION_SECRET", kind: "secret", why: "Keeps people signed in to your app safely.", make: "random" },
  { name: "SITE_NAME", kind: "variable", why: "The name your app shows at the top of each page." },
], {
  variables: new Map([["SETUP_CMD", { value: "npm ci && npm run build", updated_at: "2026-11-12T10:00:00Z" }]]),
  secrets: new Map([["SESSION_SECRET", "2026-11-12T10:00:00Z"]]),
}, null, 0);
