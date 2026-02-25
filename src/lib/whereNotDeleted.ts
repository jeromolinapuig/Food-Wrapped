type NullFilterQuery = {
  eq: (column: string, value: null) => unknown;
  is?: (column: string, value: null) => unknown;
};

export const whereNotDeleted = <T>(query: T): T => {
  const q = query as unknown as NullFilterQuery;
  if (typeof q.is === 'function') {
    return q.is('deleted_at', null) as T;
  }
  return q.eq('deleted_at', null) as T;
};
