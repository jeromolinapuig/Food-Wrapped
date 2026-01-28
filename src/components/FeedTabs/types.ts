export type FeedTab = 'following' | 'global';

export type FeedEntry = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  datetime: string;
  price: number;
  currency: string | null;
  rating: number;
  isBurger: boolean;
  additionalNotes: string | null;
  restaurantId: string | null;
  burgerId: string | null;
  meatType: 'beef' | 'chicken' | 'vegan' | 'other' | null;
  restaurantName: string | null;
  burgerName: string | null;
  photoUrl: string | null;
  burgerOrigin: 'restaurant' | 'homemade' | null;
  ingredients: string | null;
};

export type SupabaseEntryRow = {
  id: string;
  user_id: string;
  datetime: string;
  price: number | null;
  rating: number | null;
  is_burger: boolean | null;
  additional_notes: string | null;
  currency?: string | null;
  restaurant_id: string | null;
  burger_id: string | null;
  meat_type?: 'beef' | 'chicken' | 'vegan' | 'other' | null;
  burger_origin?: 'restaurant' | 'homemade' | null;
  visibility?: string | null;
  photo_url: string | null;
  homemade_ingredients?: string | null;
  restaurants: { name: string | null } | null;
  burgers: { name: string | null; meat_type: 'beef' | 'chicken' | 'vegan' | 'other' | null } | null;
};

export type MonthOption = { value: string; label: string };
