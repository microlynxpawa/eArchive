const User = require("../../model/user");
const Auths = require("../../model/authorizations");

/**
 * Updates user permissions based on roles.
 * @param {string|string[]} usernames - The username(s) of the user(s) to update.
 * @param {object} roles - Object containing admin, supervisor, and personnel roles.
 * @returns {Promise<string>} - A success message upon successful update.
 */
const updateUserPermissions = async (usernames, roles) => {
  const { admin, supervisor, personnel } = roles;

  // Ensure usernames is an array
  const usernameArray = Array.isArray(usernames) ? usernames : [usernames];

  // Fetch all users matching the provided usernames
  const users = await User.findAll({ where: { username: usernameArray } });

  if (!users.length) {
    throw new Error("No users found.");
  }

  // Construct permission updates based on roles
  const updates = {};
  if (personnel) {
    Object.assign(updates, {
      scanning: true,
      archiving: true,
      view_upload: true,
      supervision_right: false,
      email_notification: true,
      canViewOwnFiles: true,
      canViewDepartmentFiles: false,
      canViewBranchFiles: false,
      can_delete: false,
      is_admin: false,
    });
  }
  if (supervisor) {
    Object.assign(updates, {
      scanning: true,
      archiving: true,
      view_upload: true,
      supervision_right: true,
      email_notification: true,
      canViewOwnFiles: true,
      canViewDepartmentFiles: true,
      canViewBranchFiles: false,
      can_delete: false,
      is_admin: false,
    });
  }
  if (admin) {
    Object.assign(updates, {
      scanning: true,
      archiving: true,
      view_upload: true,
      supervision_right: true,
      email_notification: true,
      canViewOwnFiles: true,
      canViewDepartmentFiles: true,
      canViewBranchFiles: true,
      can_delete: true,
      is_admin: true,
    });
  }

  // Loop through each user and update their permissions
  for (const user of users) {
    const authRecord = await Auths.findOne({ where: { userId: user.id } });

    if (authRecord) {
      // Update the existing record
      await authRecord.update(updates);
    } else {
      // Create a new record
      await Auths.create({ userId: user.id, ...updates });
    }
  }

  return `${users.length} user(s) permissions updated successfully.`;
};

module.exports = updateUserPermissions;
