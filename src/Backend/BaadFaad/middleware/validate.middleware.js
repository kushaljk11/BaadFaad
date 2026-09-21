export function validate(schemas) {
  return (req, res, next) => {
    for (const key of ['params', 'query', 'body']) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
      }
      if (key === 'query') {
        req.validatedQuery = result.data;
        if (req.query && typeof req.query === 'object') {
          for (const prop of Object.keys(req.query)) delete req.query[prop];
          Object.assign(req.query, result.data);
        }
      } else {
        req[key] = result.data;
      }
    }
    return next();
  };
}
