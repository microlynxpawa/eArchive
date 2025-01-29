const bcrypt = require('bcryptjs');
const User = require('../../model/user');
const { createOrUpdateLoginRecord } = require('../../util/directory');

async function authenticateUser(username, password) {
  if (!username) {
    throw new Error('User required');
  }

  if (!password) {
    throw new Error('Password required');
  }

  // Find the user record
  const userRecord = await User.findOne({ where: { username } });

  if (!userRecord) {
    throw new Error('Invalid credentials');
  }

  // Validate password
  const isValidPassword = await bcrypt.compare(password, userRecord.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Create or update login record
  await createOrUpdateLoginRecord(userRecord.id, username);

  return {
    userId: userRecord.id,
    route: '/admin/dashboard',
  };
}

module.exports = authenticateUser;
