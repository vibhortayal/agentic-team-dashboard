#!/usr/bin/env python3
"""AC7 (demo with no network, no sign-in), AC8 (127.0.0.1 only) and the section 8 data model."""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import ROOT, Board, Result, all_cards, free_port  # noqa: E402

r = Result("AC7/AC8/data model")


def listeners(port):
    """Local addresses with a LISTEN socket on this port, from /proc/net/tcp and tcp6."""
    out = []
    for f in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            lines = Path(f).read_text().splitlines()[1:]
        except OSError:
            continue
        for ln in lines:
            parts = ln.split()
            addr, p = parts[1].rsplit(":", 1)
            if int(p, 16) == port and parts[3] == "0A":
                out.append((f, addr))
    return out


# AC7 + AC8 through the harness (network refused and logged, gh/git stubs fail, no tokens)
with Board(["--demo"]) as b:
    board = b.board()
    cards = all_cards(board)
    r.check(not board.get("error"), f"AC7 demo has no error (error={board.get('error')!r})")
    r.check(len(cards) >= 3 and len(board.get("needed", [])) >= 1,
            f"AC7 demo shows sample cards ({len(cards)}) and something waiting for you ({len(board.get('needed', []))})")
    page = b.get("/")
    r.check(b"<html" in page.lower() or b"<!doctype" in page.lower(), "AC7 the page itself is served")
    r.check(b.net_attempts() == [], f"AC7 no network attempt in demo mode ({b.net_attempts()})")
    tools = (b.tmp / "tools.log")
    r.check(not tools.exists(), f"AC7 no sign-in tool (gh/git) called in demo mode ({tools.read_text() if tools.exists() else ''})")

    ls = listeners(b.port)
    r.check(bool(ls) and all(a == "0100007F" for _, a in ls),
            f"AC8 every listening socket on port {b.port} is 127.0.0.1 ({ls})")
    # Try the machine's other addresses: none may answer.
    others = set()
    try:
        for fam, *_, sa in socket.getaddrinfo(socket.gethostname(), None):
            if not sa[0].startswith("127.") and sa[0] != "::1":
                others.add(sa[0])
    except OSError:
        pass
    for ip in sorted(others):
        try:
            socket.create_connection((ip, b.port), timeout=1).close()
            r.check(False, f"AC8 port answers on non-loopback {ip}")
        except OSError:
            r.check(True, f"AC8 port refuses on non-loopback {ip}")

    # Section 8: /api/board shape
    for k in ("repo", "updated", "error", "needed", "handled", "columns"):
        r.check(k in board, f"data model: /api/board has '{k}'")
    for col in board.get("columns", []):
        r.check({"key", "title", "cards"} <= set(col), f"data model: column has key/title/cards ({sorted(col)})")
        break
    if cards:
        missing = [k for k in ("number", "title", "url", "kind", "stage", "holder", "update", "check", "needed")
                   if k not in cards[0]]
        r.check(not missing, f"data model: card has number,title,url,kind,stage,holder,update,check,needed (missing {missing})")

# AC7 literally as written: python3 app/board.py --demo (port given so CI can run it in parallel safely)
port = free_port()
env = {k: v for k, v in os.environ.items() if k not in ("GITHUB_TOKEN", "GH_TOKEN")}
p = subprocess.Popen([sys.executable, "app/board.py", "--demo", "--no-open", "--port", str(port)], cwd=ROOT,
                     env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    body = None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(100):
        try:
            body = json.loads(opener.open(f"http://localhost:{port}/api/board", timeout=2).read())
            break
        except OSError:
            time.sleep(0.1)
    r.check(bool(body) and not body.get("error") and all_cards(body),
            "AC7 `python3 app/board.py --demo` serves the sample board")
finally:
    p.terminate()
    p.wait(5)
r.done()
