export const MIN_DATETIME_STRING = '2026-01-01T00:00';
export const MIN_DATE = new Date('2026-01-01T00:00:00');

export const formatLocalDateTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
