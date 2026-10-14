import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaseRecord } from '../../shared/types';
import { busyStatuses } from '../../shared/types';
import { getCase } from '../api/cases.ts';
import type { CaseTab } from '../features/case-workspace/contracts.ts';

export function useCaseSession(
  setError: (error: string) => void,
  refreshHistory: () => Promise<void>,
  closeDrawer: () => void,
) {
  const [current, setRecord] = useState<CaseRecord | null>(null);
  const navigationVersion = useRef(0);
  const selectionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => selectionRequest.current?.abort(), []);
  const [tab, setTab] = useState<CaseTab>('analysis');
  const processing = !!current && busyStatuses.includes(current.status);
  const currentId = current?.id;
  // A mutation finishing for an old case must not replace the newly selected case.
  const setCurrent = useCallback(
    (record: CaseRecord) =>
      setRecord((previous) => (previous?.id === record.id ? record : previous)),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    const version = navigationVersion.current;
    const id = window.location.hash.slice(1);
    if (id)
      void getCase(id, controller.signal)
        .then((record) => {
          if (!controller.signal.aborted && version === navigationVersion.current)
            setRecord((previous) => previous ?? record);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('CONNECTION_FAILED');
        });
    return () => controller.abort();
  }, [setError]);
  useEffect(() => {
    if (!currentId || !processing) return;
    const controller = new AbortController();
    let pending = false;
    const timer = setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const record = await getCase(currentId, controller.signal);
        if (!controller.signal.aborted) {
          setCurrent(record);
          if (!busyStatuses.includes(record.status)) await refreshHistory();
        }
      } catch {
        if (!controller.signal.aborted) setError('CONNECTION_FAILED');
      } finally {
        pending = false;
      }
    }, 1400);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [currentId, processing, setCurrent, refreshHistory, setError]);
  const openTab = (next: CaseTab) => {
    setTab(next);
    requestAnimationFrame(() =>
      document.getElementById('result-sections')?.scrollIntoView({ block: 'start' }),
    );
  };
  const reviewFindings = () => {
    if (!current?.findings.some((finding) => finding.decision === 'pending'))
      return openTab('package');
    setTab('analysis');
    requestAnimationFrame(() =>
      document
        .getElementById('findings-workspace')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };
  const selectCase = (record: CaseRecord) => {
    selectionRequest.current?.abort();
    navigationVersion.current++;
    setRecord(record);
    window.location.hash = record.id;
    setTab('analysis');
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => {
    selectionRequest.current?.abort();
    navigationVersion.current++;
    setRecord(null);
    window.history.replaceState(null, '', window.location.pathname);
    setError('');
  };
  const loadCase = async (id: string) => {
    selectionRequest.current?.abort();
    const request = new AbortController();
    selectionRequest.current = request;
    try {
      const record = await getCase(id, request.signal);
      if (!request.signal.aborted) selectCase(record);
    } catch (error) {
      if (!request.signal.aborted) throw error;
    }
  };
  return {
    current,
    setCurrent,
    processing,
    tab,
    openTab,
    reviewFindings,
    selectCase,
    loadCase,
    reset,
  };
}
