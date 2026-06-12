import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system/legacy';

import { FilterMode, Poem } from '../types';

// The corpus is ~31 MB, so we DON'T `import` it (that would inline 11k poems
// into the JS bundle and choke Hermes). Instead it ships as a bundled asset
// and we read + parse it once at runtime. metro.config.js registers `pf` as an
// asset extension so this require() resolves to a file, not a parsed object.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CORPUS_MODULE = require('../../assets/poems.pf');

let cache: Poem[] | null = null;

export async function loadPoems(): Promise<Poem[]> {
  if (cache) return cache;
  const asset = Asset.fromModule(CORPUS_MODULE);
  if (!asset.downloaded) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const text = await readAsStringAsync(uri);
  cache = JSON.parse(text) as Poem[];
  return cache;
}

export function filterPoems(poems: Poem[], filter: FilterMode): Poem[] {
  if (filter === 'original') return poems.filter((p) => !p.is_translation);
  if (filter === 'translated') return poems.filter((p) => p.is_translation);
  return poems;
}

/** Fisher–Yates, in place, returns the same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * First deck of the session: every poem matching the filter, in random order,
 * with not-yet-seen poems brought to the front so fresh material leads. No
 * repeats within the deck (it's a permutation).
 */
export function buildInitialDeck(
  poems: Poem[],
  filter: FilterMode,
  seenIds: Set<string>,
): Poem[] {
  const pool = filterPoems(poems, filter);
  const unseen = shuffle(pool.filter((p) => !seenIds.has(p.id)));
  const seen = shuffle(pool.filter((p) => seenIds.has(p.id)));
  return [...unseen, ...seen];
}

/**
 * Append another full shuffled pass to keep the feed effectively infinite,
 * avoiding an immediate repeat across the seam.
 */
export function extendDeck(deck: Poem[], poems: Poem[], filter: FilterMode): Poem[] {
  const next = shuffle(filterPoems(poems, filter).slice());
  if (next.length > 1 && deck.length && next[0].id === deck[deck.length - 1].id) {
    [next[0], next[1]] = [next[1], next[0]];
  }
  return deck.concat(next);
}
