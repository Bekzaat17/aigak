import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Search, MessageSquareText, FolderArchive } from 'lucide-react';
export interface IntakeStepsProps {
  lang: Lang;
}
export function IntakeSteps({ lang }: IntakeStepsProps) {
  const t = translator(lang);

  return (
    <>
      {' '}
      <section className="steps">
        {[
          {
            icon: Search,
            n: '01',
            title: t('Проверяем материал', 'Материалды тексереміз'),
            body: t(
              'Извлекаем текст и находим признаки игорного предложения.',
              'Мәтінді алып, ойын ұсынысының белгілерін іздейміз.',
            ),
          },
          {
            icon: MessageSquareText,
            n: '02',
            title: t('Уточняем вместе', 'Бірге нақтылаймыз'),
            body: t(
              'Показываем источники и задаём вопросы там, где нужна ваша оценка.',
              'Дереккөздерді көрсетіп, сіздің бағаңыз қажет жерде сұрақ қоямыз.',
            ),
          },
          {
            icon: FolderArchive,
            n: '03',
            title: t('Собираем пакет', 'Пакетті жинаймыз'),
            body: t(
              'Документы по вашему шаблону, оригиналы и опись — в одном архиве.',
              'Үлгіңіз бойынша құжаттар, түпнұсқалар мен тізімдеме — бір мұрағатта.',
            ),
          },
        ].map((s) => (
          <article key={s.n}>
            <div>
              <s.icon size={21} />
              <span>{s.n}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}
