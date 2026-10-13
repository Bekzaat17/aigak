import type { ReportLayout } from '../contracts.ts';
import { templateFields } from '../fields.ts';
import { reportHtml } from '../html.ts';

export class StandardReportLayout implements ReportLayout {
  readonly id = 'standard';
  html = reportHtml;
  fields = templateFields;
}
