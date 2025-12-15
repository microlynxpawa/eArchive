const User = require("../../model/user");
const Auths = require("../../model/authorizations");
const ArchiveCategory = require("../../model/archiveCategory"); // Assuming this is the model for the ArchiveCategory table

/**
 * Updates permissions for all users in a department.
 * @param {string} departmentName - The name of the department to update.
 * @param {object} roles - Object containing admin, supervisor, and personnel roles.
 * @returns {Promise<string>} - A success message upon successful update.
 */
const updateDepartmentPermissions = async (departmentName, roles) => {
  const { admin, supervisor, personnel } = roles;

  // Fetch all users whose userGroupId matches the department name in the ArchiveCategory table
  const usersInDepartment = await User.findAll({
    include: [
      {
        model: ArchiveCategory,
        where: { name: departmentName }, // Use the department name to filter
      },
    ],
    attributes: ["id"], // Only fetch the user IDs
    raw: true,
  });  

  if (!usersInDepartment || usersInDepartment.length === 0) {
    throw new Error("No users found in the specified department.");
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

  // Update the permissions for all users in the department
  const userIds = usersInDepartment.map((user) => user.id);
  await Auths.update(updates, { where: { userId: userIds } });

  return `Permissions updated successfully for department: ${departmentName}.`;
};

module.exports = updateDepartmentPermissions;
