import type { RequestHandler } from 'express';
export function localAccess(port: number): RequestHandler {
  return (req, res, next) => {
    const host = req.headers.host;
    if (![`localhost:${port}`, `127.0.0.1:${port}`].includes(host || ''))
      return void res.status(403).json({ error: 'LOCAL_ONLY' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      const origin = req.headers.origin;
      if (origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin))
        return void res.status(403).json({ error: 'ORIGIN_REJECTED' });
      if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-aigak-client'] !== 'local')
        return void res.status(403).json({ error: 'ORIGIN_REJECTED' });
    }
    next();
  };
}
