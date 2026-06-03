export const BURGER_TYPE_OPTIONS = ['beef', 'chicken', 'vegan'] as const;
export const BURGER_SAUCE_OPTIONS = [
  'bbq',
  'burger_sauce',
  'mayonnaise',
  'honey_mustard',
  'truffle',
  'bacon_mayonnaise',
  'mustard',
  'ketchup',
  'sweet_and_sour',
  'sweet_chili',
  'cheese',
  'sriracha',
  'emmy',
  'yogurt',
] as const;
export const BURGER_DONENESS_OPTIONS = ['rare', 'medium', 'well_done'] as const;
export const BURGER_BREAD_OPTIONS = ['potato', 'brioche', 'crystal', 'classic'] as const;

export type BurgerTypePreference = (typeof BURGER_TYPE_OPTIONS)[number];
export type BurgerSaucePreference = (typeof BURGER_SAUCE_OPTIONS)[number];
export type BurgerDonenessPreference = (typeof BURGER_DONENESS_OPTIONS)[number];
export type BurgerBreadPreference = (typeof BURGER_BREAD_OPTIONS)[number];

export type BurgerPreferenceKey =
  | BurgerTypePreference
  | BurgerSaucePreference
  | BurgerDonenessPreference
  | BurgerBreadPreference;

export function isBurgerTypePreference(value: unknown): value is BurgerTypePreference {
  return BURGER_TYPE_OPTIONS.includes(value as BurgerTypePreference);
}

export function isBurgerSaucePreference(value: unknown): value is BurgerSaucePreference {
  return BURGER_SAUCE_OPTIONS.includes(value as BurgerSaucePreference);
}

export function isBurgerDonenessPreference(value: unknown): value is BurgerDonenessPreference {
  return BURGER_DONENESS_OPTIONS.includes(value as BurgerDonenessPreference);
}

export function isBurgerBreadPreference(value: unknown): value is BurgerBreadPreference {
  return BURGER_BREAD_OPTIONS.includes(value as BurgerBreadPreference);
}
