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

  // seen_ids is high-churn and never read into render, so keep it in a ref and
  // flush with the rest of the persisted state rather than re-rendering on it.
  const seenRef = useRef<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [loadedPoems, persisted] = await Promise.all([loadPoems(), loadState()]);
        if (!alive) return;
        seenRef.current = new Set(persisted.seen_ids);
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
    };
  }, []);

  const byId = useMemo(() => new Map(poems.map((p) => [p.id, p])), [poems]);

  const flush = useCallback(
    (nextSaved: string[], nextSettings: Settings) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveState({
          saved_ids: nextSaved,
          seen_ids: Array.from(seenRef.current),
          settings: nextSettings,
        });
      }, 400);
    },
    [],
  );

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
        flush(next, settings);
        return next;
      });
    },
    [flush, settings],
  );

  const markSeen = useCallback(
    (id: string) => {
      if (seenRef.current.has(id)) return;
      seenRef.current.add(id);
      flush(savedIds, settings);
    },
    [flush, savedIds, settings],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        flush(savedIds, next);
        return next;
      });
    },
    [flush, savedIds],
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
