import { useCallback } from 'react';
import type { CaseRecord } from '../../shared/types';
import { mutateCase } from '../api/cases';

/** Transport and response handling shared by case editors. */
export function useCaseMutation(caseId: string, onChange?: (record: CaseRecord) => void) {
  return useCallback(
    async (resource: string, body: unknown, method = 'PATCH') => {
      const record = await mutateCase(caseId, resource, body, method);
      onChange?.(record);
      return record;
    },
    [caseId, onChange],
  );
}
