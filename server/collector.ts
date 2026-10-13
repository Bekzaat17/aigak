import { existsSync } from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';
import { chromium } from 'playwright';
import { createWorker } from 'tesseract.js';
import type { CaseRecord, Evidence } from '../shared/types.ts';
import { Store } from './store.ts';
import { safeFetch } from './network.ts';

export const browserOptions = () => ({ headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {}) });
const maxText = 180000;
function issue(c: CaseRecord, ru: string, kk: string) { c.issues.push({ru,kk}); }
async function ocrText(store:Store,data:Buffer) {
  const langPath=path.join(store.dir,'ocr');
  if(!['rus','kaz','eng'].every(l=>existsSync(path.join(langPath,`${l}.traineddata.gz`)))) throw new Error('OCR_NOT_CONFIGURED');
  const worker=await createWorker(['rus','kaz','eng'],1,{langPath,cacheMethod:'none'});
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {const result=await Promise.race([worker.recognize(data),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('OCR_TIMEOUT')),60000);})]);return result.data.text;}
  finally {clearTimeout(timer);await worker.terminate();}
}
export function htmlText(html: string) {
  const $ = load(html); $('script,style,noscript,template,svg').remove();
  $('br,p,div,li,h1,h2,h3,tr').append('\n');
  return { text: $.root().text().replace(/[\t ]+/g,' ').replace(/\n\s*\n/g,'\n').trim(), title: $('title').text().trim() };
}
export function detectMime(data:Buffer, name:string) {
  if (data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data.subarray(0,4).toString()==='RIFF' && data.subarray(8,12).toString()==='WEBP') return 'image/webp';
  if (data.subarray(0,5).toString()==='%PDF-') return 'application/pdf';
  if (/\.(txt|md|csv|html?|json)$/i.test(name) && !data.subarray(0,4096).includes(0)) return /\.html?$/i.test(name) ? 'text/html' : 'text/plain';
  return 'application/octet-stream';
}
function saveText(store:Store,c:CaseRecord,e:Evidence,text:string,method:string) {
  if (!text.trim()) { issue(c,`${e.name}: извлекаемый текст не найден. Нужна ручная проверка.`,`${e.name}: мәтін алынбады. Қолмен тексеру қажет.`); return; }
  if (text.length > maxText) issue(c,`${e.name}: анализ ограничен первыми ${maxText} символами.`,`${e.name}: талдау алғашқы ${maxText} таңбамен шектелді.`);
  const limited = text.slice(0,maxText);
  store.addEvidence(c,Buffer.from(limited),{name:`${e.name}.txt`,mime:'text/plain',kind:'text',method,parentId:e.id,text:limited,sourceUrl:e.sourceUrl});
}
export async function extractFile(store:Store,c:CaseRecord,e:Evidence) {
  const data = store.read(c,e);
  try {
    if (e.mime === 'text/plain' || e.mime === 'text/html') {
      saveText(store,c,e,e.mime==='text/html'?htmlText(data.toString('utf8')).text:data.toString('utf8'),e.mime==='text/html'?'html-text':'utf8');
    } else if (e.mime === 'application/pdf') {
      const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = getDocument({data:new Uint8Array(data),useSystemFonts:true});
      const doc = await task.promise;
      try {
        const pages:string[]=[];let scanned=0;
        for(let n=1;n<=Math.min(doc.numPages,40);n++) {
          const page=await doc.getPage(n); const content=await page.getTextContent(); const text=content.items.map(x=>'str' in x?x.str:'').join(' ');
          if(text.trim().length>=10) {pages.push(`[${n}]\n${text}`);continue;}
          if(++scanned>10)continue;
          const size=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,1800/Math.max(size.width,size.height))});
          const factory=doc.canvasFactory as {create:(w:number,h:number)=>{canvas:HTMLCanvasElement & {toBuffer:(type:string)=>Buffer};context:CanvasRenderingContext2D};destroy:(target:unknown)=>void};
          const target=factory.create(Math.ceil(viewport.width),Math.ceil(viewport.height));
          try {
            await page.render({canvas:target.canvas,canvasContext:target.context,viewport}).promise;
            const png=target.canvas.toBuffer('image/png');
            const snapshot=store.addEvidence(c,png,{name:`${e.name}-page-${n}.png`,mime:'image/png',kind:'snapshot',method:'pdfjs-render',parentId:e.id});
            saveText(store,c,snapshot,await ocrText(store,png),'tesseract-pdf-page');
          } finally {factory.destroy(target);}
        }
        if(doc.numPages>40) issue(c,'PDF: обработаны первые 40 страниц.','PDF: алғашқы 40 бет өңделді.');
        if(scanned>0)issue(c,'PDF содержит сканы: текст получен OCR, проверьте по изображениям страниц.','PDF сканерленген беттерді қамтиды: мәтін OCR арқылы алынды, бет кескіндерімен салыстырыңыз.');
        if(scanned>10)issue(c,'OCR ограничен первыми 10 сканированными страницами PDF.','OCR PDF құжатының алғашқы 10 сканерленген бетімен шектелген.');
        const text=pages.join('\n\n');
        if(text.replace(/\[\d+\]/g,'').trim().length>=10) saveText(store,c,e,text,'pdfjs-text');
      } finally {await task.destroy();}
    } else if (e.mime.startsWith('image/')) {
      const langPath=path.join(store.dir,'ocr');
      if(!['rus','kaz','eng'].every(l=>existsSync(path.join(langPath,`${l}.traineddata.gz`)))) {issue(c,'OCR не настроен: выполните npm run setup:ocr. Изображение сохранено.','OCR бапталмаған: npm run setup:ocr орындаңыз. Кескін сақталды.');return;}
      saveText(store,c,e,await ocrText(store,data),'tesseract-rus-kaz-eng');
      issue(c,'Текст изображения получен OCR: сверьте цитаты с оригиналом.','Кескін мәтіні OCR арқылы алынды: дәйексөздерді түпнұсқаларды салыстырыңыз.');
    } else issue(c,`${e.name}: оригинал сохранён, автоматическое извлечение этого формата пока не поддерживается.`,`${e.name}: түпнұсқа сақталды, бұл пішімнен автоматты мәтін алу әзірше қолдау таппайды.`);
  } catch {issue(c,`${e.name}: не удалось извлечь текст. Оригинал сохранён.`,`${e.name}: мәтінді алу мүмкін болмады. Түпнұсқа сақталды.`);}
  store.save(c);
}
export async function collectUrl(store:Store,c:CaseRecord) {
  const result=await safeFetch(c.sourceUrl!);
  c.redirects=result.redirects;
  const declared=String(result.headers['content-type']||'').split(';')[0];
  const mime=declared==='text/html'?'text/html':detectMime(result.body,new URL(result.url).pathname);
  const ext=mime==='text/html'?'html':mime==='application/pdf'?'pdf':'bin';
  const original=store.addEvidence(c,result.body,{name:`response.${ext}`,mime,kind:'original',method:'http-get',sourceUrl:result.url});
  store.addEvidence(c,Buffer.from(JSON.stringify({requestedUrl:c.sourceUrl,finalUrl:result.url,status:result.status,headers:result.headers,redirects:result.redirects,receivedAt:original.createdAt},null,2)),{name:'http-metadata.json',mime:'application/json',kind:'metadata',method:'http-get',parentId:original.id});
  if(result.status>=400) issue(c,`Сервер вернул HTTP ${result.status}; содержимое может быть страницей ошибки.`,`Сервер HTTP ${result.status} қайтарды; мазмұн қате беті болуы мүмкін.`);
  await extractFile(store,c,original);
  if(mime!=='text/html') return;
  const $=load(result.body.toString());
  c.links=[...new Set($('a[href]').map((_,a)=>{try{const u=new URL($(a).attr('href')!,result.url);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}).get().filter(Boolean))].slice(0,30);
  // Links are leads, not evidence about those destinations. Never auto-follow them.
  let browser;
  try {
    browser=await chromium.launch(browserOptions());
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ru-RU',timezoneId:'Asia/Almaty',serviceWorkers:'block',acceptDownloads:false});
    let requestCount=0; let totalBytes=0; const deadline=Date.now()+30000;
    await context.routeWebSocket('**/*',ws=>ws.close());
    await context.route('**/*',async route=>{
      try {
        if(Date.now()>deadline || ++requestCount>60 || totalBytes>30*1024*1024 || route.request().method()!=='GET') return void await route.abort();
        const r=await safeFetch(route.request().url(),4*1024*1024);
        totalBytes+=r.body.length;
        const headers:Record<string,string>={};
        for(const [key,value] of Object.entries(r.headers)) if(value && !['content-encoding','content-length','transfer-encoding','connection','set-cookie','location'].includes(key)) headers[key]=Array.isArray(value)?value.join(', '):value;
        await route.fulfill({status:r.status,headers,body:r.body});
      } catch {await route.abort().catch(()=>{});}
    });
    const page=await context.newPage(); page.setDefaultTimeout(12000);
    await page.goto(result.url,{waitUntil:'domcontentloaded',timeout:22000});
    await page.waitForLoadState('networkidle',{timeout:2500}).catch(()=>{});
    const text=await page.locator('body').innerText();
    const dom=await page.content();
    const domFile=store.addEvidence(c,Buffer.from(dom),{name:'rendered.html',mime:'text/html',kind:'snapshot',method:'playwright-dom',parentId:original.id,sourceUrl:page.url()});
    // Prefer rendered text, keeping the HTTP text in the archive but avoiding duplicate findings.
    if(text.trim()) {for(const e of c.evidence) if(e.kind==='text'&&e.parentId===original.id) delete e.text; saveText(store,c,domFile,text,'playwright-innerText');}
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);
    const screenshot=await page.screenshot({fullPage:height<=16000,type:'png',timeout:12000});
    store.addEvidence(c,screenshot,{name:'page.png',mime:'image/png',kind:'snapshot',method:'playwright-screenshot',parentId:domFile.id});
    const finalUrl=page.url();
    store.addEvidence(c,Buffer.from(JSON.stringify({url:finalUrl,capturedAt:new Date().toISOString(),viewport:{width:1440,height:1000},fullPage:height<=16000,browserVersion:browser.version(),locale:'ru-RU',timezone:'Asia/Almaty',networkPolicy:'public HTTP GET, no cookies, no WebSockets; 60 requests / 30 MiB'},null,2)),{name:'browser-metadata.json',mime:'application/json',kind:'metadata',method:'playwright',parentId:domFile.id});
    issue(c,'Браузерная фиксация ограничивает сетевые запросы; часть динамического содержимого может отсутствовать.','Браузерлік тіркеу желілік сұрауларды шектейді; динамикалық мазмұнның бір бөлігі болмауы мүмкін.');
    if(height>16000) issue(c,'Очень длинная страница: сохранён снимок первого экрана.','Өте ұзын бет: бірінші экранның суреті сақталды.');
  } catch {issue(c,'Браузерный снимок не получен. HTTP-оригинал сохранён; для сложной страницы загрузите скриншот вручную.','Браузер суреті алынбады. HTTP түпнұсқасы сақталды; күрделі бет үшін скриншотты қолмен жүктеңіз.');}
  finally {await browser?.close();store.save(c);}
}
