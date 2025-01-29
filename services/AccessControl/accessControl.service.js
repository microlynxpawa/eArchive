const User = require("../../model/user");
const Auths = require("../../model/authorizations");

/**
 * Updates user permissions based on roles.
 * @param {string} username - The username of the user to update.
 * @param {object} roles - Object containing admin, supervisor, and personnel roles.
 * @returns {Promise<string>} - A success message upon successful update.
 */
const updateUserPermissions = async (username, roles) => {
  const { admin, supervisor, personnel } = roles;

  // Fetch the user
  const user = await User.findOne({ where: { username } });
  if (!user) {
    throw new Error("User not found.");
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
    });
  }

  // Update only the relevant columns
  await Auths.update(updates, { where: { userId: user.id } });

  return "Permissions updated successfully.";
};

module.exports = updateUserPermissions;
