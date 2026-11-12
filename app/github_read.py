"""Read the project's issues, pull requests and team comments from GitHub.

Read only. Sign-in comes from GITHUB_TOKEN or GH_TOKEN, or from the GitHub
command-line tool if it is installed and signed in. Nothing is ever written.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from typing import Any

API = "https://api.github.com"


class CantRead(Exception):
    """GitHub couldn't be read. The message is a plain sentence for the page."""


def find_token() -> str | None:
    for name in ("GITHUB_TOKEN", "GH_TOKEN"):
        if os.environ.get(name):
            return os.environ[name].strip()
    gh = shutil.which("gh")
    if gh:
        try:
            out = subprocess.run([gh, "auth", "token"], capture_output=True, text=True, timeout=10)
            if out.returncode == 0 and out.stdout.strip():
                return out.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            return None
    return None


def repo_from_git(folder: str = ".") -> str | None:
    """owner/name from the folder's git remote, if it points at GitHub."""
    try:
        out = subprocess.run(["git", "-C", folder, "remote", "get-url", "origin"],
                             capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return None
    url = out.stdout.strip()
    for marker in ("github.com/", "github.com:"):
        if marker in url:
            path = url.split(marker, 1)[1]
            path = path[:-4] if path.endswith(".git") else path
            parts = path.strip("/").split("/")
            if len(parts) >= 2:
                return f"{parts[0]}/{parts[1]}"
    return None


def _get(path: str, token: str | None) -> Any:
    req = urllib.request.Request(API + path, headers={
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "team-progress-board",
    })
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (401, 403) and e.headers.get("X-RateLimit-Remaining") == "0":
            raise CantRead("GitHub asked us to slow down. The board will try again in a few minutes.") from None
        if e.code == 401:
            raise CantRead("Your GitHub sign-in didn't work. Ask Ella to help you sign in again.") from None
        if e.code in (403, 404):
            raise CantRead("The board can't see this project on GitHub. It may be private and need you to sign in.") from None
        raise CantRead("GitHub had a problem just now. The board will try again soon.") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise CantRead("The board can't reach GitHub. Check your internet connection.") from None


def is_team_item(item: dict[str, Any]) -> bool:
    names = [lb.get("name", "") for lb in item.get("labels", [])]
    return any(n.startswith(("stage:", "role:", "human:")) or n == "needs-human" for n in names)


def read_project(repo: str, token: str | None) -> tuple[list[dict[str, Any]], dict[int, list[dict[str, Any]]]]:
    """Open team items, the last few finished ones, and the team comments on each."""
    items = _get(f"/repos/{repo}/issues?state=open&per_page=100", token)
    done = _get(f"/repos/{repo}/issues?state=closed&labels=stage:done&per_page=10&sort=updated", token)
    seen, picked = set(), []
    for it in list(items) + list(done):
        if it["number"] not in seen and is_team_item(it):
            seen.add(it["number"])
            picked.append(it)
    comments = {}
    for it in picked:
        if it.get("comments", 0):
            comments[it["number"]] = _get(f"/repos/{repo}/issues/{it['number']}/comments?per_page=100", token)
    return picked, comments
