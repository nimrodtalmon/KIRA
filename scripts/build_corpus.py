#!/usr/bin/env python3
"""
build_corpus.py — Poetry Feed corpus builder.

Build-time, reproducible. NOT part of the app runtime. Re-run this to refresh
the feed's content. It reads the Project Ben-Yehuda public-domain dump, keeps
only the poetry genre (Hebrew originals + Hebrew translations of foreign
poets), cleans each work, and emits a normalized `assets/poems.json` that the
Expo app bundles and ships offline.

Source of truth: Project Ben-Yehuda (https://benyehuda.org), public domain.
Dump repo: https://github.com/projectbenyehuda/public_domain_dump

Why the GitHub dump and not the HuggingFace mirror (per spec section 2)?
huggingface.co is network-blocked in the build environment this was authored
in, and the raw GitHub dump gives us finer control anyway: a flat
`pseudocatalogue.csv` (title/author/translators/genre/path) plus parallel
`txt/` (with nikkud) and `txt_stripped/` (without nikkud) trees keyed by the
same path. One fetch, both nikkud variants, no transliteration at runtime.

Layout in the dump (path column looks like "/p89/m20"):
    txt/p89/m20.txt           -> body WITH nikkud
    txt_stripped/p89/m20.txt  -> body WITHOUT nikkud
    html/p89/m20.html         -> (unused here)
Each .txt file is: line 1 = title, then whitespace, then the body.

Poem granularity (spec section 4 / open decision): CONSERVATIVE. Every
catalogue entry is emitted as exactly one poem item. We do NOT split
multi-poem files. The spec's rule is "false-merge is fine, false-split is
ugly" — so a collection that happens to be one catalogue entry stays one item
(it just renders as a longer poem). No heuristic splitting = no false splits.

Translation mapping (resolved fork, documented in the PR): in the dump the
`authors` column is the original poet and `translators` is the Hebrew
translator. We keep the original poet as the displayed `author` (so a
translated Whitman reads as "Whitman"), set `is_translation` when a translator
exists, expose the translator in a `translator` field, and mirror the source
poet into `original_author` for spec compatibility.

Usage:
    # Fast path: build from a local clone of the dump
    python scripts/build_corpus.py --dump-dir /path/to/public_domain_dump

    # Or let the script make a sparse clone itself (needs git + network):
    python scripts/build_corpus.py --clone

Outputs (relative to --out-dir, default ./assets):
    poems.json         full corpus
    poems.sample.json  small deterministic sample for dev / M0
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import random
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

DUMP_REPO = "https://github.com/projectbenyehuda/public_domain_dump.git"

# A catalogue entry longer than this (counted in non-empty body lines) is
# tagged "long": it won't fit one screen, so the app would need internal scroll.
LONG_LINES = 50
# Above this we additionally tag "epic" (think multi-page works / whole
# collections under one catalogue id).
EPIC_LINES = 250

# Default cap on what gets BUNDLED into poems.json (the feed). The feed's whole
# premise is "one poem per screen", so poems that can't fit a screen are a poor
# fit; capping here keeps the bundle shippable (~32 MB vs ~88 MB uncapped) AND
# on-message. The full corpus is always one flag away: pass --max-lines 0.
# Measured trade-off (Ben-Yehuda, 2026 dump):
#   --max-lines 0   -> 13,068 poems, ~88 MB
#   --max-lines 250 -> 12,841 poems, ~53 MB  (drops whole-book "epic" entries)
#   --max-lines 50  -> 11,172 poems, ~32 MB  (default; still 698 translations)
DEFAULT_MAX_LINES = 50

# Hebrew letter range — used to sanity-check that a body actually contains
# Hebrew text before we keep it.
HEB_RE = re.compile(r"[֐-׿]")
# Nikkud + cantillation marks (U+0591–U+05C7), stripped only for comparisons.
NIKKUD_RE = re.compile(r"[֑-ׇ]")


def denik(s: str) -> str:
    return NIKKUD_RE.sub("", s or "")


# Curated representative period (≈ floruit/death year) for the well-known poets,
# keyed by nikkud-stripped author name. Project Ben-Yehuda is public-domain only,
# so the *newest* poetry here is the early-20th-century Hebrew revival — there is
# nothing recent to date. Years are approximate (±~15y); they drive a "period"
# filter ("show me the more modern poetry"), not scholarship. Authors not listed
# get year=null and are only shown when the period filter is wide open.
AUTHOR_YEAR = {
    # Medieval Sepharad / Andalusia (10th–13th c.)
    "שמואל הנגיד": 1040, "שלמה אבן גבירול": 1050, "יהודה הלוי": 1130,
    "משה אבן עזרא": 1120, "אברהם אבן עזרא": 1140, "יצחק אבן גיאת": 1070,
    "יצחק אבן כלפון": 1000, "אברהם אבן חלפון": 1050, "אברהם בן חלפון": 1050,
    "טודרוס בן יהודה אבולעפיה": 1280, "אלעזר בן יעקב הבבלי": 1250,
    "וידל בנבנשתי": 1400, "יוסף צרפתי": 1500,
    # Yemenite
    "שלום שבזי": 1680, "זכריה אלצ'אהרי": 1580,
    # Italian / Haskalah (18th–19th c.)
    "אפרים לוצטו": 1770, "רחל מורפורגו": 1840, "יוסף אלמנצי": 1840,
    "שלמה מנדלקרן": 1890, "יהודה ליב גורדון": 1875, "מרדכי צבי מאנה": 1880,
    "נפתלי הרץ אימבר": 1890, "שמעון שמואל פרוג": 1900, "סלימאן מנחם מני": 1900,
    # Modern Hebrew revival (late 19th – mid 20th c.) — the newest available
    "חיים נחמן ביאליק": 1910, "שאול טשרניחובסקי": 1920, "רחל בלובשטיין": 1925,
    "דוד פוגל": 1930, "יצחק קצנלסון": 1930, "יהודה קרני": 1930,
    "יעקב שטיינברג": 1925, "חיים לנסקי": 1935, "פניה ברגשטיין": 1940,
    "אלישבע": 1930, "אשר ברש": 1930, "אברהם בן־יצחק": 1920, "אברהם בן-יצחק": 1920,
    "שמעון גינצבורג": 1930, "אלתר לוין": 1920, "אהרן ליבושיצקי": 1910,
    "יעקב פיכמן": 1930, "יעקב כהן": 1925, "זלמן שניאור": 1930,
    "דוד שמעוני": 1930, "יעקב שטיינברג": 1925, "אנדה עמיר": 1940,
    # Translated foreign originals (era of the original poet)
    "היינריך היינה": 1840, "יוהן וולפגנג פון גתה": 1810, "ניקולאוס לנאו": 1840,
    "אלכסנדר פושקין": 1830, "מיכאיל לרמונטוב": 1840,
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def sparse_clone(dest: Path) -> Path:
    """Shallow, blobless, sparse clone of just the text trees we need."""
    if dest.exists():
        log(f"[clone] reusing existing {dest}")
        return dest
    log(f"[clone] sparse-cloning {DUMP_REPO} -> {dest}")
    subprocess.run(
        ["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse",
         DUMP_REPO, str(dest)],
        check=True,
    )
    subprocess.run(
        ["git", "-C", str(dest), "sparse-checkout", "set", "txt", "txt_stripped"],
        check=True,
    )
    return dest


def read_text(p: Path) -> str | None:
    try:
        return p.read_text(encoding="utf-8")
    except (FileNotFoundError, UnicodeDecodeError):
        return None


# The volunteer-attribution footer the dump appends to almost every file. We
# keep attribution as structured metadata (source_url) instead of in the poem.
FOOTER_RE = re.compile(r"(הפיקו.*פרויקט|מתנדבי\s+פרויקט\s+בן)")


def clean_body(raw: str, title: str) -> str:
    """Strip the title line + Ben-Yehuda boilerplate, normalize blank runs.

    The dump's verse convention is: one blank line BETWEEN lines of a stanza,
    two (or more) blank lines BETWEEN stanzas. So a single blank run is a plain
    line break (we drop it, lines become adjacent) and a run of >=2 blanks is a
    stanza break (we keep one blank line). Comparing the leading title is done
    nikkud-insensitively so it's stripped from the plain variant too.

    We also remove the trailing "this text was produced by Project Ben-Yehuda
    volunteers…" footer and footnote-definition lines (the ↩ back-ref marker),
    and decode HTML entities (&nbsp; etc.) the dump leaves in the plain text.
    """
    if raw is None:
        return ""
    text = html.unescape(raw.replace("\r\n", "\n").replace("\r", "\n")).replace("\xa0", " ")
    lines = text.split("\n")
    # Strip a leading line that repeats the title (dump puts it on line 1).
    if lines and denik(lines[0].strip()) == denik(title.strip()):
        lines = lines[1:]
    # Cut the volunteer footer and everything after it.
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s.startswith("את הטקסט") or FOOTER_RE.search(s):
            lines = lines[:i]
            break
    # Drop footnote-definition lines (they carry the ↩ return marker).
    lines = [ln for ln in lines if "↩" not in ln]
    # Drop leading whitespace-only lines (the dump has a stray tab + blanks).
    while lines and not lines[0].strip():
        lines.pop(0)
    lines = [ln.rstrip() for ln in lines]
    # Re-flow: single blank -> line break, >=2 blanks -> one stanza-break blank.
    out: list[str] = []
    pending_blanks = 0
    for ln in lines:
        if not ln.strip():
            pending_blanks += 1
            continue
        if out and pending_blanks >= 2:
            out.append("")  # stanza break
        out.append(ln)
        pending_blanks = 0
    return "\n".join(out).strip("\n")


def non_empty_lines(body: str) -> int:
    return sum(1 for ln in body.split("\n") if ln.strip())


def first_field(value: str) -> str | None:
    """Catalogue author/translator cells may list several, ';'-separated."""
    if not value:
        return None
    parts = [p.strip() for p in re.split(r"[;|]", value) if p.strip()]
    return ", ".join(parts) if parts else None


def slugify(s: str) -> str:
    s = re.sub(r"[^\w]+", "-", s, flags=re.UNICODE).strip("-")
    return s[:40] or "x"


def build(args) -> int:
    dump_dir = Path(args.dump_dir) if args.dump_dir else None
    if args.clone or dump_dir is None:
        dump_dir = sparse_clone(Path(args.clone_dir))
    catalogue = Path(args.catalogue) if args.catalogue else dump_dir / "pseudocatalogue.csv"
    if not catalogue.exists():
        # The sparse clone omits the csv by default; fetch it on demand.
        log(f"[catalogue] {catalogue} missing; fetching via git sparse-checkout add")
        subprocess.run(
            ["git", "-C", str(dump_dir), "sparse-checkout", "add", "pseudocatalogue.csv"],
            check=False,
        )
    if not catalogue.exists():
        log(f"ERROR: catalogue not found at {catalogue}")
        return 2

    txt_dir = dump_dir / "txt"
    stripped_dir = dump_dir / "txt_stripped"

    rows = list(csv.DictReader(catalogue.open(encoding="utf-8")))
    poetry = [r for r in rows if "poetry" in (r.get("genre") or "")]
    log(f"[filter] {len(poetry)} poetry works of {len(rows)} catalogue entries")

    poems = []
    seen_ids: set[str] = set()
    skipped = Counter()
    lengths: list[int] = []

    for r in poetry:
        rel = (r.get("path") or "").lstrip("/")
        if not rel:
            skipped["no_path"] += 1
            continue
        nikkud_raw = read_text(txt_dir / f"{rel}.txt")
        plain_raw = read_text(stripped_dir / f"{rel}.txt")
        if nikkud_raw is None and plain_raw is None:
            skipped["no_text_file"] += 1
            continue

        title = (r.get("title") or "").strip()
        body_nikkud = clean_body(nikkud_raw or plain_raw or "", title)
        body_plain = clean_body(plain_raw or nikkud_raw or "", title)
        if not body_plain or not HEB_RE.search(body_plain):
            skipped["empty_or_no_hebrew"] += 1
            continue

        translator = first_field(r.get("translators") or "")
        author = first_field(r.get("authors") or "") or "מחבר/ת לא ידוע/ה"
        is_translation = translator is not None
        lang = (r.get("original_language") or "").strip() or None

        n = non_empty_lines(body_plain)
        lengths.append(n)
        if args.max_lines and n > args.max_lines:
            skipped["over_max_lines"] += 1
            continue
        tags: list[str] = []
        if n > EPIC_LINES:
            tags.append("epic")
        elif n > LONG_LINES:
            tags.append("long")

        pid = f"by-{slugify(author)}-{r.get('ID')}"
        if pid in seen_ids:
            pid = f"{pid}-{len(poems)}"
        seen_ids.add(pid)

        poems.append({
            "id": pid,
            "title": title or "ללא כותרת",
            "author": author,
            "translator": translator,
            "is_translation": is_translation,
            "original_author": author if is_translation else None,
            "original_language": lang,
            "body_nikkud": body_nikkud,
            "body_plain": body_plain,
            "length_lines": n,
            "source_url": f"https://benyehuda.org/read{r.get('path')}",
            "year": AUTHOR_YEAR.get(denik(author)),
            "tags": tags,
        })

    # Dedupe identical bodies (the dump occasionally lists a work twice).
    by_body: dict[str, dict] = {}
    deduped = []
    for p in poems:
        key = p["body_plain"][:400]
        if key in by_body:
            skipped["dup_body"] += 1
            continue
        by_body[key] = p
        deduped.append(p)
    poems = deduped

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    # Output filename. The static web app fetches `poems.json`; the (archived)
    # native app bundles `poems.pf` (a custom extension so Metro treats it as a
    # runtime asset instead of inlining the JSON into the JS bundle).
    (out_dir / args.out_name).write_text(
        json.dumps(poems, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Deterministic dev sample: shuffle with a fixed seed, take N, prefer a few
    # translations so the sample exercises that path.
    rng = random.Random(42)
    translations = [p for p in poems if p["is_translation"] and "epic" not in p["tags"]]
    originals = [p for p in poems if not p["is_translation"] and "epic" not in p["tags"]]
    rng.shuffle(translations)
    rng.shuffle(originals)
    sample = (translations[:8] + originals[: max(0, args.sample_size - 8)])
    rng.shuffle(sample)
    (out_dir / "poems.sample.json").write_text(
        json.dumps(sample, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # ---- stats ----
    authors = Counter(p["author"] for p in poems)
    n_trans = sum(1 for p in poems if p["is_translation"])
    langs = Counter(p["original_language"] for p in poems if p["original_language"])
    long_ct = sum(1 for p in poems if "long" in p["tags"])
    epic_ct = sum(1 for p in poems if "epic" in p["tags"])

    def pct(x):
        return f"{(100 * x / max(1, len(poems))):.1f}%"

    log("\n================  CORPUS STATS  ================")
    log(f"poems emitted      : {len(poems)}")
    log(f"unique authors     : {len(authors)}")
    log(f"translations       : {n_trans} ({pct(n_trans)})")
    log(f"  by language      : " + ", ".join(f"{l}:{c}" for l, c in langs.most_common(8)))
    log(f"tagged 'long'      : {long_ct}  (> {LONG_LINES} lines)")
    log(f"tagged 'epic'      : {epic_ct}  (> {EPIC_LINES} lines, excluded from feed)")
    if lengths:
        lengths.sort()
        q = lambda f: lengths[min(len(lengths) - 1, int(f * len(lengths)))]
        log(f"length (lines)     : min={lengths[0]} p50={q(.5)} p90={q(.9)} p99={q(.99)} max={lengths[-1]}")
    log("top authors        : " + ", ".join(f"{a}({c})" for a, c in authors.most_common(8)))
    log("skipped            : " + (", ".join(f"{k}={v}" for k, v in skipped.items()) or "none"))
    log(f"\nwrote {out_dir/args.out_name}  and  {out_dir/'poems.sample.json'} ({len(sample)} items)")
    log("===============================================")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Build Poetry Feed corpus from the Ben-Yehuda dump.")
    ap.add_argument("--dump-dir", help="Path to a local clone of public_domain_dump.")
    ap.add_argument("--catalogue", help="Path to pseudocatalogue.csv (defaults to <dump-dir>/pseudocatalogue.csv).")
    ap.add_argument("--clone", action="store_true", help="Sparse-clone the dump if --dump-dir is not given / missing.")
    ap.add_argument("--clone-dir", default="/tmp/by_dump", help="Where to sparse-clone the dump.")
    ap.add_argument("--out-dir", default=".", help="Output directory for the corpus (default: current dir).")
    ap.add_argument("--out-name", default="poems.json", help="Corpus filename (default: poems.json; native app uses poems.pf).")
    ap.add_argument("--max-lines", type=int, default=DEFAULT_MAX_LINES,
                    help=f"Exclude poems longer than this many non-empty lines from the "
                         f"bundle (default {DEFAULT_MAX_LINES}). Pass 0 for no cap / full corpus.")
    ap.add_argument("--sample-size", type=int, default=40, help="Number of poems in poems.sample.json.")
    args = ap.parse_args()
    sys.exit(build(args))


if __name__ == "__main__":
    main()
