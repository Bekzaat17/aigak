import { useState } from 'react';
import { createDemo, getCase } from '../api/cases.ts';
import { useAsyncAction } from '../hooks/useAsyncAction.ts';
import { useCaseActions } from '../hooks/useCaseActions.ts';
import { useCaseSession } from '../hooks/useCaseSession.ts';
import { useDrawer } from '../hooks/useDrawer.ts';
import { useIntake } from '../hooks/useIntake.ts';
import { useLocale } from '../hooks/useLocale.ts';
import { useWorkspaceCatalog } from '../hooks/useWorkspaceCatalog.ts';
import { errors } from '../i18n/errors.ts';

/** Composition root for UI state. Feature components receive explicit view contracts. */
export function useAppController() {
  const locale = useLocale();
  const { lang, t } = locale;
  const drawer = useDrawer();
  const asyncAction = useAsyncAction();
  const { setError, run, error } = asyncAction;
  const catalog = useWorkspaceCatalog(setError);
  const { refreshHistory, templateId } = catalog;
  const session = useCaseSession(setError, refreshHistory, () => drawer.setDrawer(null));
  const { current, setCurrent, selectCase } = session;
  const actions = useCaseActions(current, setCurrent, run, refreshHistory);
  const intake = useIntake({ t, setError, run, templateId, selectCase, refreshHistory });
  const [query, setQuery] = useState('');
  const openDemo = () =>
    run(async () => {
      selectCase(await createDemo());
      await refreshHistory();
    });
  const openSavedCase = (id: string) => run(async () => selectCase(await getCase(id)));
  const changeTemplate = (file: File) => run(() => catalog.uploadTemplate(file));
  const errMessage =
    errors[error]?.[lang === 'ru' ? 0 : 1] ||
    t(
      'Не удалось выполнить действие. Проверьте соединение и повторите.',
      'Әрекет орындалмады. Байланысты тексеріп, қайталаңыз.',
    );
  return {
    ...locale,
    ...drawer,
    ...asyncAction,
    ...catalog,
    ...session,
    ...actions,
    ...intake,
    query,
    setQuery,
    openDemo,
    openSavedCase,
    changeTemplate,
    errMessage,
  };
}
export type AppController = ReturnType<typeof useAppController>;
