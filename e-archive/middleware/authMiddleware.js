module.exports = function authUser(req, res, next) {
  const userSession = req.session.user;
  if (!userSession) {
    // API-only server: always return JSON
    return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
  }

  next();
};
