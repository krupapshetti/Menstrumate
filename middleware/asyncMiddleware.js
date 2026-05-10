function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err); // Let Express error handler deal with it
    }
  };
}

module.exports = asyncRoute;