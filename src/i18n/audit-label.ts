import type { Lang } from '../../shared/types';

export function auditLabel(action: string, lang: Lang) {
  const labels: Record<string, [string, string]> = {
    'case.created': ['Проверка создана', 'Тексеру құрылды'],
    'evidence.saved': ['Материал сохранён', 'Материал сақталды'],
    'collection.started': ['Сбор начат', 'Жинау басталды'],
    'analysis.started': ['Анализ начат', 'Талдау басталды'],
    'analysis.completed': ['Анализ завершён', 'Талдау аяқталды'],
    'analysis.ai.completed': ['AI-анализ завершён', 'AI талдауы аяқталды'],
    'finding.reviewed': ['Решение по признаку', 'Белгі бойынша шешім'],
    'clarification.answered': ['Ответ инспектора', 'Инспектор жауабы'],
    'case.reviewed': ['Проверка подтверждена', 'Тексеру расталды'],
    'package.export.requested': ['Запрошен экспорт пакета', 'Пакет экспорты сұралды'],
    'processing.failed': ['Ошибка обработки', 'Өңдеу қатесі'],
    'processing.interrupted': ['Обработка прервана', 'Өңдеу үзілді'],
  };
  return labels[action]?.[lang === 'ru' ? 0 : 1] || action;
}
