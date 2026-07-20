# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
#!/usr/bin/env python3
"""WayChain precompile-drift guard.

Detects when the protocol precompile table changed (vs the base/merge ref) and
enforces the founder rule: "hold merge until downstream issues are created".

Behaviour
---------
1. Extract the precompile address set from consensus/evm/precompiles.go at the
   base ref and at HEAD.
2. If unchanged -> exit 0 (no drift, PR check passes, no issues required).
3. If changed -> scan user-facing frontend files (site/**, mobile/src/**) for
   STALE references to the OLD count/range (e.g. "27 precompiles", "0x0C-0x26",
   en-dash variant, "0x0C..0x26", or a bogus WIFR->0x21 mapping).
4. If stale files are found:
     - Look for an OPEN issue labelled `drift` that already references this
       change (the new address(es) and/or the PR number). If present -> exit 0
       (the PR is reconciled; the issue stays open until a human fixes + closes).
     - Else AUTO-CREATE a `drift` issue enumerating the stale files, link the PR,
       and exit 1 -> the PR status check FAILS (merge held) until the next run
       finds the issue exists.

This is the "auto-creates frontend-update issues when precompiles change and
holds the PR until those issues exist" rule. CI runs it on every PR.

Requires: git (fetch-depth:0), gh CLI authenticated via GITHUB_TOKEN, and the
repo to have a `drift` label.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(os.environ.get("GITHUB_WORKSPACE", ".")).resolve()
GIT = ["git", "-C", str(ROOT)]
PRECOMPILE_SRC = "consensus/evm/precompiles.go"

# Frontend surfaces that must stay reconciled with protocol-manifest.json.
FRONTEND_GLOBS = [
    "site/**/*.html",
    "site/**/*.js",
    "site/**/*.json",
    "site/**/*.ts",
    "mobile/src/**/*.js",
    "mobile/src/**/*.ts",
    "mobile/src/**/*.tsx",
]


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def precompile_addrs(ref: str) -> dict[str, str]:
    """Return {addr_hex: name} parsed from precompiles.go at `ref`."""
    p = run(GIT + ["show", f"{ref}:{PRECOMPILE_SRC}"])
    if p.returncode != 0:
        # ref may not have the file (e.g. first import) -> treat as empty
        return {}
    text = p.stdout
    block = re.search(
        r"var PrecompilesTable = map\[byte\]\*Precompile\{(.*?)\n\}", text, re.S
    )
    if not block:
        return {}
    body = block.group(1)
    out: dict[str, str] = {}
    for m in re.finditer(r"^\s*0x([0-9A-Fa-f]{2}):\s*\{", body, re.M):
        addr = "0x" + m.group(1).upper()
        sub = body[m.start() : m.start() + 400]
        nm = re.search(r'Name:\s*"([^"]+)"', sub)
        out[addr] = nm.group(1) if nm else "?"
    return out


def find_stale_files(base_addrs: dict[str, str], head_addrs: dict[str, str]) -> list[dict]:
    """Return list of {file, reasons[]} for frontend files referencing stale data."""
    base_count = len(base_addrs)
    head_count = len(head_addrs)
    base_range = f"0x0C-0x{base_addrs and list(base_addrs)[-1][2:].lower() or '??'}"
    head_range = f"0x0C-0x{head_addrs and list(head_addrs)[-1][2:].lower() or '??'}"

    stale: list[dict] = []
    import glob

    files: set[str] = set()
    for pat in FRONTEND_GLOBS:
        files.update(glob.glob(str(ROOT / pat), recursive=True))
    # exclude node_modules
    files = {f for f in files if "node_modules" not in f}

    # Old-range patterns to flag (hyphen, en-dash U+2013, double-dot).
    old_range_patterns = [
        re.escape(base_range),
        re.escape(base_range.replace("-", "–")),  # en dash
        re.escape(base_range.replace("-", "..")),
    ]
    # Old-count tokens in a precompile context.
    old_count_token = str(base_count)

    for f in sorted(files):
        try:
            text = Path(f).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        reasons: list[str] = []
        for pat in old_range_patterns:
            if re.search(pat, text):
                reasons.append(f"references stale range '{base_range}' (now {head_range})")
                break
        # count token like "27 precompiles" / "27 native" / "27 @"
        if re.search(rf"\b{old_count_token}\b\s*(precompiles|native|@)", text, re.I):
            reasons.append(f"references stale count {old_count_token} (now {head_count})")
        if '"precompiles"' in text and re.search(rf'"precompiles"\s*:\s*{old_count_token}', text):
            reasons.append(f"version.json precompiles == {old_count_token} (now {head_count})")
        # Explicit bogus WIFR->0x21 mapping (0x21 is Keccak256).
        if re.search(r"WIFR\s*:\s*precompileAddress\(\s*['\"]0x21['\"]\s*\)", text):
            reasons.append("WIFR mapped to 0x21 (0x21 is Keccak256; WIFR is not a WayChain precompile)")
        if reasons:
            stale.append({"file": str(Path(f).relative_to(ROOT)), "reasons": reasons})
    return stale


def existing_drift_issue_satisfied(changed_addrs: set[str], pr_number: str | None) -> bool:
    """True if an open `drift` issue already tracks this change.

    Satisfied when an open drift issue mentions at least one of the CHANGED
    addresses (added/removed/renamed) or the PR number. This prevents the CI
    from auto-creating duplicate issues when reconciliation issues were filed
    ahead of the PR (issue-first discipline).
    """
    if not changed_addrs and not pr_number:
        return False
    p = run([
        "gh", "issue", "list", "--label", "drift", "--state", "open",
        "--json", "number,body,title",
    ])
    if p.returncode != 0:
        return False
    try:
        issues = json.loads(p.stdout)
    except Exception:
        return False
    needles = {a.lower() for a in changed_addrs}
    if pr_number:
        needles.add(f"#{pr_number}".lower())
    for it in issues:
        hay = (it.get("title", "") + "\n" + it.get("body", "")).lower()
        if any(n in hay for n in needles):
            return True
    return False


def auto_create_issue(stale, changed_summary, pr_number, base_ref, head_ref):
    lines = [
        "## Precompile drift detected by CI (auto-filed)",
        "",
        f"**Base:** `{base_ref}`  **Head:** `{head_ref}`",
        "",
        "### Protocol change",
        changed_summary,
        "",
        "### Frontend files with stale references (must be reconciled vs protocol-manifest.json)",
        "",
    ]
    for s in stale:
        lines.append(f"- `{s['file']}`")
        for r in s["reasons"]:
            lines.append(f"    - {r}")
    lines += [
        "",
        "### Action",
        "Update each file to match protocol-manifest.json (single source of truth).",
        "Then close this issue. The PR merge is held by CI until this issue exists.",
        "",
        f"Refs PR: #{pr_number}" if pr_number else "",
    ]
    body = "\n".join(lines)
    title = f"Frontend precompile drift after protocol change ({len(stale)} files stale)"
    p = run([
        "gh", "issue", "create",
        "--title", title,
        "--body", body,
        "--label", "drift",
        "--label", "dapp",
        "--label", "bug",
    ])
    if p.returncode != 0:
        print("::error::failed to auto-create drift issue:", p.stderr.strip())
        return None
    m = re.search(r"/issues/(\d+)", p.stdout)
    return m.group(1) if m else p.stdout.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-ref", default="origin/master")
    ap.add_argument("--head-ref", default="HEAD")
    ap.add_argument("--pr-number", default=os.environ.get("PR_NUMBER"))
    ap.add_argument("--no-block", action="store_true",
                    help="create issues but do not fail the check (debug only)")
    ap.add_argument("--dry-run", action="store_true",
                    help="detect + report only; never call gh (no issue creation)")
    args = ap.parse_args()

    base = precompile_addrs(args.base_ref)
    head = precompile_addrs(args.head_ref)

    added = set(head) - set(base)
    removed = set(base) - set(head)
    renamed = {a: (base[a], head[a]) for a in set(base) & set(head) if base[a] != head[a]}

    if not added and not removed and not renamed:
        print("✅ No precompile-table change vs", args.base_ref, "-> no downstream issues required.")
        return 0

    changed_summary = []
    if added:
        changed_summary.append("Added: " + ", ".join(f"{a} {head[a]}" for a in sorted(added)))
    if removed:
        changed_summary.append("Removed: " + ", ".join(f"{a} {base[a]}" for a in sorted(removed)))
    if renamed:
        changed_summary.append("Renamed: " + ", ".join(f"{a} {o}->{n}" for a, (o, n) in renamed.items()))
    summary = "\n".join(changed_summary)
    print("⚠️ Precompile change detected:\n" + summary)

    stale = find_stale_files(base, head)
    if not stale:
        print("✅ No frontend files reference stale data -> nothing to reconcile. PR unblocked.")
        return 0

    print(f"🔎 {len(stale)} frontend file(s) stale:")
    for s in stale:
        print(f"  - {s['file']}: {'; '.join(s['reasons'])}")

    changed_addrs = (added | removed | set(renamed))
    if existing_drift_issue_satisfied(changed_addrs, args.pr_number):
        print("✅ Open `drift` issue already tracks this change -> PR unblocked.")
        return 0

    if args.dry_run:
        print("::dry-run:: would auto-create a `drift` issue (no gh call made).")
        return 0 if args.no_block else 1

    print("::error::No open `drift` issue tracks this change. Auto-creating one (PR will be held).")
    created = auto_create_issue(stale, summary, args.pr_number, args.base_ref, args.head_ref)
    if created:
        print(f"Created drift issue: {created}")
    if args.no_block:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
