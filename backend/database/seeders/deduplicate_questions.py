#!/usr/bin/env python3
"""
deduplicate_questions.py
========================
Removes exact duplicate questions from the seeder JSON files and writes
clean output files. Near-duplicate review is left to a human.

What it does
------------
  1. Reads every *.json file in the questions/ sub-folder next to this script
  2. Within each file:  keeps only the first occurrence of each question text
  3. Across all files:  optionally flags if a question in file B already exists
     in a previously processed file (cross-file deduplication)
  4. Writes cleaned files to --out-dir (default: same directory, overwrites originals
     unless --dry-run is passed)

Usage
-----
  # Dry-run: see what would change, write nothing
  python deduplicate_questions.py --dry-run

  # Write cleaned files next to originals (overwrites!)
  python deduplicate_questions.py

  # Write cleaned files to a separate directory (safe)
  python deduplicate_questions.py --out-dir questions_clean

  # Also deduplicate across files (keep first occurrence globally)
  python deduplicate_questions.py --cross-file --out-dir questions_clean

Requirements: built-in only (no pip needed)
"""

import json
import sys
import io
import argparse
import unicodedata
import re
import shutil
from pathlib import Path
from collections import defaultdict

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

QUESTIONS_DIR = Path(__file__).parent / "questions"

COLOUR = sys.stdout.isatty()
def _c(code, t): return f"\033[{code}m{t}\033[0m" if COLOUR else t
RED    = lambda t: _c("31;1", t)
GREEN  = lambda t: _c("32;1", t)
YELLOW = lambda t: _c("33;1", t)
CYAN   = lambda t: _c("36", t)
BOLD   = lambda t: _c("1", t)
DIM    = lambda t: _c("2", t)


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[।,\.!\?।]+", "", text)
    return text


def process_file(
    jf: Path,
    global_seen: set[str],
    cross_file: bool,
    dry_run: bool,
    out_dir: Path,
) -> dict:
    """
    Process one JSON file. Returns stats dict.
    Modifies global_seen in-place if cross_file=True.
    """
    with open(jf, encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print(YELLOW(f"  SKIP {jf.name} — not a JSON array"))
        return {"file": jf.name, "original": 0, "kept": 0, "removed": 0}

    local_seen: set[str] = set()
    kept: list[dict] = []
    removed_local = 0
    removed_cross = 0

    for item in data:
        q_text = item.get("question", "").strip()
        norm = normalise(q_text)

        # Within-file duplicate
        if norm in local_seen:
            removed_local += 1
            continue

        # Cross-file duplicate
        if cross_file and norm in global_seen:
            removed_cross += 1
            local_seen.add(norm)   # mark so we don't also count as local dup
            continue

        local_seen.add(norm)
        if cross_file:
            global_seen.add(norm)
        kept.append(item)

    total_removed = removed_local + removed_cross
    stats = {
        "file":           jf.name,
        "original":       len(data),
        "kept":           len(kept),
        "removed_local":  removed_local,
        "removed_cross":  removed_cross,
        "removed_total":  total_removed,
    }

    if not dry_run and total_removed > 0:
        out_path = out_dir / jf.name
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(kept, f, ensure_ascii=False, indent=2)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove exact duplicate questions from seeder JSON files."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Report changes without writing any files"
    )
    parser.add_argument(
        "--out-dir", default=None,
        help="Output directory (default: same dir as source files — overwrites originals)"
    )
    parser.add_argument(
        "--cross-file", action="store_true",
        help="Also remove questions that appear in more than one file (keeps first file's version)"
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

    out_dir = Path(args.out_dir) if args.out_dir else questions_dir

    if args.dry_run:
        print(BOLD("\n[DRY RUN] No files will be written.\n"))
    elif out_dir == questions_dir:
        print(YELLOW("\nWARNING: Output directory == source directory. Originals will be overwritten."))
        print(YELLOW("         Use --out-dir <path> to write to a separate directory instead.\n"))
    else:
        print(f"\nOutput directory: {CYAN(str(out_dir))}\n")
        out_dir.mkdir(parents=True, exist_ok=True)
        # Copy unchanged files to out_dir so the directory is complete
        for jf in sorted(questions_dir.glob("*.json")):
            dst = out_dir / jf.name
            if not dst.exists():
                shutil.copy2(jf, dst)

    json_files = sorted(questions_dir.glob("*.json"))
    if not json_files:
        print(RED(f"No JSON files found in {questions_dir}"))
        sys.exit(1)

    print(f"Found {len(json_files)} JSON files in {questions_dir}\n")

    global_seen: set[str] = set()
    all_stats: list[dict] = []

    for jf in json_files:
        try:
            stats = process_file(jf, global_seen, args.cross_file, args.dry_run, out_dir)
            all_stats.append(stats)
        except (json.JSONDecodeError, OSError) as e:
            print(RED(f"  ERROR {jf.name}: {e}"))

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"\n{'File':<45} {'Orig':>5} {'Kept':>5} {'Removed':>8}")
    print("-" * 70)

    total_orig    = 0
    total_kept    = 0
    total_removed = 0

    for s in all_stats:
        orig    = s["original"]
        kept    = s["kept"]
        removed = s.get("removed_total", 0)
        total_orig    += orig
        total_kept    += kept
        total_removed += removed

        if removed:
            rem_str = RED(f"{removed:>8}")
        else:
            rem_str = f"{'0':>8}"

        print(f"{s['file']:<45} {orig:>5} {kept:>5} {rem_str}")

    print("=" * 70)
    print(
        f"{'TOTAL':<45} {total_orig:>5} "
        f"{GREEN(str(total_kept)):>5} "
        f"{RED(str(total_removed)):>8}"
    )

    if args.dry_run:
        print(YELLOW("\n[DRY RUN] No files were written."))
    elif total_removed > 0:
        print(GREEN(f"\nCleaned files written to: {out_dir}"))
    else:
        print(GREEN("\nNo duplicates found — all files are clean."))

    print()


if __name__ == "__main__":
    main()
