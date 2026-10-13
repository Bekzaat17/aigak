export function contentSignals(a: string, b: string) {
  const email = (s: string) =>
    new Set(s.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []);
  const bins = (s: string) =>
    new Set([...s.matchAll(/(?:БИН|БСН|BIN)\s*[:№-]?\s*(\d{12})/giu)].map((m) => m[1]));
  const common = (x: Set<string>, y: Set<string>) => [...x].filter((v) => y.has(v));
  const grams = (s: string) => {
    const w = s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    return new Set(
      w.slice(0, 10000).flatMap((_, i) => (i + 5 <= w.length ? [w.slice(i, i + 5).join(' ')] : [])),
    );
  };
  const x = grams(a),
    y = grams(b);
  const overlap = common(x, y).length;
  const similarity = x.size && y.size ? overlap / (x.size + y.size - overlap) : 0;
  return {
    emails: common(email(a), email(b)),
    bins: common(bins(a), bins(b)),
    similarity: x.size >= 30 && y.size >= 30 ? similarity : 0,
  };
}
