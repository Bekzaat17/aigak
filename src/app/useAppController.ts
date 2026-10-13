import { useEffect, useRef, useState } from 'react';
import type { CaseRecord, CaseSummary, Decision, Finding } from '../../shared/types';
import { busyStatuses } from '../../shared/types';
import { api } from '../api/client.ts';
import { useAsyncAction } from '../hooks/useAsyncAction.ts';
import { useDrawer } from '../hooks/useDrawer.ts';
import { useIntake } from '../hooks/useIntake.ts';
import { useLocale } from '../hooks/useLocale.ts';
import { errors } from '../i18n/errors.ts';
export function useAppController() {
  const { lang, setLang, t } = useLocale();
  const { drawer, setDrawer } = useDrawer();
  const { busy, setBusy, error, setError, run } = useAsyncAction();
  const [current, setCurrent] = useState<CaseRecord | null>(null);
  const [records, setRecords] = useState<CaseSummary[]>([]);
  const [ai, setAi] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [templateFields, setTemplateFields] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('builtin');
  const [tab, setTab] = useState<'analysis' | 'osint' | 'evidence' | 'law' | 'package' | 'audit'>(
    'analysis',
  );
  const [query, setQuery] = useState('');
  const templateRef = useRef<HTMLInputElement>(null);
  const refreshHistory = async () => setRecords(await api('/api/cases'));
  const refreshTemplates = async () => {
    const data = await api<{ templates: { id: string; name: string }[]; fields: string[] }>(
      '/api/templates',
    );
    setTemplates(data.templates);
    setTemplateFields(data.fields);
  };
  useEffect(() => {
    void (async () => {
      try {
        const health = await api<{ aiConfigured: boolean }>('/api/health');
        setAi(health.aiConfigured);
        await Promise.all([refreshHistory(), refreshTemplates()]);
        const id = window.location.hash.slice(1);
        if (id) setCurrent(await api(`/api/cases/${encodeURIComponent(id)}`));
      } catch {
        setError('CONNECTION_FAILED');
      }
    })();
  }, [setError]);
  const processing = current && busyStatuses.includes(current.status);
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId || !processing) return;
    let cancelled = false;
    const timer = setInterval(() => {
      api<CaseRecord>(`/api/cases/${currentId}`)
        .then((c) => {
          if (!cancelled) {
            setCurrent(c);
            if (!busyStatuses.includes(c.status)) void refreshHistory();
          }
        })
        .catch(() => {
          if (!cancelled) setError('CONNECTION_FAILED');
        });
    }, 1400);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentId, processing, setError]);
  const openTab = (next: typeof tab) => {
    setTab(next);
    requestAnimationFrame(() =>
      document.getElementById('result-sections')?.scrollIntoView({ block: 'start' }),
    );
  };
  const selectCase = (c: CaseRecord) => {
    setCurrent(c);
    window.location.hash = c.id;
    setTab('analysis');
    setDrawer(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => {
    setCurrent(null);
    window.history.replaceState(null, '', window.location.pathname);
    setError('');
  };
  const exportZip = () =>
    run(async () => {
      if (!current) return;
      const res = await fetch(`/api/cases/${current.id}/export`, {
        method: 'POST',
        headers: { 'X-Aigak-Client': 'local' },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${current.number}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setCurrent(await api(`/api/cases/${current.id}`));
    });
  const changeTemplate = async (file: File) =>
    run(async () => {
      const form = new FormData();
      form.append('template', file);
      const entry = await api<{ id: string }>('/api/templates', { method: 'POST', body: form });
      await refreshTemplates();
      setTemplateId(entry.id);
    });
  const errMessage =
    errors[error]?.[lang === 'ru' ? 0 : 1] ||
    t(
      'Не удалось выполнить действие. Проверьте соединение и повторите.',
      'Әрекет орындалмады. Байланысты тексеріп, қайталаңыз.',
    );
  const {
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
  } = useIntake({ t, setError, run, templateId, selectCase, refreshHistory });
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
  const openDemo = () =>
    run(async () => {
      selectCase(await api('/api/demo', { method: 'POST' }));
      await refreshHistory();
    });
  const openSavedCase = (id: string) => run(async () => selectCase(await api(`/api/cases/${id}`)));
  return {
    openDemo,
    openSavedCase,
    saveFinding,
    answerClarification,
    approveReview,
    lang,
    setLang,
    t,
    mode,
    setMode,
    url,
    setUrl,
    text,
    setText,
    files,
    setFiles,
    current,
    setCurrent,
    records,
    setRecords,
    busy,
    setBusy,
    error,
    setError,
    ai,
    setAi,
    analysisLevel,
    setAnalysisLevel,
    drawer,
    setDrawer,
    templates,
    setTemplates,
    templateFields,
    setTemplateFields,
    templateId,
    setTemplateId,
    tab,
    setTab,
    drag,
    setDrag,
    query,
    setQuery,
    uploadRef,
    templateRef,
    run,
    refreshHistory,
    refreshTemplates,
    processing,
    openTab,
    selectCase,
    reset,
    addFiles,
    start,
    exportZip,
    changeTemplate,
    errMessage,
  };
}
export type AppController = ReturnType<typeof useAppController>;
