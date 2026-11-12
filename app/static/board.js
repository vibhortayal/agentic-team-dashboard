// Draws the board from /api/board. Every piece of text goes in with textContent, never as HTML.
"use strict";

const FACE_COLOURS = { Ella: "#b5552b", Priya: "#7a4fb5", Ian: "#2d6fb5", Vera: "#1f7a4d", Rohan: "#8a6d1f",
  Quinn: "#9b3b5a", Arjun: "#3b6e7a", Max: "#5a5fb0", Bea: "#a0522d", Otto: "#4f6b3a" };

const EARLY = new Set(["getting-ready", "ready"]);

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "text") node.textContent = v; else node.setAttribute(k, v);
  }
  for (const kid of kids) if (kid) node.append(kid);
  return node;
}

function safeUrl(url) {
  try { const u = new URL(url); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}

function ago(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24); return `${d} day${d === 1 ? "" : "s"} ago`;
}

function link(url, text, cls) {
  const href = safeUrl(url);
  return href ? el("a", { href, target: "_blank", rel: "noopener", class: cls, text }) : el("span", { text });
}

function face(holder) {
  const name = (holder || "").split(" ")[0];
  const f = el("span", { class: "face", "aria-hidden": "true", text: name ? name[0] : "?" });
  if (FACE_COLOURS[name]) f.style.background = FACE_COLOURS[name];
  return f;
}

function needCard(c) {
  return el("li", { class: "need" },
    el("p", { class: "why", text: c.needed.why }),
    el("p", { class: "what", text: c.title }),
    link(c.needed.url, "See what's asked", "go"));
}

function handledItem(c) {
  return el("li", {},
    el("p", { class: "what", text: c.title }),
    el("p", { class: "why", text: c.handled.why ? `Ella: "${c.handled.why}"` : "Ella left a note." }));
}

function card(c) {
  const update = el("p", { class: "update" }, document.createTextNode(c.update + " "),
    el("time", { datetime: c.update_at, text: ago(c.update_at) }));
  return el("article", { class: "card" + (c.needed ? " is-needed" : "") },
    el("p", { class: "title" }, link(c.url, c.title)),
    c.holder ? el("div", { class: "who" }, face(c.holder), el("span", { text: c.holder })) : null,
    update,
    // Before building starts there is nothing to check yet, so the badge would only be noise.
    c.check === "none" && EARLY.has(c.column) ? null : el("span", { class: `check ${c.check}`, text: c.check_words }));
}

function column(col) {
  const box = el("div", { class: "col" },
    el("h3", {}, el("span", { text: col.title }), el("span", { class: "count", text: String(col.cards.length) })),
    el("p", { class: "colhelp", text: col.help }));
  if (!col.cards.length) box.append(el("p", { class: "nocards", text: "Nothing here right now." }));
  col.cards.forEach((c) => box.append(card(c)));
  return box;
}

function draw(b) {
  const name = b.repo ? b.repo.split("/").pop().replace(/[-_]/g, " ") : "Your project";
  document.getElementById("project").textContent = name.charAt(0).toUpperCase() + name.slice(1);
  document.getElementById("updated").textContent = `Last checked ${ago(b.updated)}`;
  document.getElementById("updated").dataset.at = b.updated;

  const problem = document.getElementById("problem");
  problem.hidden = !b.error;
  if (b.error) {
    document.getElementById("problem-text").textContent = b.error;
    const a = document.getElementById("problem-link");
    const href = safeUrl(b.repo_url);
    a.hidden = !href; if (href) a.href = href;
  }

  const needed = document.getElementById("needed");
  needed.replaceChildren(...b.needed.map(needCard));
  if (!b.needed.length && !b.error) needed.append(el("li", { class: "empty", text: "Nothing needs you right now. The team will put things here when it does." }));

  document.getElementById("handled-box").hidden = !b.handled.length;
  document.getElementById("handled").replaceChildren(...b.handled.map(handledItem));

  // A problem means we know nothing current, so show no columns rather than stale ones.
  document.getElementById("columns").replaceChildren(...(b.error ? [] : b.columns.map(column)));
}

async function load(refresh = false) {
  const btn = document.getElementById("refresh");
  btn.disabled = true; btn.textContent = "Checking…";
  try {
    const r = await fetch("/api/board" + (refresh ? "?refresh=1" : ""), { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    draw(await r.json());
  } catch {
    draw({ repo: "", repo_url: "", updated: new Date().toISOString(), needed: [], handled: [], columns: [],
      error: "The board stopped running on your computer. Ask Ella to start it again." });
  } finally {
    btn.disabled = false; btn.textContent = "Check now";
  }
}

document.getElementById("refresh").addEventListener("click", () => load(true));
setInterval(() => load(false), 60_000);
setInterval(() => {
  const u = document.getElementById("updated");
  if (u.dataset.at) u.textContent = `Last checked ${ago(u.dataset.at)}`;
}, 15_000);
load();
