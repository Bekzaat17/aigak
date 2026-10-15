/** Observed transport requirements for public pages; no credentials or transaction endpoints. */
export const siteRequestRules = [
  {
    origin: 'https://sz.kz',
    path: '/api/fl',
    contentType: 'text/plain',
    maxBytes: 16384,
    maxRequests: 4,
  },
] as const;
