import type { CaseRecord, CaseSummary } from '../../shared/types';
import { api } from './client.ts';
export const listCases = (signal?: AbortSignal) => api<CaseSummary[]>('/api/cases', { signal });
export const getCase = (id: string, signal?: AbortSignal) =>
  api<CaseRecord>(`/api/cases/${encodeURIComponent(id)}`, { signal });
export const createDemo = () => api<CaseRecord>('/api/demo', { method: 'POST' });
export async function exportCaseArchive(id: string): Promise<Blob> {
  const response = await fetch(`/api/cases/${encodeURIComponent(id)}/export`, {
    method: 'POST',
    headers: { 'X-Aigak-Client': 'local' },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'REQUEST_FAILED' }));
    throw new Error(data.error || 'REQUEST_FAILED');
  }
  return response.blob();
}
