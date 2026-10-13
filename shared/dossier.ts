import type {CaseRecord,Localized} from './types.ts';
export interface DossierTask {id:string;title:Localized;status:'done'|'review'|'missing';detail:Localized}
/** Deterministic readiness: model confidence cannot make a blocking package ready. */
export function buildDossier(c:Pick<CaseRecord,'evidence'|'findings'|'inspection'|'followUps'|'clarifications'|'legalReview'|'sourceUrl'|'status'|'materialsPending'>){
 const legal=c.inspection?.stages.filter(s=>s.id==='legal'&&s.status==='completed').flatMap(s=>s.legalHypotheses||[])||[];
 const accepted=c.findings.filter(f=>f.decision==='accepted'&&f.scope!=='related');
 const sourceOk=c.clarifications.find(q=>q.id==='source')?.answer==='yes';
 const contentOk=accepted.length>0&&!c.findings.some(f=>f.decision==='pending')&&c.clarifications.find(q=>q.id==='context')?.answer==='yes';
 const jurisdiction=!!c.legalReview?.jurisdictionConfirmed&&!!c.legalReview?.eventDate;
 const previous=c.inspection?.stages.flatMap(s=>s.observations)||[];
 const supportedLegal=legal.filter(h=>h.findingIds.length>0&&h.findingIds.every(id=>{const original=previous.find(f=>f.id===id);return accepted.some(f=>f.id===id||(original&&f.evidenceId===original.evidenceId&&f.quote===original.quote));}));
 const lawOk=supportedLegal.length>0&&!!c.legalReview?.editionConfirmed&&!!c.legalReview?.officer.trim()&&!!c.legalReview?.note.trim();
 const unresolved=(c.followUps||[]).filter(q=>!q.answer.trim()).length;
 const aiOk=['verification','legal','pro_review'].every(id=>c.inspection?.stages.some(s=>s.id===id&&s.status==='completed'));
 const tasks:DossierTask[]=[
 {id:'source',title:{ru:'Ресурс и первичные материалы',kk:'Ресурс және бастапқы материалдар'},status:sourceOk&&c.evidence.length?'done':'review',detail:{ru:sourceOk?'Происхождение подтверждено инспектором.':'Проверьте URL, дату фиксации и происхождение материалов.',kk:sourceOk?'Шығу тегін инспектор растады.':'URL, тіркеу күні мен материалдар шығу тегін тексеріңіз.'}},
 {id:'content',title:{ru:'Игорное предложение и контекст',kk:'Ойын ұсынысы және мәнмәтін'},status:contentOk?'done':c.findings.length?'review':'missing',detail:{ru:`Подтверждённых находок: ${accepted.length}. Нужна связь предложения с проверяемым ресурсом.`,kk:`Расталған белгілер: ${accepted.length}. Ұсыныстың тексерілетін ресурспен байланысы қажет.`}},
 {id:'territory',title:{ru:'Применимость к территории РК',kk:'ҚР аумағына қолданылуы'},status:jurisdiction?'done':'missing',detail:{ru:'Доступность сайта сама по себе не устанавливает применимость каждой нормы. Укажите дату события и основания территориальной связи.',kk:'Сайт қолжетімділігі әр норманың қолданылуын анықтамайды. Оқиға күні мен аумақтық байланыс негіздерін көрсетіңіз.'}},
 {id:'law',title:{ru:'Правовое основание и редакция',kk:'Құқықтық негіз және редакция'},status:lawOk?'done':legal.length?'review':'missing',detail:{ru:`Правовых гипотез: ${legal.length}. Проверьте состав, исключения, редакцию и процедуру обращения.`,kk:`Құқықтық болжамдар: ${legal.length}. Құрамын, ерекшеліктерін, редакциясын және өтініш рәсімін тексеріңіз.`}},
 {id:'gaps',title:{ru:'Полнота проверки',kk:'Тексеру толықтығы'},status:aiOk&&!unresolved&&!c.materialsPending?'done':'missing',detail:{ru:`Вопросов без ответа: ${unresolved}. ${c.materialsPending?'Новые материалы требуют повторного анализа. ':''}${aiOk?'Ключевые AI-этапы выполнены.':'Юрист или итоговая AI-проверка не завершены.'}`,kk:`Жауапсыз сұрақтар: ${unresolved}. ${c.materialsPending?'Жаңа материалдарды қайта талдау қажет. ':''}${aiOk?'Негізгі AI кезеңдері орындалды.':'Заңгер немесе қорытынды AI тексеруі аяқталмады.'}`}},
 ];
 return {tasks,ready:tasks.every(t=>t.status==='done'),legal,accepted};
}
