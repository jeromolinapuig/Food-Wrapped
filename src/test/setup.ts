import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Use browser storage even when Node exposes its own localStorage global.
const { jsdom } = globalThis as unknown as {
  jsdom: { window: { localStorage: Storage; sessionStorage: Storage } };
};
for (const key of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(window, key, {
    configurable: true,
    get: () => jsdom.window[key],
  });
}

const stableT = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key;
const stableI18n = {
  changeLanguage: vi.fn().mockResolvedValue(undefined),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: stableI18n,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('@mui/icons-material', () => {
  const icon = () => null;
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'then') return undefined;
        return icon;
      },
    }
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
