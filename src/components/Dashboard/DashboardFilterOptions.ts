import type { FeedPriceFilter, FeedPriceFilterRange } from '../FeedTabs/types';
import type { MeatType } from './Dashboard';

type PriceFilterDefinition = {
  value: FeedPriceFilter;
  label: string;
  range?: FeedPriceFilterRange;
};

const eurPriceFilters: PriceFilterDefinition[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratis', range: { exact: 0 } },
  { value: '0-4.99', label: '0 a 4.99', range: { min: 0.01, max: 4.99 } },
  { value: '5-9.99', label: '5 a 9.99', range: { min: 5, max: 9.99 } },
  { value: '10-14.99', label: '10 a 14.99', range: { min: 10, max: 14.99 } },
  { value: '15-19.99', label: '15 a 19.99', range: { min: 15, max: 19.99 } },
  { value: '20-24.99', label: '20 a 24.99', range: { min: 20, max: 24.99 } },
  { value: '25-plus', label: 'Más de 25', range: { min: 25.01 } },
];

const usdPriceFilters: PriceFilterDefinition[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratis', range: { exact: 0 } },
  { value: '0-4.99', label: '0 a 7.99', range: { min: 0.01, max: 7.99 } },
  { value: '5-9.99', label: '8 a 11.99', range: { min: 8, max: 11.99 } },
  { value: '10-14.99', label: '12 a 15.99', range: { min: 12, max: 15.99 } },
  { value: '15-19.99', label: '16 a 19.99', range: { min: 16, max: 19.99 } },
  { value: '20-24.99', label: '20 a 24.99', range: { min: 20, max: 24.99 } },
  { value: '25-plus', label: 'Más de 25', range: { min: 25.01 } },
];

const thbPriceFilters: PriceFilterDefinition[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratis', range: { exact: 0 } },
  { value: '0-4.99', label: '0 a 199', range: { min: 0.01, max: 199 } },
  { value: '5-9.99', label: '200 a 399', range: { min: 200, max: 399 } },
  { value: '10-14.99', label: '400 a 599', range: { min: 400, max: 599 } },
  { value: '15-19.99', label: '600 a 799', range: { min: 600, max: 799 } },
  { value: '20-24.99', label: '800 a 999', range: { min: 800, max: 999 } },
  { value: '25-plus', label: 'Más de 1000', range: { min: 1000 } },
];

const aedPriceFilters: PriceFilterDefinition[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratis', range: { exact: 0 } },
  { value: '0-4.99', label: '0 a 24.99', range: { min: 0.01, max: 24.99 } },
  { value: '5-9.99', label: '25 a 39.99', range: { min: 25, max: 39.99 } },
  { value: '10-14.99', label: '40 a 59.99', range: { min: 40, max: 59.99 } },
  { value: '15-19.99', label: '60 a 79.99', range: { min: 60, max: 79.99 } },
  { value: '20-24.99', label: '80 a 99.99', range: { min: 80, max: 99.99 } },
  { value: '25-plus', label: 'Más de 100', range: { min: 100 } },
];

const gbpPriceFilters: PriceFilterDefinition[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratis', range: { exact: 0 } },
  { value: '0-4.99', label: '0 a 4.99', range: { min: 0.01, max: 4.99 } },
  { value: '5-9.99', label: '5 a 9.99', range: { min: 5, max: 9.99 } },
  { value: '10-14.99', label: '10 a 14.99', range: { min: 10, max: 14.99 } },
  { value: '15-19.99', label: '15 a 19.99', range: { min: 15, max: 19.99 } },
  { value: '20-24.99', label: '20 a 24.99', range: { min: 20, max: 24.99 } },
  { value: '25-plus', label: 'Más de 25', range: { min: 25.01 } },
];

const jpyPriceFilters: PriceFilterDefinition[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratis', range: { exact: 0 } },
  { value: '0-4.99', label: '0 a 999', range: { min: 0.01, max: 999 } },
  { value: '5-9.99', label: '1000 a 1999', range: { min: 1000, max: 1999 } },
  { value: '10-14.99', label: '2000 a 2999', range: { min: 2000, max: 2999 } },
  { value: '15-19.99', label: '3000 a 3999', range: { min: 3000, max: 3999 } },
  { value: '20-24.99', label: '4000 a 4999', range: { min: 4000, max: 4999 } },
  { value: '25-plus', label: 'Más de 5000', range: { min: 5000 } },
];

const priceFiltersByCurrency: Record<string, PriceFilterDefinition[]> = {
  EUR: eurPriceFilters,
  USD: usdPriceFilters,
  GBP: gbpPriceFilters,
  THB: thbPriceFilters,
  AED: aedPriceFilters,
  JPY: jpyPriceFilters,
};

export const getPriceFiltersForCurrency = (currency: string) =>
  priceFiltersByCurrency[currency.toUpperCase()] ?? eurPriceFilters;

export const getCurrencySymbol = (currency: string) => {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
};

export const burgerTypeFilterOptions: { value: MeatType | 'all'; icon?: string; labelKey?: string; label?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'beef', icon: '/meat.png', labelKey: 'dashboard.beef' },
  { value: 'chicken', icon: '/chicken-leg.png', labelKey: 'dashboard.chicken' },
  { value: 'vegan', icon: '/plant.png', labelKey: 'dashboard.vegan' },
  { value: 'other', labelKey: 'dashboard.other', label: 'Otro' },
];
