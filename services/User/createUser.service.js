const bcrypt = require("bcryptjs");
const Path = require("path");
const ArchiveCategory = require("../../model/archiveCategory");
const branch = require("../../model/branch");
const User = require("../../model/user");
const Auths = require("../../model/authorizations");
const { createUserFolder, transformPermissions } = require("../../util/directory"); // Utility function for creating folders

const DEFAULT_PATH = "C:/e-archiveUploads"; // Default path for folders

async function createOrUpdateUser({
  fullname,
  branchId,
  userGroup,
  email,
  pEmail,
  password,
  permissions,
  username,
  btnAction,
  updateRecord,
}) {
  try {
    const hashPassword = await bcrypt.hash(password, 10);

    const userBranch = await branch.findOne({ where: { id: branchId } });
    const group = await ArchiveCategory.findOne({ where: { id: userGroup } });

    if (!userBranch || !group) {
      throw new Error("Invalid branch or user group");
    }

    // Construct folder path
    const folderPath = Path.join(
      DEFAULT_PATH,
      userBranch.dataValues.slug,
      group.dataValues.name,
      username
    );

    let userId;

    if (btnAction === "Create") {
      // Create the user
      const newUser = await User.create({
        username,
        fullname,
        email,
        private_email: pEmail,
        password: hashPassword,
        branchId: branchId,
        userGroupId: userGroup,
        permissions,
        folderPath,
      });

      // Create user folder
      createUserFolder(userBranch.dataValues.slug, group.dataValues.name, username);

      userId = newUser.id;
      console.log("User created successfully.");
    } else {
      // Update the user
      const isFound = await User.findOne({ where: { id: updateRecord } });
      if (!isFound) {
        throw new Error("Record not found");
      }

      await User.update(
        {
          username,
          fullname,
          email,
          private_email: pEmail,
          password: hashPassword,
          branchId: branchId,
          userGroupId: userGroup,
          permissions,
          folderPath,
        },
        { where: { id: updateRecord } }
      );

      // Create user folder
      createUserFolder(userBranch.dataValues.slug, group.dataValues.name, username);

      userId = updateRecord;
      console.log("User updated successfully.");
    }

    // Transform permissions for authorizations table
    const transformedPermissions = transformPermissions(permissions);

    // Update the authorizations table
    const existingAuth = await Auths.findOne({ where: { userId } });

    if (existingAuth) {
      await existingAuth.update(transformedPermissions);
      console.log("Authorization record updated successfully.");
    } else {
      await Auths.create({ userId, ...transformedPermissions });
      console.log("Authorization record created successfully.");
    }

    return btnAction === "Create"
      ? { message: "User created successfully." }
      : { message: "User updated successfully." };
  } catch (error) {
    console.error("Error creating/updating user:", error.message);
    throw error;
  }
}

module.exports = createOrUpdateUser;
