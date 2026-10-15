/** Validate deployment limits once; application stages receive values, never environment access. */
export function processingPolicy(env: Readonly<Record<string, string | undefined>>) {
  const integer = (name: string, fallback: number, min: number, max: number) => {
    if (!env[name]) return fallback;
    const value = Number(env[name]);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw Error('INVALID_' + name);
    return value;
  };
  return {
    budgetMs: integer('AIGAK_ANALYSIS_BUDGET_MS', 900000, 120000, 3600000),
    pageLimit: integer('AIGAK_SITE_PAGE_LIMIT', 12, 1, 50),
    depth: integer('AIGAK_SITE_DEPTH', 3, 1, 5),
  };
}
