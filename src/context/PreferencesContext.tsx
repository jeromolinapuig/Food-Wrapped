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

const DEFAULT_EUR_RATES: Record<string, number> = {
  EUR: 1,
  AED: 4.27479,
  GBP: 0.86433,
  JPY: 186.08,
  THB: 37.987,
  USD: 1.164,
};

const buildRatesFromEurRates = (eurRates: Record<string, number>) => {
  const rates: Record<string, number> = {};
  Object.entries(eurRates).forEach(([baseCurrency, baseRate]) => {
    Object.entries(eurRates).forEach(([targetCurrency, targetRate]) => {
      rates[`${baseCurrency}->${targetCurrency}`] = targetRate / baseRate;
    });
  });
  return rates;
};

const DEFAULT_RATES: Record<string, number> = buildRatesFromEurRates(DEFAULT_EUR_RATES);
const SUPPORTED_LANGUAGES = ['en', 'es', 'th', 'fr', 'it', 'de', 'ja'];
const SUPPORTED_CURRENCIES = ['EUR', 'THB', 'USD', 'GBP', 'AED', 'JPY'];

const localeToCurrency: Record<string, string> = {
  es: 'EUR',
  es_ES: 'EUR',
  es_MX: 'EUR',
  en: 'USD',
  en_GB: 'GBP',
  en_AE: 'AED',
  ar_AE: 'AED',
  fr: 'EUR',
  it: 'EUR',
  de: 'EUR',
  th: 'THB',
  ja: 'JPY',
  ja_JP: 'JPY',
};

const loadLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem('bw-lang');
  if (stored) return stored;
  const navLang = window.navigator.language || window.navigator.languages?.[0];
  if (!navLang) return 'en';
  const short = navLang.slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(short)) return short;
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
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language, languagePersist]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bw-currency', currency);
    }
  }, [currency]);

  useEffect(() => {
    let cancelled = false;

    const loadProfilePreferences = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_language, preferred_currency')
        .eq('id', userId)
        .single();

      if (cancelled || error || !data) return;

      const profile = data as {
        preferred_language?: string | null;
        preferred_currency?: string | null;
      };
      const nextLanguage = profile.preferred_language ?? null;
      const nextCurrency = profile.preferred_currency ?? null;

      if (nextLanguage && SUPPORTED_LANGUAGES.includes(nextLanguage)) {
        setLanguagePersist(true);
        setLanguageState(nextLanguage);
      }
      if (nextCurrency && SUPPORTED_CURRENCIES.includes(nextCurrency)) {
        setCurrencyState(nextCurrency);
      }
    };

    void loadProfilePreferences();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      void loadProfilePreferences();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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
