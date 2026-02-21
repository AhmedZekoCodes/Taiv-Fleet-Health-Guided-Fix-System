/*
this type wraps any paginated list result so every endpoint uses the same shape.
consumers can tell when they have reached the end because items.length < limit.
*/

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
