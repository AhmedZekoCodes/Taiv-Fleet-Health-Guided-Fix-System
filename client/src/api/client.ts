/*
this module provides a typed fetch wrapper used by all api functions.
all requests go through here so error handling is handled in one place.
*/

// base url is empty so vite proxy forwards /api/* to the backend
const BASE_URL = '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// performs a get request and parses the json response.
// throws ApiError for non-2xx responses so callers don't need to check status.
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}
