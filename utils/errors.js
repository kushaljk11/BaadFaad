export class AppError extends Error {
  constructor(status, message, code = 'APPLICATION_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(error, req, res, _next) {
  const known = error instanceof AppError;
  const status = known ? error.status : error?.type === 'entity.too.large' ? 413 : 500;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.id, message: error?.message || 'Unknown error', code: error?.code || null }));
  return res.status(status).json({
    success: false,
    message: known ? error.message : status === 413 ? 'Request body too large' : 'Internal server error',
    code: known ? error.code : undefined,
    requestId: req.id,
  });
}
