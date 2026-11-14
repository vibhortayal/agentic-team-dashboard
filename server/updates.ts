// What's new for the person: a new version of the Mac app waiting to be installed, and a newer team
// than the one their project uses. The board only reads; Ella updates the team when the person says so.
import { look } from "./github.ts";

/** Where the team comes from. A project records the team it uses in .team/VERSION (written by install.sh). */
export const TEAM_REPO = "vibhortayal/agentic-team-oss";
export const TEAM_BRANCH = "main";
const TEAM_CHECK_MS = 6 * 60 * 60 * 1000;

export interface Updates {
  app: { version: string } | null;
  team: { latest: string } | null;
}

// Set by the Mac app (desktop/) once a new version has downloaded.
let appReady: { version: string; restart: () => void } | null = null;

export function setAppUpdate(version: string, restart: () => void): void {
  appReady = { version, restart };
}

/** Restarts into the downloaded version. False when nothing is waiting. */
export function restartForUpdate(): boolean {
  if (!appReady) return false;
  appReady.restart();
  return true;
}

export function appUpdate(): { version: string } | null {
  return appReady ? { version: appReady.version } : null;
}

/** The commit a .team/VERSION names: "13e79e1", or the commit at the end of "v1.2-3-g13e79e1". */
export function versionCommit(text: string): string | null {
  const m = /(?:^|-g)([0-9a-f]{7,40})$/i.exec(text.trim());
  return m ? m[1].toLowerCase() : null;
}

/** The newest team commit when the project's team is older than it, else null. Quiet on any problem. */
export async function newerTeam(repo: string, token: string | null): Promise<string | null> {
  try {
    const file = await look(`/repos/${repo}/contents/.team/VERSION`, token);
    const content = (file.data as { content?: string } | null)?.content;
    if (file.status !== 200 || typeof content !== "string") return null;
    const have = versionCommit(Buffer.from(content, "base64").toString("utf8"));
    if (!have) return null;
    const cmp = await look(`/repos/${TEAM_REPO}/compare/${have}...${TEAM_BRANCH}`, token);
    const data = cmp.data as { ahead_by?: number; commits?: Array<{ sha?: string }> } | null;
    if (cmp.status !== 200 || !data || !data.ahead_by) return null;
    const latest = data.commits?.at(-1)?.sha;
    return typeof latest === "string" ? latest.slice(0, 7) : null;
  } catch {
    return null;
  }
}

/** newerTeam, asked at most once every six hours per project. */
export class TeamCheck {
  private readonly seen = new Map<string, { at: number; latest: string | null }>();
  private readonly ask: (repo: string, token: string | null) => Promise<string | null>;
  private readonly clock: () => number;
  constructor(ask: (repo: string, token: string | null) => Promise<string | null> = newerTeam, clock: () => number = Date.now) {
    this.ask = ask;
    this.clock = clock;
  }

  async latest(repo: string, token: string | null): Promise<string | null> {
    const hit = this.seen.get(repo);
    if (hit && this.clock() - hit.at < TEAM_CHECK_MS) return hit.latest;
    const latest = await this.ask(repo, token);
    this.seen.set(repo, { at: this.clock(), latest });
    return latest;
  }
}
