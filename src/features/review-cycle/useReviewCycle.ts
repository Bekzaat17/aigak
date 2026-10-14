import { useState } from 'react';
import type { AnalysisLevel, CaseRecord } from '../../../shared/types';
import { useCaseMutation } from '../../hooks/useCaseMutation';
export function useReviewCycle(
  c: CaseRecord,
  update: (record: CaseRecord) => void,
  run: (fn: () => Promise<void>) => Promise<unknown>,
) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<AnalysisLevel>(c.analysisLevel);
  const mutate = useCaseMutation(c.id, update);
  const request = async (path: string, method: string, body: unknown) => {
    await mutate(path, body, method);
  };

  const saveMaterials = () =>
    run(async () => {
      const body = new FormData();
      body.set('text', text);
      files.forEach((file) => body.append('files', file));
      await request('materials', 'POST', body);
      setText('');
      setFiles([]);
    });
  const saveAnswer = (id: string, answer: string, evidenceIds: string[]) =>
    run(() => request('questions/' + id, 'PATCH', { answer, evidenceIds }));
  const reanalyze = () => run(() => request('reanalyze', 'POST', { analysisLevel: level }));
  return { text, setText, files, setFiles, level, setLevel, saveMaterials, saveAnswer, reanalyze };
}
