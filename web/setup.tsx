// The two first-run screens: sign in with GitHub, then pick which project to show.
import { useEffect, useState } from "react";

export interface Status {
  demo: boolean;
  signed_in: boolean;
  saved_sign_in: boolean;
  can_sign_in: boolean;
  install_url: string | null;
  repo: string;
  inside_app: boolean;
}

export async function postJson(path: string, body: unknown = {}): Promise<Record<string, unknown>> {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
  return data;
}

export function SignIn({ status, onDone }: { status: Status; onDone: () => void }) {
  const [code, setCode] = useState<{ user_code: string; verification_uri: string } | null>(null);
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    const t = setInterval(async () => {
      try {
        const r = await postJson("/api/signin/poll");
        if (r.state === "done") onDone();
        else if (r.state !== "pending") { setProblem(String(r.message ?? "That didn't work. Try again.")); setCode(null); }
      } catch (e) {
        setProblem(e instanceof Error ? e.message : String(e)); setCode(null);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [code, onDone]);

  async function start() {
    setProblem("");
    try {
      setCode((await postJson("/api/signin/start")) as { user_code: string; verification_uri: string });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  }

  if (!status.can_sign_in) {
    return (
      <section className="setup">
        <h2>Sign in to GitHub first</h2>
        <p>Your project lives on GitHub, so the board needs your OK to read it. This copy of the board can't sign in by itself yet.</p>
        <p>Ask Ella in the Claude app: "Sign me in to GitHub for the progress board." Then press Check again.</p>
        <button type="button" onClick={onDone}>Check again</button>
      </section>
    );
  }

  return (
    <section className="setup">
      <h2>Sign in with GitHub</h2>
      <p>Your project lives on GitHub. The board only reads it. It can't change anything.</p>
      {!code && <button type="button" className="primary" onClick={() => void start()}>Sign in with GitHub</button>}
      {code && (
        <ol className="steps">
          <li>
            Copy this code:
            <span className="code">{code.user_code}</span>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(code.user_code); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
          </li>
          <li><a href={safe(code.verification_uri)} target="_blank" rel="noopener" className="primary">Open GitHub</a> and paste it there.</li>
          <li>Press <b>Authorize</b> on GitHub. This page moves on by itself.</li>
        </ol>
      )}
      {problem && <p className="problem-line">{problem}</p>}
    </section>
  );
}

export function PickProject({ status, onDone }: { status: Status; onDone: () => void }) {
  const [projects, setProjects] = useState<Array<{ repo: string; private: boolean }> | null>(null);
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    fetch("/api/projects").then(async (r) => {
      const d = (await r.json()) as { projects?: Array<{ repo: string; private: boolean }>; error?: string };
      if (d.projects) setProjects(d.projects); else setProblem(d.error ?? "GitHub didn't answer. Try again.");
    }).catch(() => setProblem("The board stopped running. Start it again."));
  }, []);

  async function choose(repo: string) {
    setProblem("");
    try {
      await postJson("/api/project", { repo });
      onDone();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="setup">
      <h2>Which project should the board show?</h2>
      {projects === null && !problem && <p>Looking for your projects…</p>}
      {projects && projects.length > 0 && (
        <ul className="projects">
          {projects.map((p) => (
            <li key={p.repo}><button type="button" onClick={() => void choose(p.repo)}>{p.repo}{p.private ? " (private)" : ""}</button></li>
          ))}
        </ul>
      )}
      {projects && projects.length === 0 && <p>The board can't see any projects yet.</p>}
      {status.install_url && (
        <p>Project missing? <a href={safe(status.install_url)} target="_blank" rel="noopener">Let the board see it on GitHub</a>, then come back here.</p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void choose(typed); }} className="typed">
        <label htmlFor="repo">Or type its name, like <i>your-name/your-app</i></label>
        <div><input id="repo" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /><button type="submit">Show it</button></div>
      </form>
      {problem && <p className="problem-line">{problem}</p>}
    </section>
  );
}

function safe(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : "#";
  } catch {
    return "#";
  }
}
