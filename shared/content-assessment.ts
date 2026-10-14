import type { CollectionReport } from './collection.ts';
import type { InspectionStage } from './types.ts';

/** Content confidence is separate from legal applicability and infrastructure enrichment. */
export function reliableContentAssessment(
  stages: InspectionStage[],
  collection?: CollectionReport,
) {
  if (collection && collection.status !== 'adequate') return false;
  if (
    !['context', 'mechanics', 'verification', 'integrity'].every((id) =>
      stages.some((stage) => stage.id === id && stage.status === 'completed'),
    )
  )
    return false;
  const final =
    stages.find((stage) => stage.id === 'pro_review') ||
    stages.find((stage) => stage.id === 'verification');
  return (
    final?.status === 'completed' &&
    (!final.review || ['indicators', 'not_found'].includes(final.review.status))
  );
}
