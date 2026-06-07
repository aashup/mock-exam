#!/usr/bin/env python3
"""
find_duplicate_questions.py
===========================
Scans all question JSON files in the questions/ sub-folder next to this script
and reports:
  1. Exact duplicates  — identical question text (after normalisation)
  2. Near-duplicates   — question text similarity >= FUZZY_THRESHOLD (default 85 %)

Usage
-----
  python find_duplicate_questions.py                   # default 85 % threshold
  python find_duplicate_questions.py --threshold 90   # stricter
  python find_duplicate_questions.py --exact-only      # skip fuzzy pass
  python find_duplicate_questions.py --export dupes.json  # save duplicate list

Output
------
  - Console summary table
  - Optional JSON export of all duplicate groups

Requirements
------------
  Built-in only (no pip installs needed). Uses difflib.SequenceMatcher for
  fuzzy matching — no third-party libraries required.
"""

import json
import os
import sys
import re
import argparse
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from collections import defaultdict
from itertools import combinations

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────
QUESTIONS_DIR = Path(__file__).parent / "questions"
FUZZY_THRESHOLD = 0.85          # similarity ratio  0.0 – 1.0
COLOUR = sys.stdout.isatty()    # only colour on real terminals

# ──────────────────────────────────────────────────────────────────────────────
# Terminal colours (graceful fallback)
# ──────────────────────────────────────────────────────────────────────────────
def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if COLOUR else text

RED    = lambda t: _c("31;1", t)
YELLOW = lambda t: _c("33;1", t)
GREEN  = lambda t: _c("32;1", t)
CYAN   = lambda t: _c("36",   t)
BOLD   = lambda t: _c("1",    t)
DIM    = lambda t: _c("2",    t)

# ──────────────────────────────────────────────────────────────────────────────
# Normalisation
# ──────────────────────────────────────────────────────────────────────────────
def normalise(text: str) -> str:
    """Normalise Unicode, collapse whitespace, lowercase for comparison."""
    text = unicodedata.normalize("NFC", text)
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)          # collapse whitespace
    text = re.sub(r"[।,\.!\?।]+", "", text)   # strip common punctuation incl. Hindi danda
    return text

# ──────────────────────────────────────────────────────────────────────────────
# Load all questions
# ──────────────────────────────────────────────────────────────────────────────
def load_all_questions(directory: Path) -> list[dict]:
    """
    Returns a flat list of dicts:
      { "text": str, "norm": str, "file": str, "index": int, "raw": dict }
    """
    all_q: list[dict] = []
    json_files = sorted(directory.glob("*.json"))

    if not json_files:
        print(RED(f"No JSON files found in {directory}"))
        sys.exit(1)

    print(BOLD(f"\nLoading questions from {directory}"))
    print(DIM(f"Found {len(json_files)} JSON files\n"))

    errors = []
    for jf in json_files:
        try:
            with open(jf, encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                errors.append(f"  {jf.name}: not a JSON array — skipped")
                continue
            for idx, item in enumerate(data):
                q_text = item.get("question", "").strip()
                if not q_text:
                    continue
                all_q.append({
                    "text":  q_text,
                    "norm":  normalise(q_text),
                    "file":  jf.name,
                    "index": idx,
                    "raw":   item,
                })
        except (json.JSONDecodeError, OSError) as e:
            errors.append(f"  {jf.name}: {e}")

    for err in errors:
        print(YELLOW(f"WARNING {err}"))

    print(f"  Loaded {GREEN(str(len(all_q)))} questions from {len(json_files)} files\n")
    return all_q

# ──────────────────────────────────────────────────────────────────────────────
# Exact duplicates
# ──────────────────────────────────────────────────────────────────────────────
def find_exact_duplicates(questions: list[dict]) -> list[list[dict]]:
    """Group questions whose normalised text is identical."""
    buckets: dict[str, list[dict]] = defaultdict(list)
    for q in questions:
        buckets[q["norm"]].append(q)
    return [group for group in buckets.values() if len(group) > 1]

# ──────────────────────────────────────────────────────────────────────────────
# Near-duplicate (fuzzy) pass
# ──────────────────────────────────────────────────────────────────────────────
def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b, autojunk=False).ratio()

def find_near_duplicates(
    questions: list[dict],
    threshold: float,
    exact_norms: set[str],
) -> list[tuple[float, dict, dict]]:
    """
    Returns list of (ratio, q1, q2) pairs whose similarity >= threshold
    but are NOT already caught by the exact pass.
    Only compares each pair once.
    """
    pairs: list[tuple[float, dict, dict]] = []
    n = len(questions)
    print(f"  Running fuzzy comparison on {n} questions …  (this may take a moment)\n")

    # Build a dict of norm → first occurrence so we only compare unique norms
    # For efficiency, skip pairs where both norms are in the exact_norms set
    for i, j in combinations(range(n), 2):
        a, b = questions[i], questions[j]
        # Skip if both are already exact duplicates of each other
        if a["norm"] == b["norm"]:
            continue
        # Quick length filter — if lengths differ by > 50 % skip
        la, lb = len(a["norm"]), len(b["norm"])
        if la == 0 or lb == 0:
            continue
        if min(la, lb) / max(la, lb) < (threshold - 0.1):
            continue
        ratio = similarity(a["norm"], b["norm"])
        if ratio >= threshold:
            pairs.append((ratio, a, b))

    # Sort by descending similarity
    pairs.sort(key=lambda x: x[0], reverse=True)
    return pairs

# ──────────────────────────────────────────────────────────────────────────────
# Display helpers
# ──────────────────────────────────────────────────────────────────────────────
def print_section(title: str) -> None:
    width = 70
    print("\n" + "=" * width)
    print(BOLD(f"  {title}"))
    print("=" * width)

def print_exact_group(idx: int, group: list[dict]) -> None:
    print(f"\n  {RED(f'[EXACT #{idx}]')} ({len(group)} copies)")
    print(f"  {DIM('Question:')} {group[0]['text'][:120]}")
    for q in group:
        print(f"    {CYAN(q['file'])} — entry #{q['index']}")

def print_fuzzy_pair(idx: int, ratio: float, a: dict, b: dict) -> None:
    pct = f"{ratio * 100:.1f} %"
    print(f"\n  {YELLOW(f'[NEAR #{idx}]')} similarity {BOLD(pct)}")
    print(f"  A ({CYAN(a['file'])} #{a['index']}): {a['text'][:100]}")
    print(f"  B ({CYAN(b['file'])} #{b['index']}): {b['text'][:100]}")

# ──────────────────────────────────────────────────────────────────────────────
# Stats summary
# ──────────────────────────────────────────────────────────────────────────────
def print_stats(
    total: int,
    exact_groups: list,
    fuzzy_pairs: list,
    threshold: float,
) -> None:
    exact_count = sum(len(g) - 1 for g in exact_groups)  # extra copies
    fuzzy_count = len(fuzzy_pairs)

    print_section("SUMMARY")
    print(f"\n  Total questions loaded : {BOLD(str(total))}")
    print(f"  Unique questions       : {GREEN(str(total - exact_count))}")
    print(f"  Exact duplicate copies : {RED(str(exact_count))}  ({len(exact_groups)} groups)")
    print(f"  Near-duplicate pairs   : {YELLOW(str(fuzzy_count))}  (>= {threshold * 100:.0f} % similarity)\n")

# ──────────────────────────────────────────────────────────────────────────────
# Per-file breakdown
# ──────────────────────────────────────────────────────────────────────────────
def print_file_breakdown(
    exact_groups: list[list[dict]],
    fuzzy_pairs: list[tuple[float, dict, dict]],
) -> None:
    file_issues: dict[str, dict] = defaultdict(lambda: {"exact": 0, "fuzzy": 0})
    for group in exact_groups:
        for q in group:
            file_issues[q["file"]]["exact"] += 1
    for _, a, b in fuzzy_pairs:
        file_issues[a["file"]]["fuzzy"] += 1
        file_issues[b["file"]]["fuzzy"] += 1

    if not file_issues:
        print(f"  {GREEN('No duplicates found across all files!')}\n")
        return

    print_section("PER-FILE DUPLICATE COUNT")
    print(f"\n  {'File':<40} {'Exact':>7} {'Near-dup':>9}")
    print(f"  {'-'*40} {'-------':>7} {'---------':>9}")
    for fname, counts in sorted(file_issues.items()):
        e = counts["exact"]
        f = counts["fuzzy"]
        e_s = RED(f"{e:>7}") if e else f"{'0':>7}"
        f_s = YELLOW(f"{f:>9}") if f else f"{'0':>9}"
        print(f"  {fname:<40} {e_s} {f_s}")
    print()

# ──────────────────────────────────────────────────────────────────────────────
# Export
# ──────────────────────────────────────────────────────────────────────────────
def export_results(
    path: str,
    exact_groups: list[list[dict]],
    fuzzy_pairs: list[tuple[float, dict, dict]],
) -> None:
    out = {
        "exact_duplicate_groups": [
            {
                "question": g[0]["text"],
                "occurrences": [{"file": q["file"], "index": q["index"]} for q in g],
            }
            for g in exact_groups
        ],
        "near_duplicate_pairs": [
            {
                "similarity_pct": round(ratio * 100, 1),
                "a": {"file": a["file"], "index": a["index"], "question": a["text"]},
                "b": {"file": b["file"], "index": b["index"], "question": b["text"]},
            }
            for ratio, a, b in fuzzy_pairs
        ],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(GREEN(f"\n  Results exported → {path}\n"))

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find duplicate questions across all seeder JSON files."
    )
    parser.add_argument(
        "--threshold", type=float, default=FUZZY_THRESHOLD,
        help=f"Fuzzy similarity threshold 0.0–1.0 (default {FUZZY_THRESHOLD})"
    )
    parser.add_argument(
        "--exact-only", action="store_true",
        help="Skip the fuzzy near-duplicate pass (much faster)"
    )
    parser.add_argument(
        "--export", metavar="FILE",
        help="Export all duplicate groups to a JSON file"
    )
    parser.add_argument(
        "--dir", default=str(QUESTIONS_DIR),
        help="Override the questions directory path"
    )
    args = parser.parse_args()

    questions_dir = Path(args.dir)
    if not questions_dir.exists():
        print(RED(f"Directory not found: {questions_dir}"))
        sys.exit(1)

    # ── Load ──────────────────────────────────────────────────────────────────
    questions = load_all_questions(questions_dir)

    # ── Exact duplicates ──────────────────────────────────────────────────────
    print_section("EXACT DUPLICATES")
    exact_groups = find_exact_duplicates(questions)
    if exact_groups:
        for i, group in enumerate(exact_groups, 1):
            print_exact_group(i, group)
    else:
        print(f"\n  {GREEN('None found.')}\n")

    exact_norms = {q["norm"] for q in questions}

    # ── Fuzzy near-duplicates ─────────────────────────────────────────────────
    fuzzy_pairs: list[tuple[float, dict, dict]] = []
    if not args.exact_only:
        print_section(f"NEAR-DUPLICATES  (threshold ≥ {args.threshold * 100:.0f} %)")
        fuzzy_pairs = find_near_duplicates(questions, args.threshold, exact_norms)
        if fuzzy_pairs:
            for i, (ratio, a, b) in enumerate(fuzzy_pairs, 1):
                print_fuzzy_pair(i, ratio, a, b)
        else:
            print(f"\n  {GREEN('None found.')}\n")

    # ── Stats & per-file ──────────────────────────────────────────────────────
    print_stats(len(questions), exact_groups, fuzzy_pairs, args.threshold)
    print_file_breakdown(exact_groups, fuzzy_pairs)

    # ── Export ────────────────────────────────────────────────────────────────
    if args.export:
        export_results(args.export, exact_groups, fuzzy_pairs)

    # Exit code: 0 = clean, 1 = duplicates found
    if exact_groups or fuzzy_pairs:
        sys.exit(1)


if __name__ == "__main__":
    main()
