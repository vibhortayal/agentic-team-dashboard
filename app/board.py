"""The progress board: a page on your own computer that shows where your project stands.

    python3 app/board.py            # read this folder's GitHub project
    python3 app/board.py --demo     # sample data, no sign-in needed

It only reads GitHub and only listens on this computer (127.0.0.1).
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import github_read  # noqa: E402
from model import build_board, error_board  # noqa: E402

STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/board.css": ("board.css", "text/css; charset=utf-8"),
    "/board.js": ("board.js", "text/javascript; charset=utf-8"),
}
CACHE_SECONDS = 60


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Source:
    """Where board data comes from, with a one-minute cache so GitHub is read gently."""

    def __init__(self, repo: str | None, demo: bool):
        self.repo, self.demo = repo or "", demo
        self._lock = threading.Lock()
        self._at, self._board = 0.0, None

    def board(self, refresh: bool = False) -> dict:
        with self._lock:
            age = time.time() - self._at
            if self._board is None or (refresh and age > 10) or age > CACHE_SECONDS:
                self._board, self._at = self._read(), time.time()
            return self._board

    def _read(self) -> dict:
        if self.demo:
            data = json.loads((HERE / "demo.json").read_text(encoding="utf-8"))
            comments = {int(k): v for k, v in data["comments"].items()}
            return build_board(data["repo"], data["items"], comments, now())
        if not self.repo:
            return error_board("", now(), "The board doesn't know which project to show. Start it from your project's folder.")
        try:
            items, comments = github_read.read_project(self.repo, github_read.find_token())
        except github_read.CantRead as e:
            return error_board(self.repo, now(), str(e))
        return build_board(self.repo, items, comments, now())


def make_handler(source: Source, port: int):
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):  # keep the window quiet
            pass

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy",
                             "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):  # noqa: N802 - http.server's name
            # Only answer pages opened on this computer by name, so other websites can't read it.
            if self.headers.get("Host") not in allowed_hosts:
                return self._send(403, b"Forbidden", "text/plain")
            path, _, query = self.path.partition("?")
            if path == "/api/board":
                board = source.board(refresh="refresh=1" in query)
                return self._send(200, json.dumps(board).encode("utf-8"), "application/json")
            if path in STATIC:
                name, ctype = STATIC[path]
                return self._send(200, (HERE / "static" / name).read_bytes(), ctype)
            return self._send(404, b"Not found", "text/plain")

    return Handler


def serve(source: Source, port: int, open_browser: bool) -> None:
    for p in range(port, port + 10):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", p), make_handler(source, p))
            break
        except OSError:
            continue
    else:
        sys.exit(f"Ports {port} to {port + 9} are all busy. Close another copy of the board and try again.")
    url = f"http://localhost:{p}"
    print(f"Your progress board is open at {url}  (press Ctrl+C to stop it)")
    if open_browser:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBoard stopped.")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="Show your project's progress board on this computer.")
    ap.add_argument("--repo", help="owner/name on GitHub (default: this folder's GitHub project)")
    ap.add_argument("--demo", action="store_true", help="show sample data, no sign-in needed")
    ap.add_argument("--port", type=int, default=4321)
    ap.add_argument("--no-open", action="store_true", help="don't open the browser")
    a = ap.parse_args(argv)
    repo = a.repo or (None if a.demo else github_read.repo_from_git())
    serve(Source(repo, a.demo), a.port, not a.no_open)


if __name__ == "__main__":
    main()
