const jwt = require('jsonwebtoken');
const User = require('../model/user');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

module.exports = async function rememberMeMiddleware(req, res, next) {
  // If already logged in via session, continue
  if (req.session && req.session.user) return next();

  // Check for remember_token cookie
  const token = req.cookies ? req.cookies.remember_token : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Optionally, check if user still exists
    const user = await User.findByPk(payload.userId);
    if (!user) return next();
    // Set session user
    req.session.user = user.id;
    return next();
  } catch (err) {
    // Invalid or expired token, ignore
    return next();
  }
};
