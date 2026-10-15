import type { Localized } from '../../shared/types.ts';
export interface LegalSource {
  id: string;
  url: string;
  title: Localized;
  identity: string;
  articles: string[];
}
export const legalCatalog: LegalSource[] = [
  {
    id: 'Z1600000495',
    url: 'https://old.adilet.zan.kz/rus/docs/Z1600000495',
    title: {
      ru: 'О лотереях и лотерейной деятельности',
      kk: 'Лотереялар және лотерея қызметі туралы',
    },
    identity: '9 апреля 2016 года',
    articles: ['1', '6', '8', '9'],
  },
  {
    id: 'Z070000219_',
    url: 'https://old.adilet.zan.kz/rus/docs/Z070000219_',
    title: { ru: 'Об игорном бизнесе', kk: 'Ойын бизнесі туралы' },
    identity: '12 января 2007 года',
    articles: ['1', '6', '9'],
  },
  {
    id: 'Z1300000094',
    url: 'https://old.adilet.zan.kz/rus/docs/Z1300000094',
    title: {
      ru: 'О персональных данных и их защите',
      kk: 'Дербес деректер және оларды қорғау туралы',
    },
    identity: '21 мая 2013 года',
    articles: ['7', '8', '9', '12', '16'],
  },
  {
    id: 'Z030000508_',
    url: 'https://old.adilet.zan.kz/rus/docs/Z030000508_',
    title: { ru: 'О рекламе', kk: 'Жарнама туралы' },
    identity: '19 декабря 2003 года',
    articles: ['13'],
  },
  {
    id: 'K1400000226',
    url: 'https://old.adilet.zan.kz/rus/docs/K1400000226',
    title: { ru: 'Уголовный кодекс', kk: 'Қылмыстық кодекс' },
    identity: '3 июля 2014 года',
    articles: ['307'],
  },
  {
    id: 'K1400000235',
    url: 'https://old.adilet.zan.kz/rus/docs/K1400000235',
    title: { ru: 'КоАП', kk: 'Әкімшілік құқық бұзушылық туралы кодекс' },
    identity: '5 июля 2014 года',
    articles: ['445'],
  },
  {
    id: 'Z040000567_',
    url: 'https://old.adilet.zan.kz/rus/docs/Z040000567_',
    title: { ru: 'О связи', kk: 'Байланыс туралы' },
    identity: '5 июля 2004 года',
    articles: ['41-1'],
  },
];
