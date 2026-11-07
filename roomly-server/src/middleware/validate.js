/** Validates and replaces req.body / req.query / req.params with the parsed (clean) values. */
export const validate = (shape) => (req, _res, next) => {
  try {
    for (const key of ['params', 'query', 'body']) {
      if (!shape[key]) continue
      const parsed = shape[key].parse(req[key] ?? {})
      if (key === 'query') Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true })
      else req[key] = parsed
    }
    next()
  } catch (err) { next(err) }
}
