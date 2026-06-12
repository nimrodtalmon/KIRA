import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { loadPoems } from './data/corpus';
import { loadState, saveState } from './data/store';
import { DEFAULT_SETTINGS, Poem, Settings } from './types';

type AppStateValue = {
  ready: boolean;
  error: string | null;
  poems: Poem[];
  byId: Map<string, Poem>;
  settings: Settings;
  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  markSeen: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  /** Non-reactive snapshot of seen ids, for building a feed deck. */
  getSeen: () => Set<string>;
};

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  // Latest values mirrored into refs so the persist() and the mutators can be
  // STABLE (empty deps). FeedScreen captures markSeen once in a FlatList ref, so
  // these mutators must not go stale or a scroll could clobber a fresh like.
  const savedRef = useRef<string[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const seenRef = useRef<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [loadedPoems, persisted] = await Promise.all([loadPoems(), loadState()]);
        if (!alive) return;
        seenRef.current = new Set(persisted.seen_ids);
        savedRef.current = persisted.saved_ids;
        settingsRef.current = persisted.settings;
        setSavedIds(persisted.saved_ids);
        setSettingsState(persisted.settings);
        setPoems(loadedPoems);
        setReady(true);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const byId = useMemo(() => new Map(poems.map((p) => [p.id, p])), [poems]);

  // Debounced write of whatever the refs currently hold.
  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveState({
        saved_ids: savedRef.current,
        seen_ids: Array.from(seenRef.current),
        settings: settingsRef.current,
      });
    }, 400);
  }, []);

  const isSaved = useCallback((id: string) => savedRef.current.includes(id), []);

  const toggleSaved = useCallback(
    (id: string) => {
      const prev = savedRef.current;
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      savedRef.current = next;
      setSavedIds(next);
      persist();
    },
    [persist],
  );

  const markSeen = useCallback(
    (id: string) => {
      if (seenRef.current.has(id)) return;
      seenRef.current.add(id);
      persist();
    },
    [persist],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettingsState(next);
      persist();
    },
    [persist],
  );

  const getSeen = useCallback(() => new Set(seenRef.current), []);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      error,
      poems,
      byId,
      settings,
      savedIds,
      isSaved,
      toggleSaved,
      markSeen,
      setSettings,
      getSeen,
    }),
    [ready, error, poems, byId, settings, savedIds, isSaved, toggleSaved, markSeen, setSettings, getSeen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used within AppStateProvider');
  return v;
}
