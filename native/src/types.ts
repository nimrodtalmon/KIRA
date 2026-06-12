// Shape of one poem in assets/poems.json, produced by scripts/build_corpus.py.
export type Poem = {
  id: string;
  title: string;
  author: string;
  /** Hebrew translator, when this is a translation; null for originals. */
  translator: string | null;
  is_translation: boolean;
  /** The source poet for a translation (same as `author` here); null otherwise. */
  original_author: string | null;
  /** ISO-ish language code of the original (e.g. "de", "ru"); null for originals. */
  original_language: string | null;
  body_nikkud: string;
  body_plain: string;
  length_lines: number;
  source_url: string;
  tags: string[];
};

export type FilterMode = 'all' | 'original' | 'translated';

export type Settings = {
  nikkud: boolean;
  filter: FilterMode;
};

export type PersistedState = {
  saved_ids: string[];
  seen_ids: string[];
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = { nikkud: true, filter: 'all' };
