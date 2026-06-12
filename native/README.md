# Poetry Feed

An infinite, swipe-up feed of Hebrew and Hebrew-translated poetry for Android.
Open the app → a poem fills the screen → swipe up → the next poem. Quiet by
design: no counters, no streaks, no dopamine slot machine. A wind-down app.

All content is public domain, drawn from
[Project Ben-Yehuda](https://benyehuda.org) (מיזם בן-יהודה) — Hebrew originals
**and** Hebrew translations of foreign poets, from one corpus. It works fully
offline; the poems ship inside the app.

> Built from [`poetryfeedspec.md`](./poetryfeedspec.md). The previous KIRA web
> hub (games + small apps) was archived under [`old/`](./old).

---

## Stack

- **Expo (React Native)**, SDK 56 / RN 0.85, TypeScript.
- Navigation: `@react-navigation/bottom-tabs` (Feed / Saved / Settings).
- Local persistence: `@react-native-async-storage/async-storage`.
- Corpus loaded at runtime as a bundled asset (`expo-asset` + `expo-file-system`).
- Hebrew typography: **Frank Ruhl Libre** (bundled, real nikkud support, OFL).

The spec's stack fork (Expo vs Flutter) was resolved in favour of **Expo** — it
is the fastest path to a sideloadable APK and vertical full-screen paging is a
solved problem with `FlatList` (`pagingEnabled` + `snapToInterval`).

## Project layout

```
App.tsx                  app root: fonts, navigation, load/error gate
src/
  AppState.tsx           context: corpus + persisted state (saved/seen/settings)
  types.ts               Poem + settings types
  theme.ts               palette + type scale
  data/
    corpus.ts            load poems.pf asset, shuffle deck, filter, no-repeat
    store.ts             AsyncStorage read/write
  components/PoemCard.tsx one poem, full screen, RTL, length-aware sizing
  screens/
    FeedScreen.tsx       vertical full-screen pager (the core loop)
    SavedScreen.tsx      liked poems → tap to read
    SettingsScreen.tsx   nikkud toggle, filter, attribution
assets/
  poems.pf               the corpus (bundled, ~31 MB, plain JSON text)
  poems.sample.json      small human-readable sample (committed for review)
  fonts/                 Frank Ruhl Libre (static weights) + OFL.txt
scripts/build_corpus.py  build-time corpus pipeline (NOT shipped in the app)
```

## The corpus pipeline

`scripts/build_corpus.py` is build-time and reproducible — re-run it to refresh
the feed. It reads the Project Ben-Yehuda public-domain dump, keeps the poetry
genre (originals + translations), cleans each work, and emits `assets/poems.pf`.

```bash
# Build from a local clone of the dump (fast):
python3 scripts/build_corpus.py --dump-dir /path/to/public_domain_dump

# Or let it sparse-clone the dump itself (needs git + network):
npm run build:corpus
```

Source choice (spec §2 fork): we use the **raw GitHub dump** + `pseudocatalogue.csv`,
not the HuggingFace mirror — `huggingface.co` was unreachable from the build
environment, and the GitHub dump gives both nikkud variants (`txt/` +
`txt_stripped/`) keyed by the same path, which is all we need.

### Current corpus stats (2026 dump, default `--max-lines 50`)

| metric | value |
| --- | --- |
| poems bundled | **11,255** (~28 MB) |
| unique authors | 410 |
| translations | 698 (de 363, ru 149, en 85, fr 26, la 18, grc 14, yi 14…) |
| length | p50 = 16 lines, capped at 50 for the feed |

Decisions baked into the pipeline (all reversible, all flagged):

- **Poem granularity — conservative.** Each catalogue entry is one poem; we do
  **not** split multi-poem files (false-merge is fine, false-split is ugly).
- **Length cap — default 50 lines.** The feed is "one poem per screen", so
  poems that can't fit a screen are excluded from the bundle (this also keeps it
  ~31 MB instead of ~88 MB). Pass `--max-lines 0` for the full corpus, or e.g.
  `--max-lines 250` to include long poems but drop whole-book "epic" entries.
- **Translations.** `author` stays the original poet (a translated Whitman reads
  as "Whitman"); the Hebrew translator is exposed in a `translator` field and
  surfaced as a small "מתורגם · תרגום: …" line.

## Run it in development

```bash
npm install
npm start          # then press 'a' for Android, or scan with Expo Go
npm run typecheck  # tsc --noEmit
```

## Build an installable APK

> ⚠️ APKs are built by **EAS Build** (Expo's cloud), which needs an Expo account
> and reaches `api.expo.dev`. That host is **not reachable** from the Claude Code
> web environment this was authored in, so the APK must be produced from a
> machine with normal network + your Expo login. Everything is configured and
> ready (`eas.json`, `app.json`); you just run:

```bash
npm i -g eas-cli
eas login
eas build -p android --profile preview   # outputs a sideloadable .apk
```

The `preview` profile builds an APK (not an AAB) for direct sideloading — fine
for personal use, no Play Store needed.

## Attribution

Content: **Project Ben-Yehuda** (benyehuda.org), public domain. A `source_url`
per poem links back to the original — please keep it.
Font: **Frank Ruhl Libre**, SIL Open Font License (see `assets/fonts/OFL.txt`).
