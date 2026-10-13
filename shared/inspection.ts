import type { AnalysisLevel, Localized } from './types.ts';
export const levels: {id:AnalysisLevel;name:Localized;description:Localized;maxAiCalls:number}[] = [
  {id:'basic',name:{ru:'Базовая',kk:'Негізгі'},description:{ru:'Правила, OCR, паспорт домена и контакты. Без ИИ.',kk:'Ережелер, OCR, домен паспорты және байланыстар. AI-сыз.'},maxAiCalls:0},
  {id:'advanced',name:{ru:'Продвинутая · ИИ',kk:'Кеңейтілген · AI'},description:{ru:'Три AI-этапа: контекст, механика, проверка выводов.',kk:'Үш AI кезеңі: мәнмәтін, механика, қорытындыларды тексеру.'},maxAiCalls:3},
  {id:'pro',name:{ru:'Pro · Расследование',kk:'Pro · Тергеу'},description:{ru:'Технические связи, снимок реестра, правовые гипотезы и итоговая AI-проверка.',kk:'Техникалық байланыстар, тізілім көшірмесі, құқықтық болжамдар және қорытынды AI тексеруі.'},maxAiCalls:5},
];
export const levelName = (level:AnalysisLevel) => levels.find(x=>x.id===level)!.name;
