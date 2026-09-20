import { randomUUID } from 'node:crypto';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,100}$/;

export function requestContext(req, res, next) {
  const incoming = req.get('X-Request-ID');
  req.id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.set('X-Request-ID', req.id);
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const record = { level: res.statusCode >= 500 ? 'error' : 'info', requestId: req.id, method: req.method, path: req.originalUrl?.split('?')[0], status: res.statusCode, durationMs: Number(durationMs.toFixed(1)) };
    console.log(JSON.stringify(record));
  });
  next();
}
