import { useEffect, useState } from 'react';
import type { AppData } from '../types';
import { migrations, CURRENT_SCHEMA_VERSION } from './migrations';

const STORAGE_KEY = 'ledger:data:v1';
/** Previous key, from before the app was renamed from "finance-forecaster" — read once as a fallback so existing saved data isn't lost. */
const LEGACY_STORAGE_KEY = 'finance-forecaster:data:v1';

interface StoredBlob {
  schemaVersion: number;
  data: AppData;
}

export function loadData(fallback: AppData): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    // Blobs saved before schema versioning existed are bare AppData, treated as v1.
    const isVersioned = typeof parsed.schemaVersion === 'number' && parsed.data;
    let schemaVersion: number = isVersioned ? parsed.schemaVersion : 1;
    let data = isVersioned ? parsed.data : parsed;

    // Basic shape check so a corrupted/unrecognised blob doesn't crash the app
    if (!data.accounts || !data.settings) return fallback;

    for (let v = schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
      data = migrations[v - 1](data);
    }

    // Defensive re-pass: a blob can end up tagged as the current version but still be
    // missing fields (e.g. a dev hot-reload saved mid-migration) — the version number
    // alone isn't a guarantee of shape. Every migration is written to be idempotent
    // (defaults are always overridden by any real value already present), so it's safe
    // to run the whole chain again unconditionally as a final backfill.
    for (const migrate of migrations) {
      data = migrate(data);
    }

    return data as AppData;
  } catch {
    return fallback;
  }
}

export function saveData(data: AppData) {
  try {
    const blob: StoredBlob = { schemaVersion: CURRENT_SCHEMA_VERSION, data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — fail silently,
    // the user's data just won't persist across sessions.
  }
}

/** Keeps app state in sync with localStorage, saving on every change. */
export function usePersistedData(fallback: AppData) {
  const [data, setData] = useState<AppData>(() => loadData(fallback));

  useEffect(() => {
    saveData(data);
  }, [data]);

  return [data, setData] as const;
}

export function newId(): string {
  return crypto.randomUUID();
}
