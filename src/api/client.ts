export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Aigak-Client': 'local',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'REQUEST_FAILED' }));
    throw new Error(data.error || 'REQUEST_FAILED');
  }
  return response.json();
}
