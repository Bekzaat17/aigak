import {previewImages} from './package/appendices.ts';
import {reportHtml as renderPackageHtml} from './package/html.ts';
import {DocxRenderer} from './package/adapters.ts';
import {templateFields} from './package/fields.ts';
import {packageDocument} from './export.ts';
import {startRevision} from './revisions.ts';
import {reportHtml} from './export.ts';
import {normalizeUrlInput} from '../shared/url-input.ts';
import { createInspectionFacade } from './inspection/index.ts';
import { createAiAnalyzer } from './inspection/provider.ts';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, sha256 } from './store.ts';
import { Queue, newCase, reviewFinding, approveCase } from './workflow.ts';
import { detectMime } from './collector.ts';
import { parsePublicUrl } from './network.ts';
import { exportCase } from './export.ts';
import { busyStatuses } from '../shared/types.ts';
import { levels } from '../shared/inspection.ts';
import { Templates, fields } from './templates.ts';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port=Number(process.env.PORT||4317);
const store=new Store(path.resolve(process.env.DATA_DIR||path.join(root,'data')));
const aiAnalyzer=createAiAnalyzer();
const queue=new Queue(store,createInspectionFacade(aiAnalyzer));
const templates=new Templates(store);
const app=express(); app.disable('x-powered-by');
app.use((req,res,next)=>{
  const host=req.headers.host;
  if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(host||'')) return void res.status(403).json({error:'LOCAL_ONLY'});
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  if(req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control','no-store');
    const origin=req.headers.origin;
    if(origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(origin)) return void res.status(403).json({error:'ORIGIN_REJECTED'});
    if(!['GET','HEAD'].includes(req.method) && req.headers['x-aigak-client']!=='local') return void res.status(403).json({error:'ORIGIN_REJECTED'});
  }
  next();
});
app.use(express.json({limit:'300kb'}));
const upload=multer({storage:multer.memoryStorage(),limits:{files:5,fileSize:10*1024*1024,fields:8,fieldSize:200000}});
const intake=z.object({title:z.string().trim().min(1).max(160),sourceType:z.enum(['url','file','text']),sourceUrl:z.string().max(2048).optional(),text:z.string().max(180000).optional(),useAi:z.enum(['true','false']).default('false'),analysisLevel:z.enum(['basic','advanced','pro']).optional(),templateId:z.string().default('builtin')});
app.get('/api/templates',(_req,res)=>res.json({templates:templates.list(),fields}));
app.get('/api/templates/:id',async(req,res)=>{const data=await templates.raw(req.params.id);res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition','attachment; filename="aigak-template.docx"');res.send(data);});
app.post('/api/templates',upload.single('template'),(req,res)=>{if(!req.file)throw new Error('EMPTY_INPUT');res.status(201).json(templates.add(Buffer.from(req.file.originalname,'latin1').toString('utf8').replace(/[\x00-\x1f/\\]/g,'_'),req.file.buffer));});
app.get('/api/analysis-levels',(_req,res)=>res.json(levels));
app.get('/api/health',(_req,res)=>res.json({ok:true,version:'0.2.0',aiConfigured:aiAnalyzer.available,localOnly:true}));
app.get('/api/cases',(_req,res)=>res.json(store.list()));
app.post('/api/cases',upload.array('files',5),async(req,res)=>{
  if(queue.pending.length>=20) return void res.status(429).json({error:'QUEUE_FULL'});
  const input=intake.parse(req.body);const files=(req.files||[]) as Express.Multer.File[];
  if(!templates.has(input.templateId))throw new Error('NOT_FOUND');
  if(input.sourceType==='url'){input.sourceUrl=normalizeUrlInput(input.sourceUrl||'');parsePublicUrl(input.sourceUrl);}
  if(input.sourceType==='text'&&!input.text?.trim()) throw new Error('EMPTY_INPUT');
  if(input.sourceType==='file'&&!files.length) throw new Error('EMPTY_INPUT');
  const c=newCase(store,{title:input.title,sourceType:input.sourceType,sourceUrl:input.sourceType==='url'?input.sourceUrl:undefined,useAi:(input.analysisLevel ? input.analysisLevel!=='basic' : input.useAi==='true'),analysisLevel:input.analysisLevel,templateId:input.templateId});
  if(input.sourceType==='text') store.addEvidence(c,Buffer.from(input.text!),{name:'submitted-text.txt',mime:'text/plain',kind:'original',method:'user-submitted-text'});
  if(input.sourceType==='file') for(const file of files) {
    const name=Buffer.from(file.originalname,'latin1').toString('utf8').replace(/[\x00-\x1f/\\]/g,'_').slice(0,160)||'file';
    store.addEvidence(c,file.buffer,{name,mime:detectMime(file.buffer,name),kind:'original',method:'user-upload'});
  }
  queue.add(c.id);res.status(201).json(store.get(c.id));
});
app.post('/api/demo',(_req,res)=>{
  const existing=store.all().find(c=>c.demo);if(existing) return void res.json(existing);
  const c=newCase(store,{title:'Демонстрационный материал / Үлгі материал',sourceType:'text',useAi:false,demo:true});
  store.addEvidence(c,Buffer.from('СИНТЕТИЧЕСКИЙ ПРИМЕР AIGAK. Не является реальным сайтом.\nОнлайн-казино Example. Бонус 100% на первый депозит. Пополните счёт и получите 50 фриспинов. Вывод средств. Джекпот.\nСИНТЕТИКАЛЫҚ МЫСАЛ. Құмар ойын. Бонус алыңыз. Ақша салу және ақша шығару. Бәс тігу.\nИсточник: учебный текст, созданный для демонстрации.'),{name:'synthetic-demo.txt',mime:'text/plain',kind:'original',method:'synthetic-demo'});
  queue.add(c.id);res.status(201).json(store.get(c.id));
});
app.get('/api/cases/:id',(req,res)=>{const c=store.get(req.params.id);if(!c)return void res.status(404).json({error:'NOT_FOUND'});res.json(c);});
app.patch('/api/cases/:id/findings/:findingId',(req,res)=>{
  const {decision,note}=z.object({decision:z.enum(['pending','accepted','rejected']),note:z.string().max(2000).default('')}).parse(req.body);
  const c=store.get(req.params.id);if(!c)throw new Error('NOT_FOUND');reviewFinding(store,c,req.params.findingId,decision,note);res.json(c);
});
app.patch('/api/cases/:id/clarifications/:questionId',(req,res)=>{
  const input=z.object({answer:z.enum(['yes','no','unknown']),note:z.string().max(2000).default('')}).parse(req.body);
  const c=store.get(req.params.id);if(!c)throw new Error('NOT_FOUND');if(busyStatuses.includes(c.status))throw new Error('CASE_BUSY');
  const q=c.clarifications.find(q=>q.id===req.params.questionId);if(!q)throw new Error('NOT_FOUND');
  q.answer=input.answer;q.note=input.note;c.status='review';delete c.reviewedAt;store.event(c,'clarification.answered',`${q.id}: ${q.answer}; ${q.note}`);res.json(c);
});
app.patch('/api/cases/:id/questions/:questionId',(req,res)=>{
 const input=z.object({answer:z.string().trim().max(4000),evidenceIds:z.array(z.string()).max(30)}).parse(req.body);
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');
 if(busyStatuses.includes(c.status))throw Error('CASE_BUSY');
 const q=c.followUps?.find(q=>q.id===req.params.questionId);if(!q)throw Error('NOT_FOUND');
 if(input.evidenceIds.some(id=>!c.evidence.some(e=>e.id===id)))throw Error('NOT_FOUND');
 Object.assign(q,input);c.status='review';delete c.reviewedAt;
 store.event(c,'question.answered',JSON.stringify({id:q.id,...input}));res.json(c);
});
app.post('/api/cases/:id/materials',upload.array('files',5),(req,res)=>{
 const c=store.get(String(req.params.id));if(!c)throw Error('NOT_FOUND');
 if(busyStatuses.includes(c.status))throw Error('CASE_BUSY');
 const text=z.string().max(180000).default('').parse(req.body.text);
 const files=(req.files||[]) as Express.Multer.File[];
 if(!text.trim()&&!files.length)throw Error('EMPTY_INPUT');
 const prepared=files.map(file=>{const name=Buffer.from(file.originalname,'latin1').toString('utf8').replace(/[\x00-\x1f/\\]/g,'_').slice(0,160)||'file';return {file,name,mime:detectMime(file.buffer,name)};});
 c.status='review';delete c.reviewedAt;
 if(text.trim())store.addEvidence(c,Buffer.from(text),{name:'additional-text.txt',mime:'text/plain',kind:'original',method:'inspector-addition'});
 for(const {file,name,mime} of prepared)store.addEvidence(c,file.buffer,{name,mime,kind:'original',method:'inspector-addition'});
 c.materialsPending=true;store.event(c,'materials.added');res.json(c);
});
app.post('/api/cases/:id/reanalyze',(req,res)=>{
 const {analysisLevel}=z.object({analysisLevel:z.enum(['basic','advanced','pro'])}).parse(req.body);
 if(queue.pending.length>=20)throw Error('QUEUE_FULL');
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');
 startRevision(store,c,analysisLevel);queue.add(c.id);res.status(202).json(store.get(c.id));
});
app.get('/api/cases/:id/preview',(req,res)=>{
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');
 const lang=z.enum(['ru','kk']).default('ru').parse(req.query.lang);store.verify(c);
 res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
 res.setHeader('X-Frame-Options','SAMEORIGIN');
 const document=packageDocument(c);document.previewImages=previewImages(document,id=>store.read(c,c.evidence.find(e=>e.id===id)!));
 res.type('html').send(renderPackageHtml(document,lang));
});
app.patch('/api/cases/:id/relations/:relationId',(req,res)=>{
 const input=z.object({decision:z.enum(['accepted','rejected','pending']),note:z.string().max(2000)}).parse(req.body);
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');if(busyStatuses.includes(c.status))throw Error('CASE_BUSY');
 const relation=c.osint?.relations?.find(r=>r.id===req.params.relationId);if(!relation)throw Error('NOT_FOUND');
 Object.assign(relation,input);c.status='review';delete c.reviewedAt;store.event(c,'relation.reviewed',JSON.stringify({id:relation.id,...input}));res.json(c);
});
app.patch('/api/cases/:id/findings/:findingId/region',(req,res)=>{
 const input=z.object({evidenceId:z.string(),x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().positive().max(1),height:z.number().positive().max(1)}).parse(req.body);
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');if(busyStatuses.includes(c.status))throw Error('CASE_BUSY');
 if(input.x+input.width>1.001||input.y+input.height>1.001||!c.evidence.some(e=>e.id===input.evidenceId&&e.mime.startsWith('image/')))throw Error('INVALID_REGION');
 const f=c.findings.find(f=>f.id===req.params.findingId);if(!f)throw Error('NOT_FOUND');
 f.region={...input,author:'inspector'};c.status='review';delete c.reviewedAt;
 store.event(c,'finding.region',JSON.stringify({id:f.id,...input}));res.json(c);
});
app.get('/api/cases/:id/document',async(req,res)=>{
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');const lang=z.enum(['ru','kk']).default('ru').parse(req.query.lang);
 store.verify(c);const bytes=new DocxRenderer().render(await templates.raw(c.templateId,lang),templateFields(packageDocument(c),lang));
 res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').attachment(c.number+'-'+lang+'.docx').send(bytes);
});
app.patch('/api/cases/:id/template',(req,res)=>{
 const {templateId}=z.object({templateId:z.string()}).parse(req.body);if(!templates.has(templateId))throw Error('NOT_FOUND');
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');if(busyStatuses.includes(c.status))throw Error('CASE_BUSY');
 c.templateId=templateId;c.status='review';delete c.reviewedAt;store.event(c,'template.selected',templateId);res.json(c);
});
app.patch('/api/cases/:id/legal-review',(req,res)=>{
 const input=z.object({eventDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),jurisdictionConfirmed:z.boolean(),editionConfirmed:z.boolean(),officer:z.string().trim().min(2).max(150),note:z.string().trim().min(10).max(5000)}).parse(req.body);
 if(Number.isNaN(Date.parse(input.eventDate))||new Date(input.eventDate).toISOString().slice(0,10)!==input.eventDate)throw Error('VALIDATION_ERROR');
 const c=store.get(req.params.id);if(!c)throw Error('NOT_FOUND');if(busyStatuses.includes(c.status))throw Error('CASE_BUSY');
 c.legalReview=input;c.status='review';delete c.reviewedAt;store.event(c,'legal.reviewed',JSON.stringify(input));res.json(c);
});
app.post('/api/cases/:id/review',(req,res)=>{
  const {officer,notes}=z.object({officer:z.string().trim().min(2).max(150),notes:z.string().trim().min(5).max(5000)}).parse(req.body);
  const c=store.get(req.params.id);if(!c)throw new Error('NOT_FOUND');approveCase(store,c,officer,notes);res.json(c);
});
app.post('/api/cases/:id/export',async(req,res)=>{
  const c=store.get(req.params.id);if(!c)throw new Error('NOT_FOUND');
  if(busyStatuses.includes(c.status))throw new Error('CASE_BUSY');
  const data=await exportCase(store,c);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="${c.number}.zip"`);res.send(data);
});
app.get('/api/cases/:id/evidence/:evidenceId',(req,res)=>{
  const c=store.get(req.params.id);const e=c?.evidence.find(e=>e.id===req.params.evidenceId);if(!c||!e)throw new Error('NOT_FOUND');
  const data=store.read(c,e);if(sha256(data)!==e.sha256)throw new Error('INTEGRITY_FAILED');
  res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");
  res.setHeader('Content-Type',e.mime.startsWith('image/')?e.mime:'application/octet-stream');
  res.setHeader('Content-Disposition',`${e.mime.startsWith('image/')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(e.name)}`);res.send(data);
});
app.use('/api',(_req,res)=>res.status(404).json({error:'NOT_FOUND'}));
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  let code=error instanceof Error?error.message:'INTERNAL_ERROR';
  if(error instanceof z.ZodError)code='VALIDATION_ERROR';
  if(error instanceof multer.MulterError)code=error.code;
  if(!/^[A-Z_]+$/.test(code))code='REQUEST_FAILED';
  const status=code==='NOT_FOUND'?404:code==='INTEGRITY_FAILED'||code==='CASE_BUSY'?409:400;
  res.status(status).json({error:code});
});
if(process.env.NODE_ENV==='production') {app.use(express.static(path.join(root,'dist')));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(root,'dist','index.html')));}
else {const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`aigak ready: http://localhost:${port}`));
