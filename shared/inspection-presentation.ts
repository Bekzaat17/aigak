import type {InspectionStage,Lang} from './types.ts';

/** Serializable trace formatting shared by document layouts; contains no provider calls. */
export function aiStageDetails(stage:InspectionStage,lang:Lang):string {
  const lines:string[]=[];
  if(stage.review)lines.push(reviewLabels[stage.review.status][lang]);
  for(const attempt of stage.aiAttempts||[]){
    lines.push(`${attempt.profile}: ${attempt.requestedModel} → ${attempt.actualModel||'—'}; ${attempt.status}; ${attempt.durationMs} ms; tokens ${attempt.inputTokens??'—'}/${attempt.outputTokens??'—'}; ${attempt.promptVersion}; ${attempt.schemaVersion}`);
  }
  for(const u of stage.review?.uncertainties||[])lines.push(u[lang]);
  for(const c of stage.review?.contradictions||[])lines.push(`«${c.quote}» (${c.evidenceId}): ${c.explanation[lang]}`);
  for(const q of stage.review?.questions||[])lines.push((lang==='ru'?'Уточнить: ':'Нақтылау: ')+q[lang]);
  return lines.join('\n');
}

export const reviewLabels={
 indicators:{ru:'Есть признаки',kk:'Белгілер бар'},
 ambiguous:{ru:'Неоднозначно',kk:'Бірмәнді емес'},
 insufficient:{ru:'Недостаточно данных',kk:'Деректер жеткіліксіз'},
 not_found:{ru:'Признаки не обнаружены',kk:'Белгілер анықталмады'},
};
