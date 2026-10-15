import type { CaseRecord } from '../../../shared/types';
import type { OsintStage } from '../../../shared/osint';
import type { ArtifactReviewer, CollectionStrategy } from '../ports/collection';
import type { PagePlanner } from '../ports/page-exploration';
import type { ProcessingContext } from '../ports/execution';
import type { ProcessingStage } from '../ports/processing';
import type { CaseStore } from '../ports/storage';
import { collectPublicPage } from '../collection/collect-public-page';

/** Breadth-first discovery, bounded by depth, page count and the shared run deadline. */
export class SiteExplorationStage implements ProcessingStage {
  readonly id = 'site-exploration-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'addEvidence' | 'event'>,
    private readonly planner: PagePlanner,
    private readonly strategies: readonly CollectionStrategy[],
    private readonly review: ArtifactReviewer,
    private readonly limits = { pageLimit: 12, depth: 3 },
  ) {}
  async execute(c: CaseRecord, context?: ProcessingContext) {
    if (c.analysisLevel !== 'pro' || !c.osint || !c.collection) return;
    const signal = context?.signal || AbortSignal.timeout(360000);
    const start = Date.now();
    const visited = new Set<string>();
    const ids: string[] = [];
    let available = 0;
    const stage: OsintStage = {
      id: 'site-exploration',
      version: '1.0.0',
      status: 'partial' as const,
      durationMs: 0,
      evidenceIds: ids,
      summary: { ru: '', kk: '' },
      pages: [],
    };
    c.osint.stages.push(stage);
    const update = () => {
      stage.durationMs = Date.now() - start;
      const remaining = this.planner.plan(c).filter((p) => !visited.has(p.url)).length;
      stage.summary = {
        ru: `Подстраницы: начат сбор ${visited.size}, получено содержимое ${available}; ещё опубликованных ссылок в очереди: ${remaining}. Предел: ${this.limits.pageLimit} страниц, глубина ${this.limits.depth}, общий бюджет времени. Непроверенные страницы не считаются безопасными.`,
        kk: `Ішкі беттер: ${visited.size} тексерілді, ${available} мазмұны алынды; кезекте ${remaining} сілтеме. Шек: ${this.limits.pageLimit} бет, тереңдік ${this.limits.depth}, жалпы уақыт шегі. Тексерілмеген беттер қауіпсіз деп саналмайды.`,
      };
    };
    update();
    c.step = { ru: 'Проверяем внутренние страницы сайта', kk: 'Сайттың ішкі беттерін тексереміз' };
    await this.store.event(c, 'site-exploration.started');
    for (
      let depth = 0;
      depth < this.limits.depth && visited.size < this.limits.pageLimit;
      depth++
    ) {
      const frontier = this.planner
        .plan(c)
        .filter((p) => !visited.has(p.url))
        .slice(
          0,
          Math.min(
            Math.ceil(this.limits.pageLimit / this.limits.depth),
            this.limits.pageLimit - visited.size,
          ),
        );
      if (!frontier.length) break;
      for (const request of frontier) {
        signal.throwIfAborted();
        visited.add(request.url);
        const page: NonNullable<OsintStage['pages']>[number] = {
          url: request.url,
          depth: depth + 1,
          status: 'started',
          evidenceIds: [],
        };
        stage.pages!.push(page);
        update();
        await this.store.event(c, 'site-exploration.page', request.url);
        const result = await collectPublicPage(
          this.store,
          c,
          request.url,
          this.strategies,
          this.review,
          signal,
          'site-exploration',
        );
        ids.push(...result.evidenceIds);
        page.evidenceIds = result.evidenceIds;
        page.status = result.available ? 'available' : 'unavailable';
        if (result.available) available++;
        update();
      }
    }
    update();
    await this.store.event(c, 'site-exploration.completed', stage.summary.ru);
  }
}
