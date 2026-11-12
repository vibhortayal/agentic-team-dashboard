"""Hide secrets before anything reaches the screen.

Every string the board sends to the page goes through mask(). Known key shapes
become "[hidden: <kind>]". A value written after a name that ends in KEY, TOKEN,
SECRET or PASSWORD is hidden too, because many keys have no telltale prefix.
If masking a line fails for any reason, the whole line is hidden.
"""
from __future__ import annotations

import re

HIDDEN_LINE = "[hidden: this line may hold a secret]"

# (kind, pattern). Order matters: longer, more specific shapes first.
SHAPES: list[tuple[str, re.Pattern[str]]] = [
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)", re.S)),
    ("github token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}")),
    ("github token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}")),
    ("anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_\-]{20,}")),
    ("openai key", re.compile(r"\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_\-]{20,}")),
    ("stripe key", re.compile(r"\b(?:sk|rk|pk|whsec)_(?:live|test)_[A-Za-z0-9]{10,}")),
    ("stripe key", re.compile(r"\bwhsec_[A-Za-z0-9]{20,}")),
    ("aws key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("google key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}")),
    ("slack token", re.compile(r"\bxox[abposr]-[A-Za-z0-9\-]{10,}")),
    ("gitlab token", re.compile(r"\bglpat-[A-Za-z0-9_\-]{20,}")),
    ("npm token", re.compile(r"\bnpm_[A-Za-z0-9]{36}")),
    ("supabase key", re.compile(r"\bsbp_[A-Za-z0-9]{40}")),
    ("resend key", re.compile(r"\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}")),
    ("vercel token", re.compile(r"\bvercel_[A-Za-z0-9_\-]{20,}")),
    ("web token", re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")),
    ("password in a link", re.compile(r"(?<=://)[^/\s:@]+:[^/\s@]+(?=@)")),
]

# NAME=value, NAME: value, "name": "value" where the name ends in a secret word.
NAMED = re.compile(
    r"""(?ix)
    (\b[A-Za-z0-9_.\-]*(?:key|token|secret|password|passwd|pwd)["']?\s*[:=]\s*)
    (["']?)
    ([^\s"',;]{4,})
    """
)

# Values after a secret name that are plainly not secrets.
HARMLESS = {"none", "null", "true", "false", "unset", "empty", "n/a", "required", "set", "missing"}


def _named(m: re.Match[str]) -> str:
    value = m.group(3)
    if value.lower() in HARMLESS or value.startswith("[hidden"):
        return m.group(0)
    return f"{m.group(1)}{m.group(2)}[hidden: secret]"


def _mask_line(line: str) -> str:
    for kind, pattern in SHAPES:
        line = pattern.sub(f"[hidden: {kind}]", line)
    return NAMED.sub(_named, line)


def mask(text: object) -> str:
    """Return text with every secret hidden. Never raises."""
    if text is None:
        return ""
    s = str(text)
    # Private keys span lines, so hide them before splitting.
    try:
        s = SHAPES[0][1].sub("[hidden: private key]", s)
    except Exception:  # noqa: BLE001 - fail closed below
        return HIDDEN_LINE
    out = []
    for line in s.split("\n"):
        try:
            out.append(_mask_line(line))
        except Exception:  # noqa: BLE001 - hide the whole line rather than risk showing it
            out.append(HIDDEN_LINE)
    return "\n".join(out)


def mask_tree(value: object) -> object:
    """Mask every string inside dicts and lists (keys are left alone)."""
    if isinstance(value, str):
        return mask(value)
    if isinstance(value, list):
        return [mask_tree(v) for v in value]
    if isinstance(value, dict):
        return {k: mask_tree(v) for k, v in value.items()}
    return value
