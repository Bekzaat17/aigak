import {buildDossier} from '../../shared/dossier.ts';
import type {PackageDocument} from './contracts.ts';
import type {Lang} from '../../shared/types.ts';
import {appendixNumber} from './appendices.ts';
export function dossierText(c:PackageDocument,lang:Lang){
 if(c.analysisLevel!=='pro')return '';
 const t=(ru:string,kk:string)=>lang==='ru'?ru:kk;
 const d=buildDossier({...c,status:c.status==='verified'?'verified':'review'});
 const findings=[...c.findings,...(c.inspection?.stages||[]).flatMap(s=>s.observations)];
 return [t('ДОСЬЕ ДЛЯ ИНСПЕКТОРА','ИНСПЕКТОРҒА АРНАЛҒАН ДОСЬЕ'),
 ...d.tasks.map(task=>task.title[lang]+' — '+(task.status==='done'?t('проверено','тексерілді'):t('требует проверки','тексеру қажет'))+'\n'+task.detail[lang]),
 t('ПРАВОВЫЕ ОСНОВАНИЯ: ГИПОТЕЗЫ','ҚҰҚЫҚТЫҚ НЕГІЗДЕР: БОЛЖАМДАР'),
 ...d.legal.map(h=>{const norm=c.osint?.legalNorms?.find(n=>n.id===h.normId);return [norm?.title?.[lang]||t('Об игорном бизнесе','Ойын бизнесі туралы'),t('Статья','Бап')+' '+norm?.article,h.normQuote,h.reason[lang],...h.findingIds.map(id=>{const f=findings.find(f=>f.id===id);return f?t('Приложение','Қосымша')+' '+appendixNumber(c,f.evidenceId)+': «'+f.quote+'»':'';}),...h.missing.map(m=>t('Проверить','Тексеру')+': '+m[lang]),norm?.sourceUrl,norm?.retrievedAt].filter(Boolean).join('\n');}),
 ...(!d.legal.length?[t('Правовое основание не установлено.','Құқықтық негіз анықталмады.')]:[]),
 ...(c.legalReview?[t('Правовая проверка инспектора','Инспектордың құқықтық тексеруі'),c.legalReview.officer,c.legalReview.eventDate,c.legalReview.note]:[]),
 ].join('\n\n');
}
