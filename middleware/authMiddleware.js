module.exports = function authUser(req, res, next) {
  const userSession = req.session.user;
  if (!userSession) return res.redirect("/");

  next();
};
