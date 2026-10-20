import { describe, expect, it } from 'vitest';
import { i18n } from '../../lib/i18n';
import en from '../../locales/en/burgerCatalog.json';

describe('Burger catalogue translations', () => {
  it.each(['es', 'en', 'fr', 'de', 'it', 'th', 'ja'])('registers all catalogue labels in %s', language => {
    for (const key of Object.keys(en)) {
      expect(i18n.exists(`burgerCatalog.${key}`, { lng: language, fallbackLng: false })).toBe(true);
    }
    const t = i18n.getFixedT(language);
    expect(t('burgerCatalog.ownCollection')).not.toBe(t('burgerCatalog.collection'));
    const summary = t('burgerCatalog.reviewSummary', { count: 3, users: 2 });
    expect(summary).toContain('3');
    expect(summary).toContain('2');
    expect(summary).not.toContain('{{');
  });
});
