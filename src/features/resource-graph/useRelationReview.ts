import { useState } from 'react';
import type { ResourceRelation } from '../../../shared/osint';
import type { CaseRecord } from '../../../shared/types';
import { useCaseMutation } from '../../hooks/useCaseMutation';
export function useRelationReview(
  c: CaseRecord,
  r: ResourceRelation,
  onChange?: (record: CaseRecord) => void,
) {
  const [note, setNote] = useState(r.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mutate = useCaseMutation(c.id, onChange);
  const save = async (decision: string) => {
    setBusy(true);
    setError(false);
    try {
      await mutate(`relations/${r.id}`, { decision, note });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return { note, setNote, busy, error, save };
}
