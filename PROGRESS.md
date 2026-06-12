# Poetry Feed — build progress & handoff

Status as of this branch (`claude/repo-restructure-md-impl-oom994`). Built from
`poetryfeedspec.md`. All four milestones are implemented; the only thing that
can't be done from this environment is producing the actual `.apk` (see below).

## Milestones

| | Milestone | Status |
| --- | --- | --- |
| **M0** | Skeleton: Expo app boots, vertical full-screen pager, swipe-up, RTL | ✅ done |
| **M1** | Corpus: `build_corpus.py` → real `poems.pf`; shuffle + no-repeat | ✅ done |
| **M2** | State: like/save + Saved screen + Settings (nikkud, filter), persisted | ✅ done |
| **M3** | Polish: Hebrew font, length-aware sizing, long-poem scroll, share, source link, app config | ✅ done* |

\*M3 minus a bespoke app icon (still the default Expo icon) and the signed APK
itself — both need your Expo account / a machine with normal network.

## Verified here

- `tsc --noEmit` — clean.
- `expo export --platform android` — clean (843 modules, `poems.pf` bundled as a
  32 MB runtime asset, JS bundle only 2.1 MB → corpus is **not** inlined).
- Corpus pipeline run end-to-end against the real Ben-Yehuda dump:
  **11,172 poems, 406 authors, 698 translations.**

## NOT verified (no Android device/emulator in this environment)

Runtime behaviour on a real device — paging smoothness, RTL line-wrapping on
edge cases (very long titles, one-line poems), first-launch 32 MB parse time.
The bundle compiles and exports; on-device QA is the natural next step.

## The one blocker: building the APK

APKs are produced by **EAS Build** (Expo cloud), which needs an Expo login and
reaches `api.expo.dev` — that host is blocked from the Claude Code web sandbox,
and there's no local Android SDK here. Everything is configured (`eas.json`,
`app.json` with `org.kira.poetryfeed`). From any normal machine:

```bash
npm install
npm i -g eas-cli && eas login
eas build -p android --profile preview   # → sideloadable .apk
```

## Decisions I made (flagging per spec §9.6) — easy to change

1. **Stack: Expo** (not Flutter). Fastest path to a sideloadable APK.
2. **Corpus source: raw GitHub dump** (HuggingFace was network-blocked).
3. **Length cap: 50 lines** bundled by default (one poem = one screen; keeps the
   bundle ~31 MB vs ~88 MB). `--max-lines 0` ships everything. **This is the most
   likely thing you'll want to tune** — say the word and I'll rebuild at any cap.
4. **Poem granularity: conservative** — one catalogue entry = one poem, no
   splitting. Some entries are short sequences rather than a single poem; that's
   the "false-merge is fine" trade from the spec.
5. **Translations:** `author` = original poet (a translated Whitman reads as
   "Whitman"); translator shown on a small "מתורגם · תרגום: …" line.
6. **No forced global RTL** — per-component `writingDirection: 'rtl'` + explicit
   layout instead, which is predictable without a device to test flips on. If
   you'd rather force app-wide RTL (flips tab order etc.), that's a small change.

## Obvious next steps

- Build the APK (above) and do on-device QA.
- Custom app icon + splash (currently Expo defaults).
- Optional: a curated "good feed" subset, or poet-level filtering (the data
  already carries `author` / `is_translation` / `original_language` for it).
