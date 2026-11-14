// Read the project's issues, pull requests and team comments from GitHub.
//
// Sign-in comes from GITHUB_TOKEN or GH_TOKEN, or from the GitHub command-line tool if it is
// installed and signed in. The board writes only one thing: a setting the person saves on the
// Settings page (settings.ts), through `send` below.

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

function headers(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "team-progress-board",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** One change on GitHub. Returns the status code; the caller decides what each one means. */
export async function send(method: "PUT" | "PATCH" | "POST", path: string, token: string, body: unknown): Promise<number> {
  try {
    const resp = await fetch(apiBase() + path, {
      method, headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    await resp.body?.cancel();
    return resp.status;
  } catch {
    throw new CantRead("The board can't reach GitHub. Check your internet connection.");
  }
}

/** A read that hands back GitHub's status instead of a sentence, for callers that tell 403 from 404. */
export async function look(path: string, token: string | null): Promise<{ status: number; data: unknown }> {
  try {
    const resp = await fetch(apiBase() + path, { headers: headers(token), signal: AbortSignal.timeout(20_000) });
    const data: unknown = resp.ok ? await resp.json().catch(() => null) : (await resp.body?.cancel(), null);
    return { status: resp.status, data };
  } catch {
    throw new CantRead("The board can't reach GitHub. Check your internet connection.");
  }
}

export async function get<T>(path: string, token: string | null): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(apiBase() + path, { headers: headers(token), signal: AbortSignal.timeout(20_000) });
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

export interface Project { repo: string; private: boolean; team: boolean }

const TEAM_CHECKS = 100; // look inside at most this many projects
const AT_ONCE = 8;

/** True when the project uses the team: it has TEAM.md at its root. */
async function usesTeam(repo: string, token: string): Promise<boolean> {
  try {
    return (await look(`/repos/${repo}/contents/TEAM.md`, token)).status === 200;
  } catch {
    return false;
  }
}

/** Projects this sign-in can see, team projects first: through the board's GitHub App if it has one, else every repo you can read. */
export async function listProjects(token: string): Promise<Project[]> {
  const found = await seenRepos(token);
  const team = new Array<boolean>(found.length).fill(false);
  let next = 0;
  const worker = async () => {
    while (next < Math.min(found.length, TEAM_CHECKS)) {
      const i = next++;
      team[i] = await usesTeam(found[i].repo, token);
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
  const all = found.map((p, i) => ({ ...p, team: team[i] }));
  return [...all.filter((p) => p.team), ...all.filter((p) => !p.team)];
}

async function seenRepos(token: string): Promise<Array<{ repo: string; private: boolean }>> {
  const shape = (r: { full_name: string; private?: boolean }) => ({ repo: r.full_name, private: !!r.private });
  try {
    const inst = await get<{ installations: Array<{ id: number }> }>("/user/installations?per_page=100", token);
    const out: Array<{ repo: string; private: boolean }> = [];
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
  // Status reads go only where the board shows a link: the live app and each change waiting for the
  // person. Each gets its newest deployment first; an older one is read only if the newer one has no
  // working link. At most STATUS_READS reads in all.
  const newest = [...(Array.isArray(raw) ? raw : [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const previewsOf = (p: PullHead) => newest.filter((d) => !isProduction(d.environment ?? "") &&
    ((p.head_ref && d.ref === p.head_ref) || (p.head_sha && d.sha === p.head_sha)));
  const places: GhDeployment[][] = [
    newest.filter((d) => isProduction(d.environment ?? "")),
    ...pulls.filter((p) => waiting.includes(p.number)).map(previewsOf),
  ].filter((list) => list.length);
  const deployments: Deploy[] = [];
  const done = new Set<GhDeployment>();
  let reads = 0;
  const read = async (d: GhDeployment): Promise<boolean> => {
    reads++;
    done.add(d);
    const st = (await optional<GhDeployStatus[]>(`/repos/${repo}/deployments/${d.id}/statuses?per_page=1`, token, []))[0];
    const url = st?.environment_url || "";
    if (!url) return false;
    const ok = st?.state === "success";
    deployments.push({ environment: d.environment ?? "", ref: d.ref ?? "", sha: d.sha ?? "", url, at: st?.created_at ?? d.created_at ?? "", ok });
    return ok;
  };
  const found = new Set<number>();
  // Pass 0 reads each place's newest; later passes read the next one only where nothing worked yet.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < places.length && reads < STATUS_READS; i++) {
      if (found.has(i)) continue;
      const d = places[i].find((x) => !done.has(x));
      if (d && await read(d)) found.add(i);
    }
  }
  return { releases: Array.isArray(releases) ? releases : [], deployments, pulls };
}
