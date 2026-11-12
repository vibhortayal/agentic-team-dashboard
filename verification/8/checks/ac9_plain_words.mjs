#!/usr/bin/env node
// AC9, headless part: the served page shell and every board string the page may show (except titles, which are
// the user's own words) carry no label names, JSON or GitHub jargon. The rendered first screen is judged in a
// real browser by verification/8/shots.mjs (not a CI check: the runner has no browser).
import { Board, run } from "./lib.mjs";

const ROLES = ["engagement-lead", "product-manager", "researcher", "critic", "architect", "implementer", "verifier",
  "evaluator", "budget-analyst", "ops"];
const LABELS = String.raw`needs-human|stage:|role:|human:|blocker:|class:trivial|mode:ticket|` + ROLES.join("|");
const JARGON = String.raw`\bpull request\b|\bPR\b|\bissue\b|\blabels?\b|\brepo(sitory)?\b|\bcommit\b|\bbranch\b|\bmerge\b|` +
  String.raw`\bverdict\b|\bBLOCK\b|\bPASS\b|\bINCONCLUSIVE\b|team-event|\bJSON\b|\bAPI\b|[{}\[\]]`;
const BAD = new RegExp(`(${LABELS}|${JARGON})`);
const SKIP = new Set(["title", "url", "update_url", "key", "column", "kind", "check", "stage", "updated", "update_at", "at", "repo", "closed"]);

function shown(o, k, out = []) {
  if (Array.isArray(o)) for (const v of o) shown(v, k, out);
  else if (o && typeof o === "object") { for (const [kk, v] of Object.entries(o)) if (!SKIP.has(kk)) shown(v, kk, out); }
  else if (typeof o === "string" && !o.startsWith("http")) out.push([k, o]);
  return out;
}

await run("AC9", async (r, own) => {
  const b = own(await Board.start(["--demo"]));
  const html = (await b.get("/")).text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  const words = [...html.matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  words.push(...[...html.matchAll(/(?:title|aria-label|alt|placeholder)="([^"]+)"/g)].map((m) => m[1]));
  for (const s of words) { const m = BAD.exec(s); r.check(!m, `page text ${JSON.stringify(s)} has no jargon` + (m ? ` (found ${JSON.stringify(m[0])})` : "")); }
  const board = await b.board();
  for (const [k, s] of shown(board)) {
    const m = BAD.exec(s);
    r.check(!m, `board text [${k}] ${JSON.stringify(s)} has no jargon` + (m ? ` (found ${JSON.stringify(m[0])})` : ""));
  }
});
