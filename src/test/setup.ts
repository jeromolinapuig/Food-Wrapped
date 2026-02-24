import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
