import { newCase } from '../create-case.ts';
import type { IntakeDependencies } from './contracts.ts';
export function createDemo({ store, queue }: Pick<IntakeDependencies, 'store' | 'queue'>) {
  const existing = store.all().find((c) => c.demo);
  if (existing) return { record: existing, created: false };
  const c = newCase(store, {
    title: 'Демонстрационный материал / Үлгі материал',
    sourceType: 'text',
    useAi: false,
    demo: true,
  });
  store.addEvidence(
    c,
    Buffer.from(
      'СИНТЕТИЧЕСКИЙ ПРИМЕР AIGAK. Не является реальным сайтом.\nОнлайн-казино Example. Бонус 100% на первый депозит. Пополните счёт и получите 50 фриспинов. Вывод средств. Джекпот.\nСИНТЕТИКАЛЫҚ МЫСАЛ. Құмар ойын. Бонус алыңыз. Ақша салу және ақша шығару. Бәс тігу.\nИсточник: учебный текст, созданный для демонстрации.',
    ),
    {
      name: 'synthetic-demo.txt',
      mime: 'text/plain',
      kind: 'original',
      method: 'synthetic-demo',
    },
  );
  queue.add(c.id);
  return { record: store.get(c.id), created: true };
}
