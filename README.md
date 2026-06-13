# Poetry Feed — פיד שירה

An infinite, swipe-up feed of Hebrew and Hebrew-translated poetry. Open the
page → a poem fills the screen → swipe up → the next poem. Quiet by design: no
counters, no streaks. A wind-down page.

It's a **plain static site** — `index.html` + `style.css` + `app.js` + a bundled
`poems.json`. No build step, no server, no framework. It runs straight from
**GitHub Pages** (or any static host, or just by opening `index.html`).

All content is public domain, from [Project Ben-Yehuda](https://benyehuda.org)
(מיזם בן-יהודה) — Hebrew originals **and** Hebrew translations of foreign poets.
Works fully offline once loaded.

## Features

- **Tinder-style swipe deck.** Swipe **right = like**, **left = dislike** (drag,
  the ✕ / ♥ buttons, or ← / → keys). One-level **undo**.
- **Learns what you like, on-device.** A content-based recommender ranks unseen
  poems by your taste and gets better as you swipe — see below.
- **8,719 poems**, 313 authors, **489 translations** (de/ru/en/fr/la/grc/yi…).
- Nikkud toggle (instant swap between vocalized / plain), persisted.
- Filter: all / Hebrew-original / translated.
- Liked poems collect in a local **אהבתי** list; share + per-poem **מקור** link.
- Bundled **Frank Ruhl Libre** Hebrew serif (real nikkud support, OFL).

## The "ML backend" — running in your browser

A static GitHub Pages site has **no server**, so the learning runs entirely
**on your device** (which is ideal here: private, offline, zero infrastructure).
It's a content-based recommender with online learning (`recommender.js`):

- Each poem → a sparse **feature set**: author, original language,
  original/translated, length bucket, and hashed **content words** (so it can
  pick up themes/style, not just author).
- An **online logistic-regression** model nudges its weights on every swipe
  (right → +1, left → 0). Predicted probability ranks the unseen pool, with an
  ε-greedy **exploration** rate so it keeps showing you new things.
- Everything (likes, dislikes, model weights) persists in `localStorage`.
  Settings shows a live "what I've learned about you" line, and an **איפוס
  הלמידה** (reset learning) button.

> Want a *real* server backend instead (cross-device sync, a heavier model)?
> That needs a host beyond GitHub Pages — happy to add it if you go that route.

## Run / deploy

```bash
# locally
python3 -m http.server 8000   # then open http://localhost:8000

# GitHub Pages
# Settings → Pages → Source: deploy from branch → main / root.
# (the repo root IS the site; .nojekyll keeps Pages from touching it)
```

## Refreshing the content

The corpus is produced by a build-time, reproducible pipeline —
`scripts/build_corpus.py` — over the Project Ben-Yehuda public-domain dump. It
keeps the poetry genre (originals + translations), cleans each work (strips the
repeated title, the volunteer-attribution footer and footnotes, reflows verse
vs. stanza breaks, keeps both nikkud and plain variants), and writes
`poems.json`.

```bash
# rebuild poems.json (sparse-clones the dump itself; needs git + network)
python3 scripts/build_corpus.py --clone --out-name poems.json --max-lines 24
```

Key knobs (all documented in the script header):

- `--max-lines 24` — only poems that fit one screen go in the feed; keeps the
  download ~4 MB gzipped. Raise it, or pass `0`, for longer poems / the whole
  corpus (the full set is ~8 MB gzipped).
- Source: the **raw GitHub dump** (the HuggingFace mirror was network-blocked).
- Granularity: **conservative** — one catalogue entry = one poem, no splitting.
- Translations: `author` stays the original poet; the Hebrew translator shows on
  a small "מתורגם · תרגום: …" line.

## Layout

```
index.html / style.css / app.js   the static site (the GitHub Pages deliverable)
poems.json                        bundled corpus (built by the pipeline)
fonts/                            Frank Ruhl Libre (woff2) + OFL license
scripts/build_corpus.py           build-time corpus pipeline
old/                              the previous KIRA hub (games + small apps), archived
native/                           an alternate Expo/React-Native build of the same app
                                  (per the original spec) — kept for reference, not needed
                                  for the web version. See native/README.md.
```

## Attribution

Content: **Project Ben-Yehuda** (benyehuda.org), public domain — a `source_url`
per poem links back; please keep it. Font: **Frank Ruhl Libre**, SIL Open Font
License (`fonts/OFL.txt`).
