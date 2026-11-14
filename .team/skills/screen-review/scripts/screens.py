#!/usr/bin/env python3
"""Screenshot pages at phone and desktop width, in light and dark, and log console errors.

  screens.py --url http://localhost:5173 --out verification/42/screens [--path / --path /settings]
             [--wait-for SELECTOR] [--state empty]

Writes <out>/<state>-<page>-<phone|desktop>-<light|dark>.png and <out>/console.txt.
Exit code 1 if a page fails to load or logs a console error, so a run can't
look clean when it isn't. Needs Python Playwright with Chromium installed.
"""
import argparse, os, re, sys

WIDTHS = {"phone": (390, 844), "desktop": (1440, 900)}
SCHEMES = ("light", "dark")


def name_for(path):
    return re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-") or "home"


def main(argv):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--url", required=True, help="base address, e.g. http://localhost:5173 or the preview URL")
    p.add_argument("--out", required=True, help="folder for the screenshots")
    p.add_argument("--path", action="append", default=None, help="page path, repeatable (default /)")
    p.add_argument("--wait-for", help="CSS selector that means the page is ready")
    p.add_argument("--state", default="default", help="label for this run: default, empty, loading, error ...")
    a = p.parse_args(argv)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Python Playwright isn't installed. Install it in the project's dev tooling, not on the host.")

    os.makedirs(a.out, exist_ok=True)
    log, failed = [], False
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        for path in a.path or ["/"]:
            for width, (w, h) in WIDTHS.items():
                for scheme in SCHEMES:
                    ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme=scheme)
                    page = ctx.new_page()
                    tag = "%s %s %s %s" % (a.state, path, width, scheme)
                    # Failed requests are logged with their address below, so skip the browser's vaguer console copy.
                    page.on("console", lambda m, tag=tag: m.type == "error" and not m.text.startswith("Failed to load resource")
                            and log.append("%s: console error: %s" % (tag, m.text)))
                    page.on("response", lambda r, tag=tag: r.status >= 400 and not r.url.endswith("/favicon.ico")
                            and log.append("%s: HTTP %d %s" % (tag, r.status, r.url)))
                    page.on("pageerror", lambda e, tag=tag: log.append("%s: page error: %s" % (tag, e)))
                    try:
                        page.goto(a.url.rstrip("/") + path, wait_until="networkidle", timeout=30000)
                        if a.wait_for:
                            page.wait_for_selector(a.wait_for, timeout=15000)
                        shot = os.path.join(a.out, "%s-%s-%s-%s.png" % (a.state, name_for(path), width, scheme))
                        page.screenshot(path=shot, full_page=True)
                        print(shot)
                    except Exception as e:  # report every page, then fail at the end
                        log.append("%s: failed to load: %s" % (tag, e))
                    ctx.close()
        browser.close()
    with open(os.path.join(a.out, "console.txt"), "a", encoding="utf-8") as f:
        for line in log or ["%s: no console errors" % a.state]:
            f.write(line + "\n")
    for line in log:
        print(line, file=sys.stderr)
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
