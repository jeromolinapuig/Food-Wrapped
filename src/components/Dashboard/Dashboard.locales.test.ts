import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import es from '../../locales/es/dashboard.json';
import en from '../../locales/en/dashboard.json';
import fr from '../../locales/fr/dashboard.json';
import de from '../../locales/de/dashboard.json';
import itLocale from '../../locales/it/dashboard.json';
import th from '../../locales/th/dashboard.json';
import ja from '../../locales/ja/dashboard.json';
import esProfile from '../../locales/es/profile.json';
import enProfile from '../../locales/en/profile.json';
import frProfile from '../../locales/fr/profile.json';
import deProfile from '../../locales/de/profile.json';
import itProfile from '../../locales/it/profile.json';
import thProfile from '../../locales/th/profile.json';
import jaProfile from '../../locales/ja/profile.json';
import esCalendar from '../../locales/es/burgerCalendar.json';
import enCalendar from '../../locales/en/burgerCalendar.json';

const locales = { es, en, fr, de, it: itLocale, th, ja };
const profiles = { esProfile, enProfile, frProfile, deProfile, itProfile, thProfile, jaProfile };

describe('Dashboard translations', () => {
  it('incluye el diálogo y los controles nuevos en los siete idiomas', () => {
    for (const locale of Object.values(locales)) {
      for (const key of ['subtitle', 'userSummary', 'yearNavigation', 'previousYear', 'nextYear', 'emptyYear', 'openNotifications', 'deleteTitle', 'deleteMessage', 'unknownRestaurant', 'processing', 'deleteError', 'invitesError', 'filters', 'dateFilter', 'priceFilter', 'other', 'free', 'priceRange', 'priceAbove']) {
        expect(locale[key as keyof typeof locale]).toBeTruthy();
      }
    }
    for (const locale of Object.values(profiles)) {
      for (const key of ['settingsTitle', 'openSettings', 'noBio', 'emailLabel', 'visibilityLabel', 'visibilityPublic', 'visibilityPrivate', 'socialStats', 'aboutTitle', 'noPreferences']) {
        expect(locale[key as keyof typeof locale]).toBeTruthy();
      }
    }
  });

  it('muestra el diálogo de eliminación traducido en español e inglés', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { es: { translation: { dashboard: es, burgerCalendar: esCalendar } }, en: { translation: { dashboard: en, burgerCalendar: enCalendar } } }, lng: 'es', interpolation: { escapeValue: false } });
    expect(i18n.t('dashboard.deleteMessage', { date: '23/9', restaurant: 'Burger Place' })).toContain('¿Seguro');
    expect(i18n.t('burgerCalendar.summaryTitle', { year: 2025 })).toContain('2025');
    await i18n.changeLanguage('en');
    expect(i18n.t('dashboard.deleteMessage', { date: '9/23', restaurant: 'Burger Place' })).toContain('Are you sure');
    expect(i18n.t('burgerCalendar.summaryTitle', { year: 2026 })).toContain('2026');
  });
});
