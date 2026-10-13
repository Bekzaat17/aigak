import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { Lang } from '../../shared/types.ts';

export async function defaultTemplate(lang: Lang = 'ru') {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const p = (text: string) =>
    new Paragraph({
      children: text.split('\n').map((line, i) => new TextRun({ text: line, break: i ? 1 : 0 })),
      spacing: { after: 160 },
    });
  const h = (text: string) =>
    new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 140 } });
  const doc = new Document({
    creator: 'aigak',
    title: t('Материалы проверки интернет ресурса', 'Интернет ресурсты тексеру материалдары'),
    styles: {
      default: {
        title: { run: { font: 'Arial', size: 36, color: '000000' } },
        heading1: {
          run: { font: 'Arial', size: 26, color: '243C32' },
          paragraph: { keepNext: true },
        },
        document: {
          run: { font: 'Arial', size: 22, color: '000000' },
          paragraph: { spacing: { line: 280 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 },
          },
        },
        children: [
          new Paragraph({
            text: t(
              'Материалы проверки интернет ресурса',
              'Интернет ресурсты тексеру материалдары',
            ),
            heading: HeadingLevel.TITLE,
          }),
          p('{draft_notice}'),
          p(
            t(
              'Прошу рассмотреть приложенные материалы и оценить наличие оснований для предусмотренных законом мер.',
              'Қоса берілген материалдарды қарастырып, заңда көзделген шараларға негіздердің бар-жоғын бағалауды сұраймын.',
            ),
          ),
          p(t('Адресат ____________________', 'Адресат ____________________')),
          p(t('Правовое основание ____________________', 'Құқықтық негіз ____________________')),
          p('{case_number} · {title}'),
          p(
            t(
              'Источник {source_url}\nПолучено {created_at}\nОфицер {officer}\nПроверка {review_status}',
              'Дереккөз {source_url}\nАлынған уақыты {created_at}\nҚызметкер {officer}\nТексеру {review_status}',
            ),
          ),
          h(t('Результат анализа', 'Талдау нәтижесі')),
          p('{assessment}'),
          p(
            t(
              'Вероятность игорного предложения {likelihood}',
              'Ойын ұсынысының ықтималдығы {likelihood}',
            ),
          ),
          h(t('Признаки и подтверждающие фрагменты', 'Белгілер және растайтын үзінділер')),
          p('{findings}'),
          h(t('Опись материалов', 'Материалдар тізімдемесі')),
          p('{evidence_list}'),
          h(t('Ограничения', 'Шектеулер')),
          p('{limitations}'),
          h(t('Замечания офицера', 'Қызметкердің ескертулері')),
          p('{notes}'),
          p(t('Подпись и дата ____________________', 'Қолы және күні ____________________')),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
