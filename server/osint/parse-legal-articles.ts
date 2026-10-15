import { load } from 'cheerio';
import type { LegalSource } from './legal-catalog';
/** Extract whole articles; no generated legal wording or silently selected historical edition. */
export function parseLegalArticles(html: string, source: LegalSource) {
  const $ = load(html);
  $('script,style,nav').remove();
  if (!$('body').text().includes(source.identity)) throw Error('LAW_IDENTITY_MISMATCH');
  const headings = $('h3,h4,h5,p')
    .toArray()
    .filter((n) => /^h[345]$/.test(n.tagName) || $(n).children('b,strong').length > 0);
  return source.articles.map((article) => {
    const matches = headings.filter((h) => $(h).text().trim().startsWith(`Статья ${article}.`));
    if (matches.length !== 1) throw Error('LAW_ARTICLE_AMBIGUOUS');
    const parts = [$(matches[0]).text().trim()];
    for (const node of $(matches[0]).nextAll().toArray()) {
      const text = $(node).text().trim();
      if (
        /^Статья \d+[.-]/.test(text) &&
        (/^h[345]$/i.test(node.tagName) || $(node).children('b,strong').length > 0)
      )
        break;
      if (text) parts.push(text);
    }
    const quote = parts.join('\n');
    if (quote.length < 100 || quote.length > 35000) throw Error('LAW_FORMAT_CHANGED');
    return {
      id: `KZ-${source.id}-article-${article}`,
      article,
      quote,
      title: source.title,
      documentId: source.id,
    };
  });
}
