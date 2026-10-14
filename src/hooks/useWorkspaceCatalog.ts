import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaseSummary } from '../../shared/types';
import { api } from '../api/client.ts';
import { listCases } from '../api/cases.ts';

type TemplatesResponse = { templates: { id: string; name: string }[]; fields: string[] };
export function useWorkspaceCatalog(setError: (error: string) => void) {
  const [records, setRecords] = useState<CaseSummary[]>([]);
  const [ai, setAi] = useState(false);
  const [templates, setTemplates] = useState<TemplatesResponse['templates']>([]);
  const [templateFields, setTemplateFields] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('builtin');
  const templateRef = useRef<HTMLInputElement>(null);
  const refreshHistory = useCallback(async (signal?: AbortSignal) => {
    const records = await listCases(signal);
    if (!signal?.aborted) setRecords(records);
  }, []);
  const refreshTemplates = useCallback(async (signal?: AbortSignal) => {
    const data = await api<TemplatesResponse>('/api/templates', { signal });
    if (!signal?.aborted) {
      setTemplates(data.templates);
      setTemplateFields(data.fields);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      api<{ aiConfigured: boolean }>('/api/health', { signal }).then((health) => {
        if (!signal.aborted) setAi(health.aiConfigured);
      }),
      refreshHistory(signal),
      refreshTemplates(signal),
    ]).catch(() => {
      if (!signal.aborted) setError('CONNECTION_FAILED');
    });
    return () => controller.abort();
  }, [refreshHistory, refreshTemplates, setError]);
  const uploadTemplate = async (file: File) => {
    const body = new FormData();
    body.append('template', file);
    const entry = await api<{ id: string }>('/api/templates', { method: 'POST', body });
    await refreshTemplates();
    setTemplateId(entry.id);
  };
  return {
    records,
    ai,
    templates,
    templateFields,
    templateId,
    setTemplateId,
    templateRef,
    refreshHistory,
    uploadTemplate,
  };
}
