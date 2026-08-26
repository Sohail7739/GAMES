export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function ok(res, data, meta) {
  return res.json({ data, ...(meta ? { meta } : {}) });
}
