import JSZip from 'jszip';
import { chromium } from 'playwright';
import type { CaseRecord, Lang } from '../shared/types.ts';
import { Store, sha256 } from './store.ts';
import { browserOptions } from './collector.ts';
import { Templates } from './templates.ts';

const escape = (s:unknown) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reportHtml(c:CaseRecord,lang:Lang) {
  const t=(ru:string,kk:string)=>lang==='ru'?ru:kk;
  const decision=(d:string)=>({pending:t('Не проверено','Тексерілмеген'),accepted:t('Подтверждено офицером','Қызметкер растаған'),rejected:t('Отклонено офицером','Қызметкер қабылдамаған')}[d]);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escape(c.number)} — aigak</title><style>@page{size:A4;margin:18mm}body{font:12px/1.6 Arial,sans-serif;color:#183632;max-width:850px;margin:30px auto}h1{font-size:28px}h2{break-after:avoid;font-size:18px;margin-top:28px;border-bottom:1px solid #bbc9c2;padding-bottom:8px}h3{break-after:avoid;font-size:14px}tr{break-inside:avoid}.tag{display:inline-block;padding:4px 10px;background:#ecf3e9}.muted{color:#64726b}blockquote{border-left:3px solid #4b7968;padding:10px 16px;background:#f6f8f4;margin:12px 0;white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #d4ddd5;padding:8px;text-align:left;overflow-wrap:anywhere}code{font-size:10px;overflow-wrap:anywhere}.finding{break-inside:avoid}p{overflow-wrap:anywhere}footer{border-top:1px solid #ccc;margin-top:30px;padding-top:12px}.draft{color:#96651c}</style></head><body>
  <p><strong>aigak</strong> / ${escape(c.number)}</p><span class="tag draft">${t('ПРОЕКТ • НЕ ЯВЛЯЕТСЯ РЕШЕНИЕМ О БЛОКИРОВКЕ','ЖОБА • БҰҒАТТАУ ТУРАЛЫ ШЕШІМ ЕМЕС')}</span>
  ${c.demo?`<p class="draft">${t('СИНТЕТИЧЕСКИЙ ПРИМЕР — не использовать для реального обращения','СИНТЕТИКАЛЫҚ МЫСАЛ — нақты өтініш үшін пайдаланбаңыз')}</p>`:''}
  <h1>${t('Материалы проверки','Тексеру материалдары')}</h1><h3>${escape(c.title)}</h3>
  <p>${t('Источник','Дереккөз')}: ${escape(c.sourceUrl||t('Загруженный материал; URL не установлен','Жүктелген материал; URL анықталмаған'))}<br>${t('Получено','Алынған уақыты')}: ${escape(c.createdAt)} (UTC)<br>${t('Метод анализа','Талдау әдісі')}: ${c.engine==='ai'?'AI':'Rules / v1'}<br>${t('Внутренняя проверка','Ішкі тексеру')}: ${c.status==='verified'?t('выполнена','орындалды'):t('не завершена','аяқталмады')}<br>${t('Офицер','Қызметкер')}: ${escape(c.officer||'________________')}</p>
  <p>${escape(c.assessment[lang])}</p><p>${t('Предварительная оценка AI','AI алдын ала бағасы')}: ${c.likelihood===null?t('не рассчитана','есептелмеген'):c.likelihood+'% · '+t('не откалибрована','калибрленбеген')}</p>
  <h2>${t('1. Наблюдения и проверка','1. Бақылаулар және тексеру')}</h2>
  ${c.findings.length?c.findings.map((f,i)=>`<div class="finding"><h3>${i+1}. ${escape(f.title[lang])}</h3><p>${escape(decision(f.decision))} · ${escape(f.engine)}</p><blockquote>${escape(f.quote)}</blockquote><p>${escape(f.explanation[lang])}</p><p>${t('Комментарий инспектора','Инспектор түсініктемесі')}: ${escape(f.note||'—')}</p><p class="muted">${t('Материал','Материал')}: ${escape(f.evidenceId)} · ${t('Символы','Таңбалар')} [${f.start}, ${f.end})</p></div>`).join(''):`<p>${t('Подтверждённых признаков нет. Это не подтверждение законности ресурса.','Расталған белгілер жоқ. Бұл ресурстың заңдылығын растамайды.')}</p>`}
  <h2>${t('2. Опись материалов','2. Материалдар тізімдемесі')}</h2><table><thead><tr><th>${t('Материал / метод','Материал / әдіс')}</th><th>SHA-256 / ${t('размер','көлем')}</th></tr></thead><tbody>${c.evidence.map(e=>`<tr><td>${escape(e.name)}<br><code>${escape(e.id)}</code><br>${escape(e.method)}<br>${escape(e.createdAt)}</td><td><code>${e.sha256}</code><br>${e.size} bytes</td></tr>`).join('')}</tbody></table>
  <h2>${t('3. Ограничения и недостающие сведения','3. Шектеулер және жетіспейтін мәліметтер')}</h2><ul>${c.issues.map(i=>`<li>${escape(i[lang])}</li>`).join('')}<li>${t('Юридическое основание, адресат и утверждённая форма должны быть определены ответственным специалистом.','Құқықтық негізді, адресатты және бекітілген нысанды жауапты маман анықтауы тиіс.')}</li></ul>
  <h2>${t('4. Замечания офицера','4. Қызметкердің ескертулері')}</h2><p>${escape(c.notes||t('Не заполнены','Толтырылмаған'))}</p>${c.clarifications.map(q=>`<p><strong>${escape(q.question[lang])}</strong><br>${escape(({yes:t('Да','Иә'),no:t('Нет','Жоқ'),unknown:t('Не уверен','Сенімді емеспін'),'':t('Без ответа','Жауапсыз')})[q.answer])} · ${escape(q.note)}</p>`).join('')}
  <h2>${t('5. Проект обращения','5. Өтініш жобасы')}</h2><p>${t('Адресат','Адресат')}: ____________________<br>${t('Правовое основание (заполняет специалист)','Құқықтық негіз (маман толтырады)')}: ____________________</p><p>${t('Прошу рассмотреть приложенные материалы проверки интернет-ресурса и оценить наличие оснований для предусмотренных законом мер. Подтверждённые офицером наблюдения приведены в разделе 1. Оригиналы и контрольные суммы включены в пакет.','Интернет-ресурсты тексерудің қоса берілген материалдарын қарастырып, заңда көзделген шараларға негіздердің бар-жоғын бағалауды сұраймын. Қызметкер растаған бақылаулар 1-бөлімде келтірілген. Түпнұсқалар мен бақылау сомалары пакетке енгізілген.')}</p><p>${t('Подпись / дата','Қолы / күні')}: ____________________</p>
  <footer class="muted">${t('Время — часы сервера. SHA-256 позволяет сверить целостность относительно манифеста; не удостоверяет автора, время публикации или юридическую допустимость. Журнал локальный, без внешнего заверения.','Уақыт — сервер сағаты. SHA-256 манифестке қатысты тұтастықты тексереді; авторды, жариялау уақытын немесе құқықтық жарамдылықты куәландырмайды. Журнал жергілікті, сыртқы куәландырусыз.')}<br>aigak v0.1 · ${escape(c.id)}</footer></body></html>`;
}
export async function exportCase(store:Store,c:CaseRecord,includePdf=true) {
  store.verify(c);
  store.event(c,'package.export.requested',c.status==='verified'?'officer-reviewed draft':'unreviewed draft');
  const zip=new JSZip(); const manifest:{path:string;sha256:string;size:number}[]=[];
  const add=(name:string,data:Buffer|string)=>{const b=Buffer.isBuffer(data)?data:Buffer.from(data);zip.file(name,b);manifest.push({path:name,sha256:sha256(b),size:b.length});};
  for(const e of c.evidence) add(`evidence/${e.storedName}`,store.read(c,e));
  add('case.json',JSON.stringify(c,null,2));add('audit.json',JSON.stringify(c.audit,null,2));
  const templates=new Templates(store);
  for(const lang of ['ru','kk'] as const) add(`document-${lang}.docx`,await templates.render(c,lang));
  add('template-source.docx',await templates.raw(c.templateId));
  for(const lang of ['ru','kk'] as const) add(`report-${lang}.html`,reportHtml(c,lang));
  const exportWarnings:string[]=[];
  if(includePdf) {
    let browser;
    try {
      browser=await chromium.launch(browserOptions());
      const page=await browser.newPage({javaScriptEnabled:false});
      await page.route('**/*',r=>r.abort());
      for(const lang of ['ru','kk'] as const) {await page.setContent(reportHtml(c,lang));add(`report-${lang}.pdf`,await page.pdf({format:'A4',printBackground:true}));}
    } catch {exportWarnings.push('PDF generation unavailable. Print the included report-ru.html / report-kk.html to PDF.');}
    finally {await browser?.close();}
  }
  add('README.txt','aigak — проект пакета / пакет жобасы\n\nreport-ru / report-kk: отчёт и проект обращения / есеп және өтініш жобасы.\ncase.json: source metadata, findings, review decisions.\naudit.json: local hash-chained events, not externally notarized.\nevidence/: originals and derived files; see case.json for names and parent IDs.\nmanifest.json: SHA-256 of all included files except itself.\nverify.mjs: node verify.mjs from the unpacked directory.\n\nThis is a draft, not an official blocking order.\n'+exportWarnings.join('\n'));
  add('verify.mjs',`import {readFileSync} from 'node:fs';\nimport {createHash} from 'node:crypto';\nimport path from 'node:path';\nimport {fileURLToPath} from 'node:url';\nconst root=path.dirname(fileURLToPath(import.meta.url));\nconst manifest=JSON.parse(readFileSync(path.join(root,'manifest.json'),'utf8'));\nfor(const f of manifest.files){ const p=path.resolve(root,f.path); if(!p.startsWith(root+path.sep))throw new Error('Unsafe path'); const b=readFileSync(p); if(b.length!==f.size||createHash('sha256').update(b).digest('hex')!==f.sha256)throw new Error('Mismatch: '+f.path); }\nconsole.log('Verified '+manifest.files.length+' files. The manifest itself is not externally signed.');\n`);
  zip.file('manifest.json',JSON.stringify({format:'aigak-evidence/1',caseId:c.id,createdAt:new Date().toISOString(),status:'draft',officerReviewed:c.status==='verified',demo:c.demo,exportWarnings,files:manifest},null,2));
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
