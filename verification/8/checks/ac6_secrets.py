#!/usr/bin/env python3
"""AC6: the Verifier's own planted fake keys, one per shape, all come out masked in everything the server sends.

The keys below are fake and built at run time so no scanner mistakes this file for a leak.
"""
import json
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import Board, Result, comment, item, write_fixture  # noqa: E402

A = "Q7vX2mR9kL4tW8nB3pZ6cY1dH5gJ0fSaE"  # filler
SHAPES = {  # shape -> fake value
    "github classic": "gh" + "p_" + (A + "uiopas")[:36],
    "github oauth": "gh" + "o_" + (A[::-1] + "qwerty")[:36],
    "github fine-grained": "github" + "_pat_" + "11ABCDEFG0" + A[:12] + "_" + (A * 2)[:59],
    "aws access key": "AK" + "IA" + "Z7QW4XRT9PLM2VBN",
    "anthropic": "sk-" + "ant-api03-" + (A * 3)[:80] + "-AA",
    "openai": "sk-" + "proj-" + (A * 2)[:48],
    "slack": "xo" + "xb-" + "2048123456789-1234567890123-" + A[:24],
    "google api": "AI" + "za" + "SyD" + (A * 2)[:32],
    "stripe": "sk_" + "live_" + A[:24],
    "jwt": "ey" + "JhbGciOiJIUzI1NiJ9." + "eyJzdWIiOiIxMjM0NTY3ODkwIn0." + A[:30],
    "private key": "-----BEGIN " + "RSA PRIVATE KEY-----MIIEow" + A[:20],
}
NAMED = {  # name ending in KEY / TOKEN / SECRET / PASSWORD -> the value that must disappear
    "SERVICE_API_KEY=": "plainvalue4417",
    "DEPLOY_TOKEN: ": "tok9988abcd",
    "CLIENT_SECRET = ": "s3cretvalue55",
    "DB_PASSWORD=": "hunter2hunter2",
}
NAMED_LOWER = {"api_key=": "lowercase7731", "password: ": "lowerpw4242"}  # note only: spec writes the names in capitals

items, comments = [], {}
n = 100
values = {}
for kind, v in SHAPES.items():  # one item per shape: key in the title, in the latest team comment header, and in an asking comment
    n += 1
    values[kind] = v
    labels = ["stage:building", "role:implementer"] + (["needs-human", "human:answer"] if n % 2 else [])
    items.append(item(n, f"Leak test {kind} {v}", labels))
    comments[n] = [comment(n, f"**Ian (implementer) → owner · question** {v}", f"see {v}",
                           {"from": "implementer", "to": "owner", "kind": "question", "human": "human:answer"}, minute=1),
                   comment(n, f"**Ella (engagement-lead) · note**", f"{v} handled it",
                           {"from": "engagement-lead", "to": "product-manager", "kind": "note"}, minute=2)]
for name, v in {**NAMED, **NAMED_LOWER}.items():
    n += 1
    values[name] = v
    items.append(item(n, f"Config {name}{v}", ["stage:spec", "role:product-manager", "needs-human", "human:answer"]))
    comments[n] = [comment(n, f"**Ella (engagement-lead) · note** {name}{v}", f"{name}{v} was set",
                           {"from": "engagement-lead", "to": "product-manager", "kind": "note"}, minute=1)]
# A key inside a link (every string the server sends, URLs included)
n += 1
url_key = "gh" + "p_" + (A + "zzzzzz")[1:37]
values["key in url"] = url_key
items.append(item(n, "Link test", ["stage:building", "role:implementer"], url=f"https://github.com/acme/garden/issues/{n}?t={url_key}"))

fx = Path(tempfile.mkdtemp()) / "fx.json"
write_fixture(fx, items, comments)
r = Result("AC6")
with Board(["--repo", "acme/garden"], fixture=fx, env_extra={"GITHUB_TOKEN": "x"}) as b:
    raw = b.get("/api/board").decode("utf-8")
    board = json.loads(raw)
    r.check(not board.get("error"), f"setup: board read fine (error={board.get('error')!r})")
    text = json.dumps(board, ensure_ascii=False)
    for kind, v in values.items():
        leaked = v in raw or v in text or v[:16] in text
        msg = f"AC6 {kind}: value never sent"
        if kind in NAMED_LOWER:
            print(("  ok   " if not leaked else "  note ") + msg + " (lower-case name, not required by the spec)")
            continue
        r.check(not leaked, msg)
    for kind in SHAPES:
        titles = [c.get("title", "") for col in board.get("columns", []) for c in col.get("cards", [])
                  if c.get("title", "").startswith(f"Leak test {kind} ")]
        ok = bool(titles) and all(re.search(r"\[hidden: [^\]]+\]", t) for t in titles)
        r.check(ok, f"AC6 {kind}: title shows a [hidden: <kind>] marker ({titles[:1]})")
r.done()
