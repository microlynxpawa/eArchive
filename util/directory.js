const path = require("path");
const fs = require("fs");
const readline = require("readline");
const AuditLog = require("../model/auditLogs");
const ArchiveCategory = require("../model/archiveCategory");
const User = require("../model/user");
const Branch = require("../model/branch");
const Authorization = require("../model/authorizations");

// default path
const DEFAULT_PATH = process.env.FOLDER || "C:\\e-archiveUploads";

// Ensure that the destination directory exists, create it if it doesn't
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

// get default storage path
const getDirectoryStoragePath = (directory) => {
  return path.join(DEFAULT_PATH, directory);
};

const createDefaultDirectory = () => {
  if (!fs.existsSync(DEFAULT_PATH))
    fs.mkdirSync(DEFAULT_PATH, { recursive: true });
};

const createBranchDirectory = (directory) => {
  const branchPath = getDirectoryStoragePath(directory);
  if (!fs.existsSync(branchPath)) {
    fs.mkdirSync(branchPath, { recursive: true });
  }
};

const updateBranchDirectory = (oldName, newName) => {
  const directory = getDirectoryStoragePath(oldName);
  const newDirectory = getDirectoryStoragePath(newName);
  if (fs.existsSync(directory)) fs.renameSync(directory, newDirectory);
};

const removeDirectory = (directory) => {
  try {
    // Normalize the path for consistency
    const normalizedPath = path.join(DEFAULT_PATH, directory);
    
    // Check if the directory exists
    if (fs.existsSync(normalizedPath)) {
      // Use `rmSync` (Node.js 14.14+ recommended) for more reliable deletion
      fs.rmSync(normalizedPath, { recursive: true, force: true });
      console.log(`Successfully deleted folder: ${normalizedPath}`);
      return true;
    } else {
      console.error(`Directory not found: ${normalizedPath}`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting folder: ${error.message}`);
    return false;
  }
};

const renameDirectory = (oldPath, newPath) => {
  if (fs.existsSync(oldPath))
    if (!fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`Folder renamed from ${oldPath} to ${newPath}`);
    } else
      console.log(`Error: A folder with the name ${newPath} already exists.`);
  else console.log(`Error: The folder ${oldPath} does not exist.`);
};

// New function to create folder without sub folders
const createUserFolder = (branch, group, user) => {
  const userPath = path.join(DEFAULT_PATH, branch, group, user);
  if (!fs.existsSync(userPath)) {
    fs.mkdirSync(userPath, { recursive: true });
  }
};

function storeFile(file, branch, department, userName, targetPath) {
  let filePath;

  if (targetPath && targetPath.trim() !== "") {
    filePath = path.resolve(targetPath);
  } else {
    const baseDir = path.resolve("uploads");
    const branchFolder = branch.replace(/\s+/g, "_").toLowerCase();
    const departmentFolder = department.replace(/\s+/g, "_").toLowerCase();
    const userFolder = userName.replace(/\s+/g, "_").toLowerCase();

    filePath = path.join(baseDir, branchFolder, departmentFolder, userFolder);
  }

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }

  const savedFilePath = path.join(filePath, file.originalname);

  fs.renameSync(file.path, savedFilePath);

  return savedFilePath;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function transformPermissions(permissions) {
  // Define all possible permissions
  const allPermissions = [
    { key: "scanning", dbKey: "scanning" },
    { key: "archiving", dbKey: "archiving" },
    { key: "view-upload", dbKey: "view_upload" },
    { key: "supervision-right", dbKey: "supervision_right" },
    { key: "email-notification", dbKey: "email_notification" },
    { key: "canViewOwnFiles", dbKey: "canViewOwnFiles" },
    { key: "canViewDepartmentFiles", dbKey: "canViewDepartmentFiles" },
    { key: "canViewBranchFiles", dbKey: "canViewBranchFiles" },
    { key: "can_delete", dbKey: "can_delete" },
    { key: "is_admin", dbKey: "is_admin" },
  ];

  // Transform the permissions array into an object with true/false values
  return allPermissions.reduce((acc, { key, dbKey }) => {
    acc[dbKey] = permissions.includes(key);
    return acc;
  }, {});
}

const ensureUniqueFileName = (fileName) => {
  const fileExtension = path.extname(fileName); // Get the file extension
  const baseName = path.basename(fileName, fileExtension); // Get the base name without the extension
  let d = new Date();
  const crrntDate = `${d.getUTCDate()}-${
    d.getUTCMonth() + 1
  }-${d.getUTCFullYear()}`;
  //const timestamp = Date.now(); // Get the current timestamp
  const timestamp = crrntDate;
  return `${baseName}_${timestamp}${fileExtension}`; // Return the modified file name
};

// Audit log utility functions

const createOrUpdateLoginRecord = async (userId, name) => {
  try {
    // Find log record to update
    const unfinishedSession = await AuditLog.findOne({
      where: { userId, logoutTime: null },
    });

    // Fetch user records
    const user = await User.findOne({
      where: { id: userId },
      include: [
        { model: Branch, attributes: ["name"] },
        { model: ArchiveCategory, attributes: ["name"] },
      ],
    });

    const branch = user.branch.dataValues.name;
    const department = user.archive_category.dataValues.name;

    if (!unfinishedSession) {
      // Create a new record for this login
      await AuditLog.create({
        userId,
        name,
        loginTime: new Date(),
        branch,
        department,
      });
    } else {
      console.warn(
        "Unfinished session detected; skipping login record creation."
      );
    }
  } catch (error) {
    console.error("Error creating or updating login record:", error);
  }
};

const updateLogoutTime = async (userId) => {
  try {
    const unfinishedSession = await AuditLog.findOne({
      where: { userId, logoutTime: null },
      order: [["loginTime", "DESC"]],
    });

    if (unfinishedSession) {
      unfinishedSession.logoutTime = new Date();
      await unfinishedSession.save();
    } else {
      console.warn("No unfinished session found for logout.");
    }
  } catch (error) {
    console.error("Error updating logout time:", error);
  }
};

const getDefaultFolders = async () => {
  let folders = [];
  let categories = await ArchiveCategory.findAll();
  const systemDefaultFolder = process.env.DEFAULT_FOLDERS;
  folders.push(...systemDefaultFolder.split("|"));
  folders.push(...categories.map((folder) => folder.dataValues.name));
  return folders;
};

const slugify = (text) => {
  return text.trim().toLocaleLowerCase().replaceAll(" ", "-");
};

const moveFilesAndDeleteOldDirectory = (oldDirectoryPath, newDirectoryPath) => {
  // Extract the last folder name from the old and new directory paths
  const oldLastFolder = path.basename(oldDirectoryPath);
  const newLastFolder = path.basename(newDirectoryPath);

  // Construct the full paths for the last folders
  const oldLastFolderPath = path.dirname(oldDirectoryPath);
  const newLastFolderPath = path.dirname(newDirectoryPath);

  // Check if the old directory exists
  if (fs.existsSync(oldDirectoryPath)) {
    // Ensure the new directory exists
    if (!fs.existsSync(newDirectoryPath)) {
      fs.mkdirSync(newDirectoryPath, { recursive: true });
    }

    // Read the contents of the old directory
    const files = fs.readdirSync(oldDirectoryPath);

    // Move each file to the new directory
    files.forEach((file) => {
      const oldFilePath = path.join(oldDirectoryPath, file);
      const newFilePath = path.join(newDirectoryPath, file);
      fs.renameSync(oldFilePath, newFilePath);
    });

    // Delete the old directory after moving the files
    fs.rmdirSync(oldDirectoryPath);

    console.log(`Files moved from ${oldDirectoryPath} to ${newDirectoryPath}`);
  } else {
    console.error(`Old directory does not exist: ${oldDirectoryPath}`);
  }
};

async function importUsers() {
  const filePath = path.join("transformedUsersHashed.json");
  const rawData = fs.readFileSync(filePath);
  const users = JSON.parse(rawData);

  for (const user of users) {
    try {
      const branch = await Branch.findOne({ where: { name: user.branchId } });
      const department = await ArchiveCategory.findOne({ where: { name: user.userGroupId } });

      if (!branch || !department) {
        console.warn(`Skipping ${user.username} — Branch or Department not found.`);
        continue;
      }

      const [userRecord, created] = await User.findOrCreate({
        where: { username: user.username },
        defaults: {
          fullname: user.fullname,
          email: user.email,
          private_email: user.private_email,
          password: user.password,
          permissions: JSON.stringify(user.permissions),
          branchId: branch.id,
          userGroupId: department.id,
          folderPath: user.folderPath,
          profilePicturePath: user.profilePicturePath,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });

      if (!created) {
        await userRecord.update({
          fullname: user.fullname,
          email: user.email,
          private_email: user.private_email,
          password: user.password,
          permissions: JSON.stringify(user.permissions),
          branchId: branch.id,
          userGroupId: department.id,
          folderPath: user.folderPath,
          profilePicturePath: user.profilePicturePath,
          updatedAt: user.updatedAt,
        });
        console.log(`✅ Updated existing user: ${user.username}`);
      } else {
        console.log(`🆕 Created user: ${user.username}`);
      }
    } catch (err) {
      console.error(`❌ Failed to process ${user.username}:`, err.message);
    }
  }
};


async function importAuthorizations() {
  const filePath = path.join("transformedAuths.json");
  const rawData = fs.readFileSync(filePath);
  const auths = JSON.parse(rawData);

  for (const auth of auths) {
    try {
      const user = await User.findOne({ where: { email: auth.email } });

      if (!user) {
        console.warn(`⚠️ User not found for email: ${auth.email}. Skipping.`);
        continue;
      }

      const [record, created] = await Authorization.findOrCreate({
        where: { userId: user.id },
        defaults: {
          userId: user.id,
          canViewOwnFiles: auth.canViewOwnFiles,
          canViewDepartmentFiles: auth.canViewDepartmentFiles,
          canViewBranchFiles: auth.canViewBranchFiles,
          scanning: auth.scanning,
          archiving: auth.archiving,
          supervision_right: auth.supervision_right,
          email_notification: auth.email_notification,
          view_upload: auth.view_upload,
          is_disabled: auth.is_disabled,
          is_admin: auth.is_admin,
          createdAt: auth.createdAt,
          updatedAt: auth.updatedAt,
        },
      });

      if (!created) {
        await record.update({
          canViewOwnFiles: auth.canViewOwnFiles,
          canViewDepartmentFiles: auth.canViewDepartmentFiles,
          canViewBranchFiles: auth.canViewBranchFiles,
          scanning: auth.scanning,
          archiving: auth.archiving,
          supervision_right: auth.supervision_right,
          email_notification: auth.email_notification,
          view_upload: auth.view_upload,
          is_disabled: auth.is_disabled,
          is_admin: auth.is_admin,
          updatedAt: auth.updatedAt,
        });

        console.log(`✅ Updated authorization for ${auth.email}`);
      } else {
        console.log(`🆕 Created authorization for ${auth.email}`);
      }
    } catch (err) {
      console.error(`❌ Error processing ${auth.email}:`, err.message);
    }
  }
};




module.exports = {
  createDefaultDirectory,
  renameDirectory,
  createBranchDirectory,
  updateBranchDirectory,
  removeDirectory,
  createUserFolder,
  storeFile,
  askQuestion,
  ensureDirectoryExists,
  transformPermissions,
  createOrUpdateLoginRecord,
  updateLogoutTime,
  ensureUniqueFileName,
  getDefaultFolders,
  slugify,
  moveFilesAndDeleteOldDirectory,
  importUsers,
  importAuthorizations
};
