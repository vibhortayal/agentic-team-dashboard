// Read the project's issues, pull requests and team comments from GitHub.
//
// Read only. Sign-in comes from GITHUB_TOKEN or GH_TOKEN, or from the GitHub command-line tool
// if it is installed and signed in. Nothing is ever written.

import { execFileSync } from "node:child_process";
import { isProduction, type AppData, type Deploy, type GhComment, type GhItem, type GhRelease, type PullHead } from "./model.ts";

/** GitHub couldn't be read. The message is a plain sentence for the page. */
export class CantRead extends Error {}

const DEFAULT_API = "https://api.github.com";

/** Where GitHub is. Tests may point it at this computer only, so a token can't be sent elsewhere. */
export function apiBase(env: NodeJS.ProcessEnv = process.env): string {
  const custom = env.BOARD_GITHUB_API;
  if (!custom) return DEFAULT_API;
  const u = new URL(custom);
  if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return custom.replace(/\/$/, "");
  throw new Error("BOARD_GITHUB_API may only point at this computer (http://127.0.0.1:<port>)");
}

export function findToken(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const name of ["GITHUB_TOKEN", "GH_TOKEN"]) {
    const v = env[name]?.trim();
    if (v) return v;
  }
  try {
    const out = execFileSync("gh", ["auth", "token"], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** owner/name from the folder's git remote, if it points at GitHub. */
export function repoFromGit(folder = "."): string | null {
  let url: string;
  try {
    url = execFileSync("git", ["-C", folder, "remote", "get-url", "origin"], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
  return repoFromUrl(url);
}

export function repoFromUrl(url: string): string | null {
  // Sessions may use a local proxy remote such as http://127.0.0.1:1234/git/owner/name.
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url) ?? /\/git\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url);
  return m ? `${m[1]}/${m[2]}` : null;
}

async function get<T>(path: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "team-progress-board",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let resp: Response;
  try {
    resp = await fetch(apiBase() + path, { headers, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new CantRead("The board can't reach GitHub. Check your internet connection.");
  }
  if (!resp.ok) {
    if ((resp.status === 401 || resp.status === 403 || resp.status === 429) && resp.headers.get("x-ratelimit-remaining") === "0") {
      throw new CantRead("GitHub asked us to slow down. The board will try again in a few minutes.");
    }
    if (resp.status === 401) throw new CantRead("Your GitHub sign-in didn't work. Ask Ella to help you sign in again.");
    if (resp.status === 403 || resp.status === 404) throw new CantRead("The board can't see this project on GitHub. It may be private and need you to sign in.");
    throw new CantRead("GitHub had a problem just now. The board will try again soon.");
  }
  try {
    return (await resp.json()) as T;
  } catch {
    throw new CantRead("GitHub had a problem just now. The board will try again soon.");
  }
}

export function isTeamItem(item: GhItem): boolean {
  return (item.labels ?? []).some((lb) => {
    const n = typeof lb === "string" ? lb : lb?.name ?? "";
    return n === "needs-human" || n.startsWith("stage:") || n.startsWith("role:") || n.startsWith("human:");
  });
}

/** Open team items, the last few finished ones, and the team comments on each. */
export async function readProject(repo: string, token: string | null): Promise<{ items: GhItem[]; comments: Map<number, GhComment[]> }> {
  const open = await get<GhItem[]>(`/repos/${repo}/issues?state=open&per_page=100`, token);
  const done = await get<GhItem[]>(`/repos/${repo}/issues?state=closed&labels=stage:done&per_page=10&sort=updated`, token);
  const seen = new Set<number>();
  const items: GhItem[] = [];
  for (const it of [...open, ...done]) {
    if (!seen.has(it.number) && isTeamItem(it)) {
      seen.add(it.number);
      items.push(it);
    }
  }
  const comments = new Map<number, GhComment[]>();
  for (const it of items) {
    if (it.comments) comments.set(it.number, await get<GhComment[]>(`/repos/${repo}/issues/${it.number}/comments?per_page=100`, token));
  }
  return { items, comments };
}

export interface Project { repo: string; private: boolean }

/** Projects this sign-in can see: through the board's GitHub App if it has one, else every repo you can read. */
export async function listProjects(token: string): Promise<Project[]> {
  const shape = (r: { full_name: string; private?: boolean }): Project => ({ repo: r.full_name, private: !!r.private });
  try {
    const inst = await get<{ installations: Array<{ id: number }> }>("/user/installations?per_page=100", token);
    const out: Project[] = [];
    for (const i of inst.installations) {
      const r = await get<{ repositories: Array<{ full_name: string; private?: boolean }> }>(`/user/installations/${i.id}/repositories?per_page=100`, token);
      out.push(...r.repositories.map(shape));
    }
    if (out.length) return out;
  } catch {
    // Not a GitHub App sign-in (for example the GitHub command-line tool's): fall back below.
  }
  const repos = await get<Array<{ full_name: string; private?: boolean }>>("/user/repos?per_page=100&sort=updated", token);
  return repos.map(shape);
}

// owner/name, where neither part is "." or ".." (they would point at other GitHub addresses).
export const REPO_NAME = /^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;

interface GhDeployment { id: number; environment?: string; ref?: string; sha?: string; created_at?: string }
interface GhDeployStatus { state?: string; environment_url?: string; target_url?: string; created_at?: string }

/** Read one optional thing: if GitHub can't give it, the board shows without it (AC5 of #11). */
async function optional<T>(path: string, token: string | null, empty: T): Promise<T> {
  try {
    return await get<T>(path, token);
  } catch {
    return empty;
  }
}

const STATUS_READS = 6;

/** The app's versions (releases) and its live and preview links (deployments). Never throws. */
export async function readApp(repo: string, token: string | null, openPulls: number, waiting: number[] = []): Promise<AppData> {
  const releases = await optional<GhRelease[]>(`/repos/${repo}/releases?per_page=10`, token, []);
  const raw = await optional<GhDeployment[]>(`/repos/${repo}/deployments?per_page=30`, token, []);
  const pulls = openPulls
    ? (await optional<Array<{ number: number; head?: { ref?: string; sha?: string } }>>(`/repos/${repo}/pulls?state=open&per_page=100`, token, []))
        .map((p): PullHead => ({ number: p.number, head_ref: p.head?.ref ?? "", head_sha: p.head?.sha ?? "" }))
    : [];
  // Status reads go where the board shows a link, in turn: the newest live deployment, then the
  // newest preview of each change waiting for the person, then second tries, then other changes.
  const newest = [...(Array.isArray(raw) ? raw : [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const previewsOf = (p: PullHead) => newest.filter((d) => !isProduction(d.environment ?? "") &&
    ((p.head_ref && d.ref === p.head_ref) || (p.head_sha && d.sha === p.head_sha)));
  const live = newest.filter((d) => isProduction(d.environment ?? ""));
  const waitingPulls = pulls.filter((p) => waiting.includes(p.number));
  const otherPulls = pulls.filter((p) => !waiting.includes(p.number));
  const order: GhDeployment[] = [
    ...live.slice(0, 1),
    ...waitingPulls.map((p) => previewsOf(p)[0]),
    ...live.slice(1, 2),
    ...waitingPulls.map((p) => previewsOf(p)[1]),
    ...otherPulls.map((p) => previewsOf(p)[0]),
  ].filter((d): d is GhDeployment => d !== undefined);
  const picked: GhDeployment[] = [];
  for (const d of order) if (picked.length < STATUS_READS && !picked.includes(d)) picked.push(d);
  const deployments: Deploy[] = [];
  for (const d of picked) {
    const st = (await optional<GhDeployStatus[]>(`/repos/${repo}/deployments/${d.id}/statuses?per_page=1`, token, []))[0];
    const url = st?.environment_url || "";
    if (!url) continue;
    deployments.push({ environment: d.environment ?? "", ref: d.ref ?? "", sha: d.sha ?? "", url, at: st?.created_at ?? d.created_at ?? "", ok: st?.state === "success" });
  }
  return { releases: Array.isArray(releases) ? releases : [], deployments, pulls };
}
