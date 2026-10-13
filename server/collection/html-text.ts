import { load } from 'cheerio';

export function htmlText(html: string) {
  const $ = load(html);
  $('script,style,noscript,template,svg').remove();
  $('br,p,div,li,h1,h2,h3,tr').append('\n');
  return {
    text: $.root()
      .text()
      .replace(/[\t ]+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim(),
    title: $('title').text().trim(),
  };
}
