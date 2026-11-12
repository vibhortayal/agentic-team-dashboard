#!/usr/bin/env python3
"""AC1-AC4 of docs/changes/8.md on hand-made GitHub data (no network)."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import Board, Result, all_cards, comment, find, item, write_fixture  # noqa: E402

def ev(frm, to, kind, **kw):
    return {"from": frm, "to": to, "kind": kind, **kw}

def say(needed):
    """The sentence shown for a needed item: the string itself, or its text field."""
    if isinstance(needed, dict):
        return needed.get("why") or needed.get("text")
    return needed


def shown_check(card):
    """The words the page shows for the check (check_words when the API carries a code in check)."""
    return card.get("check_words") or card.get("check")


I, C = [], {}
# --- AC1 ---
I.append(item(10, "Plan the watering page", ["stage:spec", "role:product-manager", "needs-human", "human:approve-spec"]))
C[10] = [
    comment(10, "**Priya (product-manager) → owner · question**", "Old question.",
            ev("product-manager", "owner", "question", human="human:approve-spec"), minute=1),
    comment(10, "**Priya (product-manager) → owner · question**", "Newer question, the one that asks.",
            ev("product-manager", "owner", "question", human="human:approve-spec"), minute=2),
    comment(10, "**Rohan (researcher) → Priya (product-manager) · report**", "Research is in.",
            ev("researcher", "product-manager", "report"), minute=3),
    comment(10, "thanks!", "plain human comment, not a team comment", None, minute=4, login="owner"),
]
I.append(item(11, "Watering page", ["stage:review", "role:product-manager", "needs-human", "human:merge"], pr=True))
I.append(item(12, "Pick a colour", ["stage:building", "role:architect", "needs-human", "human:answer"]))
C[12] = [comment(12, "**Arjun (architect) → Priya (product-manager) · question**", "Which colour?",
                 ev("architect", "product-manager", "question", human="human:answer"), minute=5)]
I.append(item(13, "Old closed thing", ["stage:done", "role:product-manager", "needs-human", "human:merge"], state="closed"))
# --- AC4 + AC3 ---
I.append(item(20, "Seed list", ["stage:building", "role:implementer"]))
C[20] = [comment(20, "**Vera (verifier) → Priya (product-manager) · verdict · PASS**", "All passed.",
                 ev("verifier", "product-manager", "verdict", verdict="PASS"), minute=1),
         comment(20, "**Vera (verifier) → Ian (implementer) · verdict · BLOCK**", "Breaks on empty list.",
                 ev("verifier", "implementer", "verdict", verdict="BLOCK"), minute=2),
         comment(20, "**Ian (implementer) → Vera (verifier) · handoff**", "Fixed, over to you.",
                 ev("implementer", "verifier", "handoff"), minute=3)]
I.append(item(21, "Seed photos", ["stage:verifying", "role:verifier"]))
C[21] = [comment(21, "**Vera (verifier) → Ian (implementer) · verdict · BLOCK**", "Photo missing.",
                 ev("verifier", "implementer", "verdict", verdict="BLOCK"), minute=1),
         comment(21, "**Vera (verifier) → Priya (product-manager) · verdict · PASS**", "All good now.",
                 ev("verifier", "product-manager", "verdict", verdict="PASS"), minute=2)]
I.append(item(22, "Footer", ["stage:done", "role:product-manager"]))
C[22] = [comment(22, "**Ian (implementer) → Vera (verifier) · handoff**", "verdict PASS expected, all green",
                 ev("implementer", "verifier", "handoff"), minute=1)]
I.append(item(23, "Header", ["stage:done", "role:product-manager"]))
C[23] = [comment(23, "**Vera (verifier) → Priya (product-manager) · verdict · PASS**", "ok",
                 ev("verifier", "product-manager", "verdict", verdict="PASS"), minute=1),
         comment(23, "**Vera (verifier) → Ian (implementer) · verdict · INCONCLUSIVE**", "logs missing",
                 ev("verifier", "implementer", "verdict", verdict="INCONCLUSIVE"), minute=2)]
I.append(item(24, "Login", ["stage:ready", "role:verifier"]))
I.append(item(25, "New idea", ["stage:intake", "role:engagement-lead"]))
I.append(item(26, "Hosting options", ["stage:research", "role:researcher"]))
# --- AC2 ---
I.append(item(30, "Typo fix", ["stage:building", "role:implementer"]))
C[30] = [comment(30, "**Ella (engagement-lead) · note**", "Older reason that should not show.",
                 ev("engagement-lead", "product-manager", "note"), minute=1),
         comment(30, "**Ella (engagement-lead) · note**", "Newer reason I handled myself.\nSecond line not the reason.",
                 ev("engagement-lead", "product-manager", "note"), minute=2)]
I.append(item(31, "Closed with a note", ["stage:done", "role:product-manager"], state="closed"))
C[31] = [comment(31, "**Ella (engagement-lead) · note**", "Closed-item note must not show.",
                 ev("engagement-lead", "product-manager", "note"), minute=1)]
I.append(item(32, "Not a note", ["stage:building", "role:implementer"]))
C[32] = [comment(32, "**Ella (engagement-lead) → Ian (implementer) · handoff**", "Handoff, not a note.",
                 ev("engagement-lead", "implementer", "handoff"), minute=1),
         comment(32, "**Vera (verifier) · note**", "Vera's note, not Ella's.",
                 ev("verifier", "product-manager", "note"), minute=2)]

fx = Path(tempfile.mkdtemp()) / "fx.json"
write_fixture(fx, I, C)
r = Result("AC1-AC4")
with Board(["--repo", "acme/garden"], fixture=fx, env_extra={"GITHUB_TOKEN": "x"}) as b:
    board = b.board()
    print(json.dumps(board, indent=1, ensure_ascii=False)[:200000], file=open(Path(fx).parent / "board.json", "w"))
    r.check(not board.get("error"), f"no error on good data (error={board.get('error')!r})")
    cards = all_cards(board)
    needed = board.get("needed", [])
    handled = board.get("handled", [])

    # AC1
    nums = sorted(e.get("number") for e in needed)
    r.check(nums == [10, 11, 12], f"AC1 'Waiting for you' holds exactly open needs-human items 10, 11, 12 (got {nums})")
    e10, e11, e12 = (find(needed, n) for n in (10, 11, 12))
    if e10 and e11 and e12:
        d10, d11, d12 = (json.dumps(e[0], ensure_ascii=False) for e in (e10, e11, e12))
        asking = C[10][1]["html_url"]
        r.check(asking in d10 and C[10][0]["html_url"] not in d10,
                f"AC1 #10 links the latest asking comment {asking} (entry {d10})")
        r.check(C[12][0]["html_url"] in d12, f"AC1 #12 links the comment with a human field (entry {d12})")
        r.check("/pull/11" in d11 and "#issuecomment" not in d11, f"AC1 #11 with no comment links the item itself (entry {d11})")
        sentences = [say(e[0].get("needed")) for e in (e10, e11, e12)]
        r.check(all(isinstance(s, str) and len(s.split()) >= 3 for s in sentences),
                f"AC1 each has a plain sentence in 'needed' ({sentences})")
        r.check(len(set(sentences)) == 3, "AC1 the three human: labels get three different sentences")
        bad = [s for s in sentences if isinstance(s, str) and any(t in s for t in ("human:", "needs-human", "approve-spec", "stage:"))]
        r.check(not bad, f"AC1 sentences contain no label names ({bad})")

    # AC3
    titles = [c.get("title") for c in board.get("columns", [])]
    want = ["Getting ready", "Ready to build", "Being built", "Being checked", "Waiting for you", "Done"]
    r.check(titles == want, f"AC3 columns are the six everyday words in order (got {titles})")
    col_of = {c["number"]: col.get("title") for col in board.get("columns", []) for c in col.get("cards", [])}
    expect_col = {25: "Getting ready", 26: "Getting ready", 10: "Getting ready", 24: "Ready to build",
                  20: "Being built", 12: "Being built", 21: "Being checked", 11: "Waiting for you",
                  22: "Done", 23: "Done"}
    for n, t in expect_col.items():
        r.check(col_of.get(n) == t, f"AC3 #{n} is under '{t}' (got {col_of.get(n)!r})")
    expect_holder = {20: "Ian", 21: "Vera", 24: "Vera", 25: "Ella", 26: "Rohan", 12: "Arjun", 10: "Priya"}
    for n, p in expect_holder.items():
        c = find(cards, n)
        h = c[0].get("holder") if c else None
        r.check(isinstance(h, str) and p in h and ":" not in h and "-" not in h,
                f"AC3 #{n} holder names {p} (got {h!r})")
    c10 = find(cards, 10)
    u = c10[0].get("update") if c10 else None
    r.check(isinstance(u, str) and "Rohan" in u and "Research is in" not in u and "thanks" not in u,
            f"AC3 #10 update is the header of the latest team comment (Rohan's), not a human comment (got {u!r})")
    c20 = find(cards, 20)
    u = c20[0].get("update") if c20 else None
    r.check(isinstance(u, str) and "Ian" in u and "Vera" in u, f"AC3 #20 update is Ian's handoff header (got {u!r})")

    # AC4
    expect_check = {20: "Checked: needs fixes", 21: "Checked: passed", 22: "Not checked yet",
                    23: "Not checked yet", 24: "Not checked yet", 25: "Not checked yet"}
    for n, v in expect_check.items():
        c = find(cards, n)
        got = shown_check(c[0]) if c else None
        r.check(got == v, f"AC4 #{n} shows {v!r} (got {got!r})")
    passed = [c["number"] for c in cards if shown_check(c) == "Checked: passed"]
    r.check(passed == [21], f"AC4 only #21 shows 'Checked: passed' (got {passed})")

    # AC2
    hn = sorted(e.get("number") for e in handled)
    r.check(hn == [30], f"AC2 'Ella handled these herself' holds only #30 (got {hn})")
    h30 = find(handled, 30)
    if h30:
        d = json.dumps(h30[0], ensure_ascii=False)
        r.check("Newer reason I handled myself" in d, f"AC2 #30 reason is the latest note's first line ({d})")
        r.check("Older reason" not in d and "Second line" not in d, "AC2 #30 shows only the latest note's first line")
r.done()
