const User = require("../../model/user");


/**
 * Fetch one or multiple users by usernames.
 * @param {string|string[]} usernames - A single username or an array of usernames.
 * @returns {Promise<Object|Object[]>} - Single user object if one username is passed, else an array of user objects.
 * @throws Will throw an error if no users are found or if a database error occurs.
 */
const fetchUsersByQuery = async (usernamesString) => {
  if (!usernamesString || typeof usernamesString !== "string") {
    throw new Error("A valid username string is required.");
  }

  // Split the string by commas and spaces, then remove empty values
  const usernames = usernamesString.split(/[\s,]+/).filter(Boolean);

  if (usernames.length === 0) {
    throw new Error("No valid usernames provided.");
  }

  if (usernames.length === 1) {
    // If only one username is present, fetch a single user
    const user = await User.findOne({ where: { username: usernames[0] }, raw: true });
    if (!user) throw new Error("User not found.");
    return [user]; // Always return an array
  } else {
    // Fetch multiple users
    const users = await User.findAll({
      where: { username: usernames },
      raw: true
    });

    if (users.length === 0) throw new Error("No users found.");
    
    return users;
  }
};

module.exports = fetchUsersByQuery;
