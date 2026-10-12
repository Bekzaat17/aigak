# Что переиспользуем

Проверено 12.10.2026 по официальным репозиториям.

| Проект | Возможности | Лицензия | Решение для aigak |
| --- | --- | --- | --- |
| [ArchiveBox](https://github.com/ArchiveBox/ArchiveBox) | Многоформатные архивы страниц, UI и интеграции | MIT | Архитектурный ориентир. Отдельный адаптер в следующей итерации; код не скопирован. |
| [Browsertrix Crawler](https://github.com/webrecorder/browsertrix-crawler) | Браузерная архивация WARC/WACZ | AGPL-3.0 | Кандидат для выделенного сборщика; не встроен в MVP. |
| [SingleFile](https://github.com/gildas-lormeau/SingleFile) | Самодостаточный HTML-снимок | AGPL-3.0 | Принимаем сохранённый HTML как файл; исходный код не включён. |
| [Playwright](https://github.com/microsoft/playwright) | Управление Chromium, скриншоты, DOM | Apache-2.0 | Реальная npm-зависимость, браузерный сборщик. |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Локальный OCR | Apache-2.0 | Реальная npm-зависимость; rus/kaz/eng. |
| [PDF.js](https://github.com/mozilla/pdf.js) | Извлечение PDF-текста | Apache-2.0 | Реальная npm-зависимость; сканированные страницы передаются в локальный OCR. |
| [JSZip](https://github.com/Stuk/jszip) | ZIP | MIT OR GPL-3.0-or-later | Используем по MIT. |

Не найдено в проверенной выборке готового решения, одновременно покрывающего RU/KK, сбор, проверяемый анализ игорного контента и согласованные казахстанские формы. Поэтому переиспользуем компоненты, а предметную модель и интерфейс пишем под задачу. Это не форк ArchiveBox и не интеграция Browsertrix — не выдаём планируемые возможности за готовые.

Лицензии зависимостей сохраняются в node_modules и фиксируются package-lock.json. Перед распространением сборки подготовить полный перечень транзитивных лицензий. Лицензию собственного приложения выбирает владелец репозитория.

AI: [Responses API](https://developers.openai.com/api/reference/responses/overview), [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Ключ только на сервере, store:false; это не обещание нулевого хранения со стороны провайдера. Отправка материалов включается отдельно для каждого дела.
