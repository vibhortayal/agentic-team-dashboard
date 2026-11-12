#!/usr/bin/env python3
"""AC9 headless part: the page's own words and every board string except titles (the user's own words)
carry no label names, JSON or GitHub jargon. The rendered first screen is judged from screenshots."""
import html.parser
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import Board, Result, ROLES  # noqa: E402

LABELS = r"needs-human|stage:|role:|human:|blocker:|class:trivial|mode:ticket|" + "|".join(map(re.escape, ROLES))
JARGON = r"\bpull request\b|\bPR\b|\bissue\b|\blabels?\b|\brepo(sitory)?\b|\bcommit\b|\bbranch\b|\bmerge\b|" \
         r"\bverdict\b|\bBLOCK\b|\bPASS\b|\bINCONCLUSIVE\b|team-event|\bJSON\b|\bAPI\b|[{}\[\]]"
BAD = re.compile(f"({LABELS}|{JARGON})")


class Text(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        for k, v in attrs:
            if k in ("title", "aria-label", "alt", "placeholder") and v:
                self.out.append(v)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1

    def handle_data(self, d):
        if not self.skip and d.strip():
            self.out.append(d.strip())


def shown_strings(board):
    """Strings the page may show: skip titles, links, keys, times and codes."""
    skip = {"title", "url", "update_url", "key", "column", "kind", "check", "updated", "update_at", "repo", "closed"}
    out = []

    def walk(o, k=None):
        if isinstance(o, dict):
            for kk, v in o.items():
                if kk not in skip:
                    walk(v, kk)
        elif isinstance(o, list):
            for v in o:
                walk(v, k)
        elif isinstance(o, str) and not o.startswith("http"):
            out.append((k, o))
    walk(board)
    return out


r = Result("AC9")
with Board(["--demo"]) as b:
    t = Text()
    t.feed(b.get("/").decode("utf-8"))
    for s in t.out:
        m = BAD.search(s)
        r.check(not m, f"page text {s!r} has no jargon" + (f" (found {m.group(0)!r})" if m else ""))
    for k, s in shown_strings(b.board()):
        m = BAD.search(s)
        r.check(not m, f"board text [{k}] {s!r} has no jargon" + (f" (found {m.group(0)!r})" if m else ""))
r.done()
