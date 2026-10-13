import type { AnalysisLevel, Localized } from './types.ts';
export const levels: {id:AnalysisLevel;name:Localized;description:Localized;maxAiCalls:number}[] = [
  {id:'basic',name:{ru:'Базовая',kk:'Негізгі'},description:{ru:'Правила, OCR и цитаты. Без ИИ.',kk:'Ережелер, OCR және дәйексөздер. AI-сыз.'},maxAiCalls:0},
  {id:'advanced',name:{ru:'Продвинутая · ИИ',kk:'Кеңейтілген · AI'},description:{ru:'Три AI-этапа: контекст, механика, проверка выводов.',kk:'Үш AI кезеңі: мәнмәтін, механика, қорытындыларды тексеру.'},maxAiCalls:3},
  {id:'pro',name:{ru:'Pro · Расследование',kk:'Pro · Тергеу'},description:{ru:'Узкие AI-проверки. Юрист и внешний поиск ещё не подключены.',kk:'Арнайы AI тексерулері. Заңгер мен сыртқы іздеу әлі қосылмаған.'},maxAiCalls:3},
];
export const levelName = (level:AnalysisLevel) => levels.find(x=>x.id===level)!.name;
