import { createContext, useContext, type ReactNode } from 'react';
import type { Person, Settings } from '../types';

export interface AppSettingsValue {
  people: Person[];
  sharedColor: string;
  currency: Settings['currency'];
}

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

export function AppSettingsProvider({ value, children }: { value: AppSettingsValue; children: ReactNode }) {
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

/** Household members plus the shared/currency display settings, read by any component that renders owner-grouped data. */
export function useAppSettings(): AppSettingsValue {
  const value = useContext(AppSettingsContext);
  if (!value) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return value;
}
