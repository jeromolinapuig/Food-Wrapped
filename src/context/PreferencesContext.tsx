import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { i18n } from '../lib/i18n';

type PreferencesContextValue = {
  language: string;
  currency: string;
  setLanguage: (lang: string) => void;
  setCurrency: (currency: string) => void;
  formatCurrency: (amount: number, options?: { fromCurrency?: string; toCurrency?: string }) => string;
  convertAmount: (amount: number, fromCurrency: string, toCurrency: string) => number;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const DEFAULT_RATES: Record<string, number> = {
  'EUR->EUR': 1,
  'EUR->THB': 38,
  'THB->EUR': 1 / 38,
  'EUR->USD': 1.08,
  'USD->EUR': 1 / 1.08,
};

const localeToCurrency: Record<string, string> = {
  es: 'EUR',
  es_ES: 'EUR',
  es_MX: 'EUR',
  en: 'USD',
  en_GB: 'GBP',
  fr: 'EUR',
  it: 'EUR',
  de: 'EUR',
  th: 'THB',
};

const loadLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem('bw-lang');
  if (stored) return stored;
  const navLang = window.navigator.language || window.navigator.languages?.[0];
  if (!navLang) return 'en';
  const short = navLang.slice(0, 2).toLowerCase();
  if (['en', 'es', 'th', 'fr', 'it', 'de'].includes(short)) return short;
  return 'en';
};

const loadHasStoredLanguage = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem('bw-lang'));
};

const loadCurrency = () => {
  if (typeof window === 'undefined') return 'EUR';
  const stored = window.localStorage.getItem('bw-currency');
  if (stored) return stored;
  const navLang = window.navigator.language || window.navigator.languages?.[0] || '';
  const normalized = navLang.replace('-', '_');
  return localeToCurrency[normalized] || localeToCurrency[navLang.slice(0, 2)] || 'EUR';
};

type PreferencesProviderProps = { children: ReactNode };

export function PreferencesProvider({ children }: Readonly<PreferencesProviderProps>) {
  const [language, setLanguageState] = useState<string>(loadLanguage);
  const [languagePersist, setLanguagePersist] = useState<boolean>(loadHasStoredLanguage);
  const [currency, setCurrencyState] = useState<string>(loadCurrency);
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES);

  useEffect(() => {
    i18n.changeLanguage(language).catch(() => {});
    if (typeof window !== 'undefined' && languagePersist) {
      window.localStorage.setItem('bw-lang', language);
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bw-currency', currency);
    }
  }, [currency]);

  useEffect(() => {
    const loadFx = async () => {
      try {
        const { data, error } = await supabase.from('exchange_rates').select('base_currency, target_currency, rate');
        if (error || !data) return;
        const next: Record<string, number> = { ...DEFAULT_RATES };
        data.forEach((row) => {
          const base = (row as { base_currency: string }).base_currency;
          const target = (row as { target_currency: string }).target_currency;
          const rate = Number((row as { rate: number }).rate);
          if (!base || !target || Number.isNaN(rate)) return;
          next[`${base}->${target}`] = rate;
        });
        setRates(next);
      } catch {
        // ignore if the table does not exist yet
      }
    };
    void loadFx();
  }, []);

  const convertAmount = useMemo(
    () =>
      (amount: number, fromCurrency: string, toCurrency: string) => {
        if (!Number.isFinite(amount)) return 0;
        const key = `${fromCurrency}->${toCurrency}`;
        const rate = rates[key];
        if (rate) return amount * rate;
        if (fromCurrency === toCurrency) return amount;
        // try inverse if available
        const inverseKey = `${toCurrency}->${fromCurrency}`;
        const inverseRate = rates[inverseKey];
        if (inverseRate) return amount / inverseRate;
        return amount;
      },
    [rates]
  );

  const formatCurrency = (amount: number, options?: { fromCurrency?: string; toCurrency?: string }) => {
    const origin = options?.fromCurrency ?? currency;
    const target = options?.toCurrency ?? currency;
    const value = convertAmount(amount, origin, target);
    try {
      return new Intl.NumberFormat(language, { style: 'currency', currency: target }).format(value);
    } catch {
      return `${target} ${value.toFixed(2)}`;
    }
  };

  const setLanguagePersisted = (lang: string) => {
    setLanguagePersist(true);
    setLanguageState(lang);
  };
  const setCurrency = (cur: string) => setCurrencyState(cur);

  const value: PreferencesContextValue = {
    language,
    currency,
    setLanguage: setLanguagePersisted,
    setCurrency,
    formatCurrency,
    convertAmount,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
};
