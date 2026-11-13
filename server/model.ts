// Turn what the team writes on GitHub into the board, in plain words.
//
// Pure functions only: the input is the raw issue and comment data GitHub returns, the output is
// what the page draws. No network here, so it is easy to test.
// The contract this reads is .team/docs/github-state.md.

import { mask, maskTree } from "./redact.ts";

export interface GhLabel { name?: string }
export interface GhItem {
  number: number;
  title?: string;
  labels?: Array<GhLabel | string>;
  state?: string;
  html_url?: string;
  updated_at?: string;
  comments?: number;
  pull_request?: unknown;
}
export interface GhComment { html_url?: string; created_at?: string; body?: string }
export interface TeamEvent { from?: string; to?: string; kind?: string; verdict?: string; human?: string; [k: string]: unknown }

export type CheckState = "none" | "passed" | "fixes";
export interface Card {
  number: number;
  title: string;
  url: string;
  kind: "task" | "change";
  stage: string | null;
  column: ColumnKey | null;
  holder: string;
  update: string;
  update_at: string | null;
  update_url: string;
  check: CheckState;
  check_words: string;
  needed: { why: string; url: string } | null;
  handled: { why: string; url: string; at: string | null } | null;
  closed: boolean;
  /** The message that asked, as plain text (AC2 of #11). */
  ask: string;
  /** Where to try this change, if the team or the host left a preview link (AC1 of #11). */
  try_url: string | null;
}
export type ColumnKey = "getting-ready" | "ready" | "building" | "checking" | "waiting" | "done";
export interface Column { key: ColumnKey; title: string; help: string; cards: Card[] }
export interface Board {
  repo: string;
  repo_url: string;
  updated: string;
  error: string | null;
  needed: Card[];
  handled: Card[];
  columns: Column[];
  app: AppView;
}

// ---------- the app itself: versions and links (#11) ----------
export interface GhRelease { tag_name?: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean; published_at?: string | null; created_at?: string }
/** One deployment with its latest status, as github.ts flattens it. */
export interface Deploy { environment: string; ref: string; sha: string; url: string; at: string; ok: boolean }
export interface PullHead { number: number; head_ref: string; head_sha: string }
export interface AppData { releases: GhRelease[]; deployments: Deploy[]; pulls: PullHead[] }
export const NO_APP_DATA: AppData = { releases: [], deployments: [], pulls: [] };

export interface Version { name: string; notes: string; at: string | null; state: "live" | "waiting" | "earlier" }
export interface AppView { live_url: string | null; live_at: string | null; versions: Version[] }

const EVENT = /<!--\s*team-event\s*(\{[\s\S]*?\})\s*-->/g;

const PEOPLE: Record<string, readonly [string, string]> = {
  "engagement-lead": ["Ella", "your guide"],
  "product-manager": ["Priya", "plans the work"],
  researcher: ["Rohan", "looks things up"],
  critic: ["Quinn", "looks for problems"],
  architect: ["Arjun", "designs big builds"],
  implementer: ["Ian", "builds"],
  verifier: ["Vera", "checks the work"],
  evaluator: ["Max", "scores AI answers"],
  "budget-analyst": ["Bea", "watches the budget"],
  ops: ["Otto", "keeps things running"],
  owner: ["you", ""],
};

const STAGE_COLUMN: Record<string, ColumnKey> = {
  intake: "getting-ready", research: "getting-ready", spec: "getting-ready",
  ready: "ready", building: "building", verifying: "checking", review: "waiting", done: "done",
};

const COLUMNS: ReadonlyArray<readonly [ColumnKey, string, string]> = [
  ["getting-ready", "Getting ready", "Ella and Priya are working out what to build."],
  ["ready", "Ready to build", "The plan is agreed. Building starts next."],
  ["building", "Being built", "Ian is building it."],
  ["checking", "Being checked", "Vera is checking it works."],
  ["waiting", "Waiting for you", "Checked and ready for you to try."],
  ["done", "Done", "Finished and accepted."],
];

const NEEDED: Record<string, string> = {
  "human:answer": "The team has a question for you.",
  "human:approve": "Something needs your OK.",
  "human:approve-spec": "A plan is ready. Please read it and say yes or no.",
  "human:approve-release": "A new version is ready to go live, with your OK.",
  "human:merge": "Finished work is ready for you to try and accept.",
  "human:spend": "The team wants to spend more than you agreed.",
  "human:access": "The team needs access to something only you can give.",
  "human:red-zone": "A change touches a sensitive area and needs your OK.",
  "human:approve-ui": "New screens are ready for you to look at.",
  "human:blocker": "The team is stuck and needs your help.",
};
const NEEDED_DEFAULT = "The team needs you.";

// Only PASS counts as checked; anything else that isn't a BLOCK shows "Not checked yet" (AC4).
const CHECK_WORDS: Record<string, readonly [CheckState, string]> = {
  PASS: ["passed", "Checked: passed"],
  BLOCK: ["fixes", "Checked: needs fixes"],
};
const NOT_CHECKED = ["none", "Not checked yet"] as const;

export function person(role: string | null): string {
  if (!role) return "Nobody yet";
  const [name, job] = PEOPLE[role] ?? [titleCase(role), ""];
  return job ? `${name} (${job})` : name;
}

function titleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function firstName(role: string | undefined): string {
  return (role && PEOPLE[role]?.[0]) || role || "someone";
}

/** The team-event JSON from a comment, or null if it has none or it is broken. */
export function parseEvent(body: string): TeamEvent | null {
  const found = [...(body || "").matchAll(EVENT)];
  if (!found.length) return null;
  try {
    const data: unknown = JSON.parse(found[found.length - 1][1]);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as TeamEvent) : null;
  } catch {
    return null;
  }
}

function plain(line: string): string {
  return line.replace(/[*_`#>]/g, "").trim().replace(/\s+/g, " ");
}

/** The first line after the header, in plain text: Ella's one-line reason. */
export function reasonLine(body: string): string {
  const lines = (body || "").split("\n").filter((l) => l.trim() && !l.includes("team-event"));
  if (lines.length >= 2) return plain(lines[1]);
  return lines.length ? plain(lines[0]) : "";
}

/** One plain sentence for a team event. */
export function describe(ev: TeamEvent): string {
  const who = firstName(ev.from);
  const to = ev.to;
  switch (ev.kind) {
    case "verdict": {
      const word: Record<string, string> = { PASS: "it works", BLOCK: "it needs fixes", INCONCLUSIVE: "the check isn't finished" };
      return `${who} checked it: ${word[String(ev.verdict)] ?? "see the note"}.`;
    }
    case "handoff":
      return to === "owner" ? `${who} passed it to you.` : `${who} passed it to ${firstName(to)}.`;
    case "question":
      return `${who} asked ${to === "owner" ? "you" : firstName(to)} a question.`;
    case "blocker":
      return `${who} is stuck and stopped.`;
    case "report":
      return `${who} posted a report.`;
    case "note":
      return `${who} left a note.`;
    default:
      return `${who} posted an update.`;
  }
}

function labelsOf(item: GhItem): string[] {
  return (item.labels ?? []).map((lb) => (typeof lb === "string" ? lb : lb?.name ?? ""));
}

function one(labels: string[], prefix: string): string | null {
  const hit = labels.find((lb) => lb.startsWith(prefix));
  return hit === undefined ? null : hit.slice(prefix.length);
}

/** Team comments only, oldest first. */
export function teamComments(comments: GhComment[]): Array<[GhComment, TeamEvent]> {
  return [...comments]
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .flatMap((c): Array<[GhComment, TeamEvent]> => {
      const ev = parseEvent(c.body ?? "");
      return ev ? [[c, ev]] : [];
    });
}

const ASK_MAX = 600;
// Known HTML tag names only, so text such as "Press <Enter>" stays as written.
const HTML_TAG = /<\/?(?:a|abbr|b|blockquote|br|code|dd|del|details|div|dl|dt|em|h[1-6]|hr|i|img|ins|kbd|li|ol|p|picture|pre|q|s|samp|source|span|strong|sub|summary|sup|table|tbody|td|th|thead|tr|tt|u|ul|var)\b[^<>]*>/gi;
// The evidence line's fields are for the team, not for the person trying the app.
const EVIDENCE = /^\W*(Rows|Revision|Files|Command|Expected \/ actual|Repro)\s*:/i;

/** A comment as plain text for a non-coder: no team header, hidden data, Markdown marks or code. */
export function plainMessage(body: string, max = ASK_MAX): string {
  let text = (body || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(HTML_TAG, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Mask before the marks go: removing "_" would change a key's shape so the mask misses it.
  text = mask(text);
  const lines = text.split("\n").map((l) => l.trim());
  // The team header is the first line ("**Ella · Engagement Lead** → owner"): a role marker, not a message.
  const first = lines.findIndex((l) => l.length > 0);
  if (first >= 0 && /[·→]/.test(lines[first])) lines.splice(first, 1);
  text = lines
    .filter((l) => !EVIDENCE.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, "• ").replace(/^#+\s*/, "").replace(/^>\s?/, "").replace(/[*`]/g, "").replace(/(^|[^\w])_+|_+(?=[^\w]|$)/g, "$1").replace(/^---+$/, ""))
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function previewFor(item: GhItem, events: Array<[GhComment, TeamEvent]>, app: AppData): string | null {
  if (item.pull_request !== undefined) {
    const head = app.pulls.find((p) => p.number === item.number);
    if (head) {
      const hits = app.deployments
        .filter((d) => d.ok && !isProduction(d.environment) && (d.ref === head.head_ref || d.sha === head.head_sha))
        .sort((a, b) => b.at.localeCompare(a.at));
      if (hits.length) return hits[0].url;
    }
  }
  let url: string | null = null;
  for (const [, ev] of events) if (typeof ev.preview === "string" && ev.preview) url = ev.preview;
  return url;
}

/** "production", "prod", "Production – my-app" (Vercel) or "github-pages". */
export function isProduction(env: string): boolean {
  return /^(prod(uction)?(\s+[–-]\s+.+)?|github-pages)$/i.test(env.trim());
}

export function buildApp(app: AppData): AppView {
  const live = app.deployments.filter((d) => d.ok && isProduction(d.environment)).sort((a, b) => b.at.localeCompare(a.at))[0];
  const rel = app.releases.filter((r) => !r.prerelease);
  const waiting = rel.filter((r) => r.draft).sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
  const published = rel.filter((r) => !r.draft).sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const version = (r: GhRelease, state: Version["state"]): Version => ({
    name: r.name || r.tag_name || "A version",
    notes: plainMessage(r.body ?? "", 280),
    at: (state === "waiting" ? r.created_at : r.published_at) ?? null,
    state,
  });
  const versions: Version[] = [];
  if (waiting) versions.push(version(waiting, "waiting"));
  published.slice(0, 6).forEach((r, i) => versions.push(version(r, i === 0 ? "live" : "earlier")));
  return { live_url: live?.url ?? null, live_at: live?.at ?? null, versions };
}

export function buildCard(item: GhItem, comments: GhComment[], app: AppData = NO_APP_DATA): Card {
  const labels = labelsOf(item);
  const stage = one(labels, "stage:");
  const role = one(labels, "role:");
  const events = teamComments(comments);
  const itemUrl = item.html_url ?? "";

  let check: readonly [CheckState, string] = NOT_CHECKED;
  for (const [, ev] of events) {
    if (ev.kind === "verdict") check = CHECK_WORDS[String(ev.verdict)] ?? NOT_CHECKED; // latest verdict wins
  }

  let update = "No team updates yet.";
  let updateAt: string | null = item.updated_at ?? null;
  let updateUrl = itemUrl;
  const last = events[events.length - 1];
  if (last) {
    update = describe(last[1]);
    updateAt = last[0].created_at ?? null;
    updateUrl = last[0].html_url || updateUrl;
  }

  let needed: Card["needed"] = null;
  let ask = "";
  if (labels.includes("needs-human")) {
    const human = labels.find((lb) => lb.startsWith("human:")) ?? "";
    let askUrl = itemUrl;
    for (const [c, ev] of events) {
      if (ev.to === "owner" || ev.human) {
        askUrl = c.html_url || askUrl;
        ask = plainMessage(c.body ?? "");
      }
    }
    needed = { why: NEEDED[human] ?? NEEDED_DEFAULT, url: askUrl };
  }

  let handled: Card["handled"] = null;
  for (const [c, ev] of events) {
    if (ev.from === "engagement-lead" && ev.kind === "note") {
      handled = { why: reasonLine(c.body ?? ""), url: c.html_url ?? itemUrl, at: c.created_at ?? null };
    }
  }

  const column = (stage && STAGE_COLUMN[stage]) || null;
  return {
    number: item.number,
    title: item.title ?? "",
    url: itemUrl,
    kind: item.pull_request !== undefined ? "change" : "task",
    stage,
    column,
    holder: column === "done" ? "" : person(role),
    update,
    update_at: updateAt,
    update_url: updateUrl,
    check: check[0],
    check_words: check[1],
    needed,
    handled,
    closed: item.state === "closed",
    ask,
    try_url: previewFor(item, events, app),
  };
}

export function buildBoard(repo: string, items: GhItem[], comments: Map<number, GhComment[]>,
                           updated: string, error: string | null = null, app: AppData = NO_APP_DATA): Board {
  const cards = items.map((it) => buildCard(it, comments.get(it.number) ?? [], app));
  const needed: Card[] = [];
  const handled: Card[] = [];
  const byColumn = new Map<ColumnKey, Card[]>(COLUMNS.map(([k]) => [k, []]));
  for (const card of cards) {
    if (card.needed && !card.closed) needed.push(card);
    else if (card.handled && !card.closed) handled.push(card);
    if (card.column) byColumn.get(card.column)!.push(card);
  }
  return maskTree({
    repo,
    repo_url: repo ? `https://github.com/${repo}` : "",
    updated,
    error,
    needed,
    handled,
    columns: COLUMNS.map(([key, title, help]) => ({ key, title, help, cards: byColumn.get(key)! })),
    app: error ? buildApp(NO_APP_DATA) : buildApp(app),
  });
}

export function errorBoard(repo: string, updated: string, error: string): Board {
  return buildBoard(repo, [], new Map(), updated, error);
}
