import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, PersistedState, Settings } from '../types';

// Local-only user state, persisted on device. Kept entirely separate from the
// bundled, read-only corpus. One key, written debounced (see PersistedState).
const KEY = 'poetryfeed/state/v1';

const EMPTY: PersistedState = {
  saved_ids: [],
  seen_ids: [],
  settings: DEFAULT_SETTINGS,
};

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      saved_ids: parsed.saved_ids ?? [],
      seen_ids: parsed.seen_ids ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings as Settings) },
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    // Cap seen_ids so it can't grow unbounded over a long reading life.
    const trimmed: PersistedState = {
      ...state,
      seen_ids: state.seen_ids.slice(-5000),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Persistence is best-effort; a write failure shouldn't crash the feed.
  }
}
