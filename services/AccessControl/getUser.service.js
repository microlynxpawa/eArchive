const User = require("../../model/user");

/**
 * Fetch a user by username.
 * @param {string} username - The username to search for.
 * @returns {Promise<Object>} - User data as a plain object.
 * @throws Will throw an error if the user is not found or if a database error occurs.
 */
const getUserByUsername = async (username) => {
  if (!username) {
    throw new Error("Username is required.");
  }

  const user = await User.findOne({ where: { username }, raw: true });

  if (!user) {
    throw new Error("User not found.");
  }

  return user;
};

module.exports = getUserByUsername;
