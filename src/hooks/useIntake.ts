import React, { useState } from 'react';
import type { AnalysisLevel, CaseRecord } from '../../shared/types';
import { normalizeUrlInput } from '../../shared/url-input';
import { api } from '../api/client.ts';
export function useIntake({
  run,
  templateId,
  selectCase,
  refreshHistory,
}: {
  run: (action: () => Promise<void>) => Promise<void>;
  templateId: string;
  selectCase: (record: CaseRecord) => void;
  refreshHistory: () => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>('basic');
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const form = new FormData();
      const normalizedUrl = normalizeUrlInput(url);
      form.set('title', new URL(normalizedUrl).hostname);
      form.set('sourceType', 'url');
      form.set('sourceUrl', normalizedUrl);
      form.set('useAi', String(analysisLevel !== 'basic'));
      form.set('analysisLevel', analysisLevel);
      form.set('templateId', templateId);
      selectCase(await api<CaseRecord>('/api/cases', { method: 'POST', body: form }));
      await refreshHistory();
    });
  };
  return {
    url,
    setUrl,
    analysisLevel,
    setAnalysisLevel,
    start,
  };
}
