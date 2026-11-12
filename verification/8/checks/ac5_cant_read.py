#!/usr/bin/env python3
"""AC5 (GitHub can't be read) and section 7 (one GitHub read per minute at most). The board's clock is stepped forward, so there is no real wait."""
import json
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import Board, Result, all_cards, item, write_fixture  # noqa: E402

r = Result("AC5/read rate")
tmp = Path(tempfile.mkdtemp())
items = [item(1, "Seed list", ["stage:building", "role:implementer"]),
         item(2, "Plan", ["stage:spec", "role:product-manager", "needs-human", "human:approve-spec"])]
JARGON = re.compile(r"HTTP|\b40[0-9]\b|\b50[0-9]\b|\{|Traceback|Error:|URLError|api\.github|token", re.I)


def plain_error(board, why):
    err = board.get("error")
    r.check(isinstance(err, str) and err.strip() != "", f"AC5 {why}: page gets an error sentence ({err!r})")
    if isinstance(err, str):
        r.check(not JARGON.search(err), f"AC5 {why}: sentence has no codes or jargon ({err!r})")
        n = len(re.findall(r"[.!?](\s|$)", err.strip()))
        print(f"  note sentences in message: {n}")
    r.check(board.get("repo") == "acme/garden", f"AC5 {why}: repo still given so the page can link it ({board.get('repo')!r})")
    r.check(all_cards(board) == [] and not board.get("needed") and not board.get("handled"),
            f"AC5 {why}: no cards shown as current")


for fail, why in (("network", "no network"), ("timeout", "timeout"), (401, "bad sign-in"),
                  ("ratelimit", "rate limit"), (404, "private/not found"), (500, "GitHub error")):
    fx = tmp / f"fx-{fail}.json"
    write_fixture(fx, items, {}, fail=fail)
    with Board(["--repo", "acme/garden"], fixture=fx, env_extra={"GITHUB_TOKEN": "x"}) as b:
        plain_error(b.board(), why)

# No sign-in at all: no token, gh stub fails. The board may still try GitHub unauthenticated; with a 404 it must say so.
fx = tmp / "fx-nosign.json"
write_fixture(fx, items, {}, fail=404)
with Board(["--repo", "acme/garden"], fixture=fx) as b:
    plain_error(b.board(), "no sign-in")

# Stale data: read fine, then GitHub fails. After the cache is due again, old cards must not show as current.
fx = tmp / "fx-stale.json"
write_fixture(fx, items, {})
with Board(["--repo", "acme/garden"], fixture=fx, env_extra={"GITHUB_TOKEN": "x"}) as b:
    first = b.board()
    r.check(len(all_cards(first)) == 2 and not first.get("error"), "AC5 setup: first read shows 2 cards")
    reads0 = sum("/issues?" in u for u in b.api_calls())
    # Section 7: a refresh inside the minute must not read GitHub again (12 s, and at the limit, 59 s).
    for at, step in ((12, 12), (59, 47)):
        b.advance(step)
        b.board(refresh=True)
        b.board()
        reads1 = sum("/issues?" in u for u in b.api_calls())
        r.check(reads1 == reads0, f"7 one GitHub read per minute at most: refresh {at} s after a read "
                                  f"(open+closed issue-list calls {reads0} -> {reads1})")
    write_fixture(fx, items, {}, fail="network")
    b.advance(3)  # 62 s after the good read: the cache is due again
    later = b.board()
    plain_error(later, "failure after a good read")
r.done()
