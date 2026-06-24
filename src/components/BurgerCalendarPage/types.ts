export type BurgerCalendarDayStatus = 'empty' | 'one' | 'multiple';

export type BurgerCalendarEntry = {
  id: string;
  datetime: string;
  created_at?: string | null;
  photo_url?: string | null;
  rating?: number | null;
  price?: number | null;
  currency?: string | null;
  restaurant?: {
    name?: string | null;
  } | null;
  burger?: {
    name?: string | null;
    meat_type?: string | null;
  } | null;
};

export type BurgerCalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  entries: BurgerCalendarEntry[];
};

export type BurgerCalendarMonthStats = {
  totalBurgers: number;
  burgerDays: number;
  maxBurgersInOneDay: number;
  averageBurgersPerBurgerDay: number;
  mostBurgerWeekday: string | null;
  totalSpent: number;
  averagePrice: number | null;
};
