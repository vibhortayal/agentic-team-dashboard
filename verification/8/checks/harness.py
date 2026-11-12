"""Shared helpers for the #8 checks (not a check itself: run-checks.sh skips non-executable .py files).

The board runs as a real process. A small runner (this file, run as a script) replaces only the
network: urllib's urlopen serves a fixture file (re-read on every call, so a check can change it
mid-run), and any socket connect to a non-loopback address is refused and logged. Then app/board.py
runs as __main__ with the given arguments. Nothing reaches the internet.
"""
from __future__ import annotations

import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / "app" / "board.py"
ROLES = {"engagement-lead": "Ella", "product-manager": "Priya", "researcher": "Rohan", "critic": "Quinn",
         "architect": "Arjun", "implementer": "Ian", "verifier": "Vera", "evaluator": "Max",
         "budget-analyst": "Bea", "ops": "Otto"}
REPO = "acme/garden"
GH = "https://github.com/" + REPO


# ---------- building GitHub-shaped data ----------

def item(number, title, labels, state="open", pr=False, comments=0, url=None):
    it = {"number": number, "title": title, "labels": [{"name": n} for n in labels], "state": state,
          "html_url": url or f"{GH}/{'pull' if pr else 'issues'}/{number}",
          "updated_at": "2026-11-10T10:00:00Z", "comments": comments, "user": {"login": "owner"}}
    if pr:
        it["pull_request"] = {"url": ""}
    return it


_cid = [1000]


def comment(number, header, body, event=None, minute=0, login="team-bot"):
    """A team comment when event is a dict; a plain human comment when event is None."""
    _cid[0] += 1
    text = header + "\n\n" + body
    if event is not None:
        text += "\n\n<!-- team-event " + json.dumps(event) + " -->"
    return {"id": _cid[0], "html_url": f"{GH}/issues/{number}#issuecomment-{_cid[0]}", "body": text,
            "user": {"login": login}, "created_at": f"2026-11-11T10:{minute:02d}:00Z",
            "updated_at": f"2026-11-11T10:{minute:02d}:00Z"}


def write_fixture(path, items, comments, fail=None):
    for it in items:
        it["comments"] = len(comments.get(it["number"], []))
    Path(path).write_text(json.dumps({"items": items, "comments": {str(k): v for k, v in comments.items()},
                                      "fail": fail}))


# ---------- running the board ----------

def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Board:
    def __init__(self, args, fixture=None, env_extra=None):
        self.tmp = Path(tempfile.mkdtemp(prefix="v8-"))
        self.log = self.tmp / "net.log"
        self.calls = self.tmp / "calls.log"
        self.port = free_port()
        bindir = self.tmp / "bin"
        bindir.mkdir()
        for tool in ("gh", "git"):  # sign-in tools that fail and leave a trace
            f = bindir / tool
            f.write_text(f"#!/bin/sh\necho {tool} \"$@\" >> {self.tmp}/tools.log\nexit 1\n")
            f.chmod(0o755)
        env = {k: v for k, v in os.environ.items()
               if k not in ("GITHUB_TOKEN", "GH_TOKEN") and not k.lower().endswith("_proxy")}
        env["PATH"] = f"{bindir}:/usr/bin:/bin"
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env.update(env_extra or {})
        cmd = [sys.executable, __file__, str(fixture or "-"), str(self.log), str(self.calls), "--",
               *args, "--port", str(self.port), "--no-open"]
        self.out = open(self.tmp / "stdout.log", "w")
        self.proc = subprocess.Popen(cmd, cwd=self.tmp, env=env, stdout=self.out, stderr=subprocess.STDOUT)
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                socket.create_connection(("127.0.0.1", self.port), timeout=0.5).close()
                return
            except OSError:
                if self.proc.poll() is not None:
                    break
                time.sleep(0.1)
        self.stop()
        raise SystemExit(f"board did not start: {(self.tmp / 'stdout.log').read_text()}")

    def get(self, path, host=None):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}",
                                     headers={"Host": host or f"localhost:{self.port}"})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=20) as r:
            return r.read()

    def board(self, refresh=False):
        return json.loads(self.get("/api/board" + ("?refresh=1" if refresh else "")))

    def net_attempts(self):
        return self.log.read_text().splitlines() if self.log.exists() else []

    def api_calls(self):
        return self.calls.read_text().splitlines() if self.calls.exists() else []

    def stop(self):
        self.proc.terminate()
        try:
            self.proc.wait(5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.out.close()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.stop()


# ---------- reading the board ----------

def all_cards(b):
    return [c for col in b.get("columns", []) for c in col.get("cards", [])]


def find(entries, number):
    return [e for e in entries if e.get("number") == number]


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v)


class Result:
    def __init__(self, name):
        self.name, self.fails, self.n = name, [], 0

    def check(self, ok, what):
        self.n += 1
        print(("  ok   " if ok else "  FAIL ") + what)
        if not ok:
            self.fails.append(what)

    def done(self):
        print(f"{self.name}: {self.n - len(self.fails)}/{self.n} passed")
        sys.exit(1 if self.fails else 0)


# ---------- the runner (this file run as a script) ----------

class _Resp(io.BytesIO):
    status = 200
    headers = {}

    def getcode(self):
        return 200

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def _runner():
    fixture, netlog, calllog = sys.argv[1], sys.argv[2], sys.argv[3]
    args = sys.argv[sys.argv.index("--") + 1:]

    real_connect = socket.socket.connect

    def guarded_connect(self, address):
        host = address[0] if isinstance(address, tuple) else str(address)
        if isinstance(address, tuple) and host not in ("127.0.0.1", "::1", "localhost"):
            with open(netlog, "a") as f:
                f.write(f"connect {address}\n")
            raise OSError("network disabled by verifier harness")
        return real_connect(self, address)

    socket.socket.connect = guarded_connect

    def fake_urlopen(req, *a, **k):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        with open(calllog, "a") as f:
            f.write(url + "\n")
        u = urllib.parse.urlparse(url)
        if u.hostname not in ("api.github.com",) or fixture == "-":
            with open(netlog, "a") as f:
                f.write(f"urlopen {url}\n")
            raise urllib.error.URLError("network disabled by verifier harness")
        data = json.loads(Path(fixture).read_text())
        fail = data.get("fail")
        import email.message
        hdrs = email.message.Message()
        if fail == "network":
            raise urllib.error.URLError("no route")
        if fail == "timeout":
            raise TimeoutError("timed out")
        if fail == "ratelimit":
            hdrs["X-RateLimit-Remaining"] = "0"
            raise urllib.error.HTTPError(url, 403, "rate limit", hdrs, io.BytesIO(b'{"message":"API rate limit exceeded"}'))
        if isinstance(fail, int):
            raise urllib.error.HTTPError(url, fail, "fail", hdrs, io.BytesIO(b'{"message":"Bad credentials"}'))
        q = urllib.parse.parse_qs(u.query)
        parts = u.path.strip("/").split("/")
        if len(parts) == 4 and parts[3] == "issues":
            state = q.get("state", ["open"])[0]
            want = q.get("labels", [""])[0]
            out = [i for i in data["items"] if state == "all" or i["state"] == state]
            if want:
                out = [i for i in out if all(w in [l["name"] for l in i["labels"]] for w in want.split(","))]
            return _Resp(json.dumps(out).encode())
        if len(parts) == 6 and parts[3] == "issues" and parts[5] == "comments":
            return _Resp(json.dumps(data["comments"].get(parts[4], [])).encode())
        raise urllib.error.HTTPError(url, 404, "not found", hdrs, io.BytesIO(b'{"message":"Not Found"}'))

    import urllib.error  # noqa: F401
    urllib.request.urlopen = fake_urlopen
    sys.argv = [str(APP), *args]
    import runpy
    runpy.run_path(str(APP), run_name="__main__")


if __name__ == "__main__":
    import urllib.error
    _runner()
