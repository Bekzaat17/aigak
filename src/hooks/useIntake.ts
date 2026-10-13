import React, { useRef, useState } from 'react';
import type { AnalysisLevel, CaseRecord } from '../../shared/types';
import { normalizeUrlInput } from '../../shared/url-input';
import { api } from '../api/client.ts';
export function useIntake({
  t,
  setError,
  run,
  templateId,
  selectCase,
  refreshHistory,
}: {
  t: (ru: string, kk: string) => string;
  setError: (message: string) => void;
  run: (action: () => Promise<void>) => Promise<void>;
  templateId: string;
  selectCase: (record: CaseRecord) => void;
  refreshHistory: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'url' | 'file' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>('basic');
  const [drag, setDrag] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const addFiles = (incoming: File[]) => {
    const next = [...files, ...incoming];
    if (next.length > 5 || next.some((f) => f.size > 10 * 1024 * 1024)) {
      setError('LIMIT_FILE_SIZE');
      return;
    }
    setFiles(next);
    setError('');
  };
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const form = new FormData();
      const normalizedUrl = mode === 'url' ? normalizeUrlInput(url) : '';
      const title =
        mode === 'url'
          ? new URL(normalizedUrl).hostname
          : mode === 'file'
            ? files[0]?.name || t('Материалы', 'Материалдар')
            : text.slice(0, 80).replace(/\s+/g, ' ');
      form.set('title', title);
      form.set('sourceType', mode);
      form.set('sourceUrl', normalizedUrl);
      form.set('text', text);
      form.set('useAi', String(analysisLevel !== 'basic'));
      form.set('analysisLevel', analysisLevel);
      form.set('templateId', templateId);
      files.forEach((f) => form.append('files', f));
      selectCase(await api<CaseRecord>('/api/cases', { method: 'POST', body: form }));
      await refreshHistory();
    });
  };
  return {
    mode,
    setMode,
    url,
    setUrl,
    text,
    setText,
    files,
    setFiles,
    analysisLevel,
    setAnalysisLevel,
    drag,
    setDrag,
    uploadRef,
    addFiles,
    start,
  };
}
