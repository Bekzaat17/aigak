import { useCallback } from 'react';
import type { CaseRecord } from '../../shared/types';
import { api } from '../api/client';

/** Transport and response handling shared by case editors. */
export function useCaseMutation(caseId: string, onChange?: (record: CaseRecord) => void) {
  return useCallback(
    async (resource: string, body: unknown, method = 'PATCH') => {
      const record = await api<CaseRecord>(`/api/cases/${caseId}/${resource}`, {
        method,
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      onChange?.(record);
      return record;
    },
    [caseId, onChange],
  );
}
