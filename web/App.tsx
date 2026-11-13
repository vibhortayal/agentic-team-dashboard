// Draws the board from /api/board. React escapes every piece of text, so nothing is shown as HTML.
import { useCallback, useEffect, useState } from "react";
import type { AppView, Board, Card, Column, Latest, Version } from "../server/model.ts";
import { Settings } from "./settings.tsx";
import { PickProject, postJson, SignIn, type Status } from "./setup.tsx";

const FACE_CLASS: Record<string, string> = {
  Ella: "ella", Priya: "priya", Ian: "ian", Vera: "vera", Rohan: "rohan",
  Quinn: "quinn", Arjun: "arjun", Max: "max", Bea: "bea", Otto: "otto",
};
const EARLY = new Set(["getting-ready", "ready"]);

function safeUrl(url: string | null | undefined): string | null {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function ago(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "";
  const s = Math.max(0, (nowMs - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// The person using the board tests their app; they never need GitHub or code (#11). So the only
// links on the board open the app itself: the live app and each change's preview.
function AppLink({ url, text, className }: { url: string | null | undefined; text: string; className?: string }) {
  const href = safeUrl(url);
  if (!href || /(^|\.)github\.com$/i.test(new URL(href).hostname)) return null;
  return <a href={href} target="_blank" rel="noopener" className={className}>{text}</a>;
}

function Face({ holder }: { holder: string }) {
  const name = holder.split(" ")[0];
  return <span className={`face ${FACE_CLASS[name] ?? ""}`} aria-hidden="true">{name ? name[0] : "?"}</span>;
}

function NeedCard({ c }: { c: Card }) {
  return (
    <li className="need">
      <p className="why">{c.needed!.why}</p>
      <p className="what">{c.title}</p>
      {c.ask && <p className="ask">{c.ask}</p>}
      <AppLink url={c.try_url} text="Try it" className="go" />
      <p className="answer">Tell Ella in your chat with her.</p>
    </li>
  );
}

function VersionRow({ v, nowMs }: { v: Version; nowMs: number }) {
  const tag = { live: "Live now", waiting: "Ready to go live, waiting for your OK", earlier: "" }[v.state];
  return (
    <li className={`version v-${v.state}`}>
      <p className="vname">{v.name} {tag && <span className={`vtag ${v.state}`}>{tag}</span>}
        {v.at && <time dateTime={v.at}> {ago(v.at, nowMs)}</time>}</p>
      {v.notes && v.state !== "earlier" && <p className="vnotes">{v.notes}</p>}
    </li>
  );
}

function YourApp({ app, nowMs }: { app: AppView; nowMs: number }) {
  const empty = !app.live_url && !app.versions.length;
  return (
    <section aria-labelledby="app-h">
      <h2 id="app-h">Your app</h2>
      {empty ? <p className="help">Your app isn't online yet. Ella will put a link here once it is.</p> : (
        <div className="appbox">
          {app.live_url && <p className="live"><AppLink url={app.live_url} text="Open your app" className="go" />
            {app.live_at && <span className="help"> Updated {ago(app.live_at, nowMs)}</span>}</p>}
          {!!app.versions.length && <ul className="versions">{app.versions.map((v) => <VersionRow key={v.name + v.state} v={v} nowMs={nowMs} />)}</ul>}
        </div>
      )}
    </section>
  );
}

function HandledItem({ c }: { c: Card }) {
  return (
    <li>
      <p className="what">{c.title}</p>
      <p className="why">{c.handled!.why ? `Ella: "${c.handled!.why}"` : "Ella left a note."}</p>
    </li>
  );
}

function WorkCard({ c, nowMs }: { c: Card; nowMs: number }) {
  // Before building starts there is nothing to check yet, so the badge would only be noise.
  const showCheck = !(c.check === "none" && c.column && EARLY.has(c.column));
  return (
    <article className={"card" + (c.needed ? " is-needed" : "")}>
      <p className="title">{c.title}</p>
      {c.holder && <div className="who"><Face holder={c.holder} /><span>{c.holder}</span></div>}
      <p className="update">{c.update} <time dateTime={c.update_at ?? undefined}>{ago(c.update_at, nowMs)}</time></p>
      {showCheck && <span className={`check ${c.check}`}>{c.check_words}</span>}
    </article>
  );
}

/** The team's newest saved work, and what an empty board means, so progress shows from the first minutes. */
function LatestWork({ board, nowMs }: { board: Board; nowMs: number }) {
  const cards = board.columns.some((c) => c.cards.length) || board.needed.length > 0;
  return (
    <>
      {!cards && (
        <p className="empty">
          {board.latest.length
            ? "The team is getting started. Cards show up here once Ella opens your project's first task."
            : "Nothing here yet. Talk to Ella to get your project started."}
        </p>
      )}
      {!!board.latest.length && (
        <div className="latest">
          <h3>Latest from the team</h3>
          <ul>{board.latest.map((l: Latest, i) => (
            <li key={i}><span className="l-who">{l.who}</span> {l.what} <span className="l-when">{ago(l.at, nowMs)}</span></li>
          ))}</ul>
        </div>
      )}
    </>
  );
}

function ColumnBox({ col, nowMs }: { col: Column; nowMs: number }) {
  return (
    <div className="col">
      <h3><span>{col.title}</span><span className="count">{col.cards.length}</span></h3>
      <p className="colhelp">{col.help}</p>
      {col.cards.length ? col.cards.map((c) => <WorkCard key={c.number} c={c} nowMs={nowMs} />)
        : <p className="nocards">Nothing here right now.</p>}
    </div>
  );
}

const STOPPED: Omit<Board, "updated"> = {
  repo: "", repo_url: "", needed: [], handled: [], columns: [], app: { live_url: null, live_at: null, versions: [] }, latest: [],
  error: "The board stopped running on your computer. Ask Ella to start it again.",
};

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [stopped, setStopped] = useState(false);
  const [picking, setPicking] = useState(false);
  const [settings, setSettings] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      setStatus((await r.json()) as Status);
    } catch {
      setStopped(true);
    }
  }, []);
  useEffect(() => { void check(); }, [check]);

  if (stopped) return <Shell title="Board stopped"><section className="problem"><h2>The board isn't running</h2><p>Start it again to see your project.</p></section></Shell>;
  if (!status) return <Shell title="Loading…" />;
  if (!status.signed_in) return <Shell title="Welcome"><SignIn status={status} onDone={() => void check()} /></Shell>;
  if (!status.demo && (!status.repo || picking)) {
    return <Shell title="Welcome"><PickProject status={status} onDone={() => { setPicking(false); void check(); }} /></Shell>;
  }
  if (settings) return <Settings demo={status.demo} onBack={() => setSettings(false)} />;
  return (
    <BoardView
      status={status}
      onSettings={() => setSettings(true)}
      onChangeProject={() => setPicking(true)}
      onSignOut={async () => { await postJson("/api/signout"); void check(); }}
      onStop={async () => { await postJson("/api/stop").catch(() => null); setStopped(true); }}
    />
  );
}

function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <header className="top"><div><p className="eyebrow">Your project board</p><h1>{title}</h1></div></header>
      <main>{children}</main>
      <footer className="foot">The board runs on your computer. It changes your project only when you save a setting.</footer>
    </>
  );
}

function BoardView({ status, onSettings, onChangeProject, onSignOut, onStop }: {
  status: Status; onSettings: () => void; onChangeProject: () => void; onSignOut: () => void; onStop: () => void;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/board", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setBoard((await r.json()) as Board);
    } catch {
      setBoard({ ...STOPPED, updated: new Date().toISOString() });
    } finally {
      setBusy(false);
      setNowMs(Date.now());
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 60_000);
    const tick = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  useEffect(() => { document.title = board?.repo ? `${projectName(board.repo)}: your project board` : "Your project board"; }, [board]);

  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">Your project</p>
          <h1>{board ? projectName(board.repo) : "Loading…"}</h1>
        </div>
        <div className="fresh">
          <span aria-live="polite">{board ? `Last checked ${ago(board.updated, nowMs)}` : ""}</span>
          <button type="button" onClick={() => void load()} disabled={busy}>{busy ? "Checking…" : "Check now"}</button>
        </div>
        <nav className="actions">
          <button type="button" className="link" onClick={onSettings}>Settings and keys</button>
          {!status.demo && <>
            <button type="button" className="link" onClick={onChangeProject}>Change project</button>
            {status.saved_sign_in && <button type="button" className="link" onClick={onSignOut}>Sign out</button>}
            {status.inside_app && <button type="button" className="link" onClick={onStop}>Stop the board</button>}
          </>}
        </nav>
      </header>

      <main>
        {board?.error && (
          <section className="problem">
            <h2>We can't see your project right now</h2>
            <p>{board.error}</p>
            <p>If it keeps happening, tell Ella.</p>
          </section>
        )}

        <section aria-labelledby="needed-h">
          <h2 id="needed-h">Waiting for you</h2>
          <p className="help">The team can't go on with these until you look.</p>
          <ul className="needed">
            {board?.needed.map((c) => <NeedCard key={c.number} c={c} />)}
            {board && !board.needed.length && !board.error &&
              <li className="empty">Nothing needs you right now. The team will put things here when it does.</li>}
          </ul>
        </section>

        {board && !board.error && <YourApp app={board.app} nowMs={nowMs} />}

        {!!board?.handled.length && (
          <section aria-labelledby="handled-h">
            <h2 id="handled-h">Ella handled these herself</h2>
            <p className="help">Too small to stop you for. Here's why, in case you want to know.</p>
            <ul className="handled">{board.handled.map((c) => <HandledItem key={c.number} c={c} />)}</ul>
          </section>
        )}

        <section aria-labelledby="progress-h">
          <h2 id="progress-h">What the team is doing</h2>
          <p className="help">Each card is one piece of work. It moves right as the team gets it done.</p>
          {board && !board.error && <LatestWork board={board} nowMs={nowMs} />}
          {/* A problem means we know nothing current, so show no columns rather than stale ones. */}
          <div className="columns">{board && !board.error && board.columns.map((col) => <ColumnBox key={col.key} col={col} nowMs={nowMs} />)}</div>
        </section>
      </main>

      <footer className="foot">The board runs on your computer. It changes your project only when you save a setting.</footer>
    </>
  );
}

function projectName(repo: string): string {
  const name = repo ? repo.split("/").pop()!.replace(/[-_]/g, " ") : "Your project";
  return name.charAt(0).toUpperCase() + name.slice(1);
}
