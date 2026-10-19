import { createContext, useContext } from 'react';

export type PreferencesContextValue = {
  language: string;
  currency: string;
  setLanguage: (lang: string) => void;
  setCurrency: (currency: string) => void;
  formatCurrency: (amount: number, options?: { fromCurrency?: string; toCurrency?: string }) => string;
  convertAmount: (amount: number, fromCurrency: string, toCurrency: string) => number;
};

export const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
};
