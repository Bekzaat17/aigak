import { useState } from 'react';
import type { CaseRecord } from '../../../shared/types';
import { useCaseMutation } from '../../hooks/useCaseMutation.ts';
export function usePackagePreview(caseId: string, onChange: (record: CaseRecord) => void) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutate = useCaseMutation(caseId, onChange);
  const changeTemplate = async (templateId: string) => {
    setBusy(true);
    setError(false);
    try {
      await mutate('template', { templateId });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return { open, togglePreview: () => setOpen((value) => !value), error, busy, changeTemplate };
}
