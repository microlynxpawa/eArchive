const bcrypt = require("bcryptjs");
const Path = require("path");
const { Sequelize } = require("sequelize"); // Import Sequelize to handle specific errors
const ArchiveCategory = require("../../model/archiveCategory");
const branch = require("../../model/branch");
const User = require("../../model/user");
const Auths = require("../../model/authorizations");
const { createUserFolder, transformPermissions, moveFilesAndDeleteOldDirectory } = require("../../util/directory"); // Utility function for creating folders

const DEFAULT_PATH = "C:/e-archiveUploads"; // Default path for folders

async function createOrUpdateUser({
  fullname,
  branchId,
  userGroup,
  email,
  pEmail,
  password,
  permissions,
  username, // will be ignored for creation
  btnAction,
  updateRecord,
}) {
  try {
    const userBranch = await branch.findOne({ where: { id: branchId } });
    const group = await ArchiveCategory.findOne({ where: { id: userGroup } });

    if (!userBranch || !group) {
      throw new Error("Invalid branch or user group");
    }

    // Generate username: use full name (all words) + @ + branch name (no spaces, lowercase), trim spaces
    const fullNameSlug = fullname.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const branchName = userBranch.dataValues.name.replace(/\s+/g, '').toLowerCase();
    const generatedUsername = `${fullNameSlug}@${branchName}`.trim();
    const trimmedEmail = email.trim();
    const trimmedPEmail = pEmail.trim();

    // Construct folder path
    const folderPath = Path.join(
      DEFAULT_PATH,
      userBranch.dataValues.slug,
      group.dataValues.name,
      generatedUsername
    );

    let userId;

    if (btnAction === "Create") {
      // Create the user (ignore username from frontend, use generatedUsername)
      const hashPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        username: generatedUsername,
        fullname: fullname.trim(),
        email: trimmedEmail,
        private_email: trimmedPEmail,
        password: hashPassword,
        branchId: branchId,
        userGroupId: userGroup,
        permissions,
        folderPath,
      });

      // Create user folder
      createUserFolder(userBranch.dataValues.slug, group.dataValues.name, generatedUsername);

      userId = newUser.id;
      console.log("User created successfully.");
    } else {
      // Update the user (update username as well)
      const isFound = await User.findOne({ where: { id: updateRecord } });
      if (!isFound) {
        throw new Error("Record not found");
      }
      const oldUserFolderPath = isFound.folderPath;
      console.log(`[User Update] Old user folder path:`, oldUserFolderPath);
      // Only update password if provided
      let updateFields = {
        username: generatedUsername, // update username on update as well
        fullname: fullname.trim(),
        email: trimmedEmail,
        private_email: trimmedPEmail,
        branchId: branchId,
        userGroupId: userGroup,
        permissions,
        folderPath,
      };
      if (password && password.trim().length > 0) {
        updateFields.password = await bcrypt.hash(password, 10);
      }
      await User.update(
        updateFields,
        { where: { id: updateRecord } }
      );

      const updatingUserFolderPath = folderPath;
      console.log(`[User Update] New user folder path:`, updatingUserFolderPath);
      console.log(`[User Update] Moving files and updating DB metadata...`);
      await moveFilesAndDeleteOldDirectory(
        oldUserFolderPath,
        updatingUserFolderPath,
        group.dataValues.name,
        userBranch.dataValues.name
      );
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
    // Handle unique constraint error for username
    if (error instanceof Sequelize.UniqueConstraintError) {
      console.error("Error: Username already exists.");
      return { message: "Username not available." }; // Send response to the client
    }

    console.error("Error creating/updating user:", error.message);
    throw error;
  }
}

module.exports = createOrUpdateUser;
