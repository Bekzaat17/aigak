import type { CaseRecord, Decision, Finding } from '../../shared/types';
import { api } from '../api/client.ts';
import { exportCaseArchive, getCase } from '../api/cases.ts';
import { downloadBlob } from '../lib/download.ts';
export function useCaseActions(
  current: CaseRecord | null,
  setCurrent: (record: CaseRecord) => void,
  run: (action: () => Promise<void>) => Promise<void>,
  refreshHistory: () => Promise<void>,
) {
  const saveFinding = (f: Finding, decision: Decision, note: string) => {
    if (!current) return;
    void run(async () =>
      setCurrent(
        await api(`/api/cases/${current.id}/findings/${f.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ decision, note }),
        }),
      ),
    );
  };
  const answerClarification = (questionId: string, answer: string, note: string) => {
    if (!current) return;
    void run(async () =>
      setCurrent(
        await api(`/api/cases/${current.id}/clarifications/${questionId}`, {
          method: 'PATCH',
          body: JSON.stringify({ answer, note }),
        }),
      ),
    );
  };
  const approveReview = (officer: string, notes: string) => {
    if (!current) return;
    void run(async () => {
      setCurrent(
        await api(`/api/cases/${current.id}/review`, {
          method: 'POST',
          body: JSON.stringify({ officer, notes }),
        }),
      );
      await refreshHistory();
    });
  };

  const exportZip = () =>
    run(async () => {
      if (!current) return;
      downloadBlob(await exportCaseArchive(current.id), `${current.number}.zip`);
      setCurrent(await getCase(current.id));
    });
  return { saveFinding, answerClarification, approveReview, exportZip };
}
