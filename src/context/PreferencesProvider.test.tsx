import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from './PreferencesProvider';
import { usePreferences } from './PreferencesContext';
import { detectLanguage, getLandingLanguage } from '../lib/language';

const { changeLanguage, single } = vi.hoisted(() => ({
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  single: vi.fn(),
}));
vi.mock('../lib/i18n', () => ({ i18n: { changeLanguage } }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'owner' } } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: (table: string) => table === 'profiles'
      ? { select: () => ({ eq: () => ({ single }) }) }
      : { select: async () => ({ data: [], error: null }) },
  },
}));

function CurrentPreferences() {
  const { language, currency } = usePreferences();
  return <p>{language} / {currency}</p>;
}

describe('Localized language preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    single.mockResolvedValue({ data: { preferred_language: 'es', preferred_currency: 'JPY' }, error: null });
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it.each(['es', 'en', 'fr', 'de', 'it', 'th', 'ja'])('recognizes /%s/ with and without a trailing slash', language => {
    expect(getLandingLanguage(`/${language}/`)).toBe(language);
    expect(getLandingLanguage(`/${language}`)).toBe(language);
  });

  it('does not treat an unknown or nested route as a localized landing', () => {
    expect(getLandingLanguage('/zz/')).toBeNull();
    expect(getLandingLanguage('/ja/other')).toBeNull();
    window.localStorage.setItem('bw-lang', 'invalid');
    expect(detectLanguage()).toBe('en');
  });

  it('keeps the URL language after local and profile preferences load', async () => {
    window.history.replaceState({}, '', '/ja/');
    window.localStorage.setItem('bw-lang', 'es');
    render(<PreferencesProvider><CurrentPreferences /></PreferencesProvider>);
    await screen.findByText('ja / JPY');
    expect(document.documentElement.lang).toBe('ja');
    expect(changeLanguage).toHaveBeenCalledWith('ja');
    expect(changeLanguage).not.toHaveBeenCalledWith('es');
  });

  it('still loads the saved profile language on app routes', async () => {
    window.history.replaceState({}, '', '/profile');
    render(<PreferencesProvider><CurrentPreferences /></PreferencesProvider>);
    await waitFor(() => expect(screen.getByText('es / JPY')).toBeInTheDocument());
  });
});
