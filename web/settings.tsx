// The Settings page: paste a key into a box and the board puts it on GitHub for you.
// Secrets go in a password box, are sent once, and are never shown again.
import { useCallback, useEffect, useState } from "react";
import type { SettingsView, SettingView } from "../server/settings.ts";
import { postJson } from "./setup.tsx";

function safe(url: string | null): string | null {
  try {
    return url && new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function Row({ s, demo, onSaved }: { s: SettingView; demo: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(!s.is_set);
  const [typed, setTyped] = useState(s.kind === "variable" ? s.value ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState(false);
  const id = `set-${s.name}`;

  async function save(make: boolean) {
    setBusy(true);
    setProblem("");
    try {
      await postJson("/api/settings", make ? { name: s.name, make: true } : { name: s.name, value: typed });
      setTyped("");
      setDone(true);
      setOpen(false);
      onSaved();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const state = s.is_set
    ? <span className="check ok">{s.kind === "secret" ? "Saved" : "Set"}</span>
    : <span className="check warn">Not set yet</span>;
  const getUrl = safe(s.get);

  return (
    <li className={"setting" + (s.is_set ? "" : " is-missing")}>
      <div className="sethead">
        <p className="what">{s.why}</p>
        {state}
      </div>
      <p className="setname">{s.kind === "secret" ? "Secret key" : "Setting"}: <code>{s.name}</code></p>

      {s.checks ? (
        <p className="help">{s.is_set ? "Ella set this for the team's checks." : "Ella fills this in for the team's checks. Ask her in your chat."}</p>
      ) : (
        <>
          {s.kind === "variable" && s.is_set && !open && <p className="setvalue">{s.value}</p>}
          {s.kind === "secret" && s.is_set && !open && <p className="help">{done ? "Saved. Not even the board can show it again." : "Saved on GitHub. It can't be shown again, only replaced."}</p>}
          {!s.is_set && (getUrl || s.steps) && (
            <p className="howto">
              {getUrl && <><a href={getUrl} target="_blank" rel="noopener">Get it here</a>. </>}
              {s.steps}
            </p>
          )}
          {open ? (
            <form className="typed" onSubmit={(e) => { e.preventDefault(); void save(false); }}>
              <label htmlFor={id}>{s.kind === "secret" ? "Paste the key here" : "Type the value"}</label>
              <div>
                <input id={id} type={s.kind === "secret" ? "password" : "text"} value={typed} onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off" spellCheck={false} disabled={demo || busy} />
                <button type="submit" className="primary" disabled={demo || busy || !typed.trim()}>{busy ? "Saving…" : "Save"}</button>
              </div>
              {s.can_make && <button type="button" className="link" disabled={demo || busy} onClick={() => void save(true)}>Make one for me</button>}
              {s.kind === "secret" && <p className="help">It goes straight to GitHub, locked. Never paste a key into a chat, not even with Ella.</p>}
            </form>
          ) : (
            <button type="button" onClick={() => { setOpen(true); setDone(false); setTyped(s.kind === "variable" ? s.value ?? "" : ""); }}>{s.kind === "secret" ? "Replace" : "Change"}</button>
          )}
        </>
      )}
      {demo && open && !s.checks && <p className="help">This is the demo, so nothing is saved.</p>}
      {problem && <p className="problem-line">{problem}</p>}
    </li>
  );
}

export function Settings({ demo, onBack }: { demo: boolean; onBack: () => void }) {
  const [data, setData] = useState<SettingsView | null>(null);
  const [problem, setProblem] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const d = (await r.json()) as SettingsView & { error?: string };
      if (!r.ok) setProblem(d.error ?? "The board couldn't read your settings.");
      else setData(d);
    } catch {
      setProblem("The board stopped running. Start it again.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const missing = data?.items.filter((s) => !s.is_set && !s.checks).length ?? 0;

  return (
    <>
      <header className="top">
        <div><p className="eyebrow">Your project</p><h1>Settings and keys</h1></div>
        <nav className="actions"><button type="button" onClick={onBack}>Back to the board</button></nav>
      </header>
      <main>
        <section>
          <p className="help">Your app needs a few things to work, like keys for services it uses. Paste them here and the board puts them in your project on GitHub. You never need to open GitHub.</p>
          {data && missing > 0 && <p className="need-count">{missing === 1 ? "1 thing needs you." : `${missing} things need you.`}</p>}
          {problem && <section className="problem"><p>{problem}</p></section>}
          {data?.problem && <section className="problem"><p>{data.problem}</p></section>}
          {data && !data.items.length && !data.problem && <p className="empty">Nothing to set yet. Ella adds things here when your app needs them.</p>}
          {!!data?.skipped && <p className="help">Some of Ella's list didn't make sense to the board. Tell Ella so she can fix it.</p>}
          {data && <ul className="settings">{data.items.map((s) => <Row key={s.name} s={s} demo={demo} onSaved={() => void load()} />)}</ul>}
        </section>
      </main>
      <footer className="foot">The board runs on your computer. It changes your project only when you press Save here.</footer>
    </>
  );
}
