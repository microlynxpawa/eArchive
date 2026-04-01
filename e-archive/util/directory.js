const path = require("path");
const fs = require("fs");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const AuditLog = require("../model/auditLogs");
const ArchiveCategory = require("../model/archiveCategory");
const User = require("../model/user");
const Branch = require("../model/branch");
const Authorization = require("../model/authorizations");
const fetch = require('node-fetch');
const File = require("../model/file"); // Add this import for DB file path updates

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
      const loginTime = await getReliableTime();
      // const loginTime = new Date()
      await AuditLog.create({
        userId,
        name,
        loginTime,
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
      const logoutTime = await getReliableTime();
      unfinishedSession.logoutTime = logoutTime;
      await unfinishedSession.save();
    } else {
      console.warn("No unfinished session found for logout.");
    }
  } catch (error) {
    console.error("Error updating logout time:", error);
  }
};

async function getReliableTime() {
  try {
    // Use worldtimeapi.org for a reliable UTC time
    const response = await fetch('http://worldtimeapi.org/api/timezone/Etc/UTC');
    if (!response.ok) throw new Error('Failed to fetch time');
    const data = await response.json();
    // data.utc_datetime is ISO string, e.g. "2025-06-04T12:34:56.789Z"
    return new Date(data.utc_datetime);
  } catch (err) {
    console.error('Failed to fetch reliable time, falling back to system time:', err.message);
    return new Date();
  }
}

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


/**
 * Moves all files from oldDirectoryPath to newDirectoryPath, updates DB records for filePath, department, ranchName, and sets movedFrom.
 * @param {string} oldDirectoryPath - The old folder path.
 * @param {string} newDirectoryPath - The new folder path.
 * @param {string} newDepartment - The new department name.
 * @param {string} newBranch - The new branch name.
 */
const moveFilesAndDeleteOldDirectory = async (oldDirectoryPath, newDirectoryPath, newDepartment, newBranch) => {
  const File = require("../model/file");
  const path = require("path");
  const fs = require("fs");

  if (oldDirectoryPath === newDirectoryPath) {
    console.log(`[moveFilesAndDeleteOldDirectory] Old and new directory are the same. No move needed.`);
    return;
  }

  // Move files in filesystem
  if (fs.existsSync(oldDirectoryPath)) {
    // Ensure new directory exists
    if (!fs.existsSync(newDirectoryPath)) {
      fs.mkdirSync(newDirectoryPath, { recursive: true });
      console.log(`[moveFilesAndDeleteOldDirectory] Created new directory: ${newDirectoryPath}`);
    }

    // Move all files and subfolders
    const moveRecursive = (src, dest) => {
      const items = fs.readdirSync(src);
      for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          if (!fs.existsSync(destPath)) fs.mkdirSync(destPath);
          moveRecursive(srcPath, destPath);
        } else {
          fs.renameSync(srcPath, destPath);
          console.log(`[moveFilesAndDeleteOldDirectory] Moved file: ${srcPath} -> ${destPath}`);
        }
      }
    };
    moveRecursive(oldDirectoryPath, newDirectoryPath);

    // Log all filePath values for this user for debugging
    const allFiles = await File.findAll();
    const normalizedOldDir = path.normalize(oldDirectoryPath);
    const matchingFiles = allFiles.filter(f => {
      // Normalize both paths for comparison
      return path.normalize(f.filePath).startsWith(normalizedOldDir);
    });
    if (matchingFiles.length === 0) {
      console.warn(`[moveFilesAndDeleteOldDirectory] No files found in DB for oldDirectoryPath: ${normalizedOldDir}`);
      console.warn(`[moveFilesAndDeleteOldDirectory] Sample filePath values in DB:`);
      allFiles.slice(0, 10).forEach(f => console.warn(`  ${f.filePath}`));
    } else {
      console.log(`[moveFilesAndDeleteOldDirectory] Found ${matchingFiles.length} files to update in DB.`);
    }
    for (const file of matchingFiles) {
      // Compute new filePath
      const relative = path.relative(normalizedOldDir, path.normalize(file.filePath));
      const newFilePath = path.join(newDirectoryPath, relative);
      await file.update({
        filePath: newFilePath,
        department: newDepartment,
        ranchName: newBranch,
        movedFrom: oldDirectoryPath
      });
      console.log(`[moveFilesAndDeleteOldDirectory] Updated DB record for file ID ${file.id}: new filePath=${newFilePath}, department=${newDepartment}, ranchName=${newBranch}, movedFrom=${oldDirectoryPath}`);
    }

    // Remove old directory
    fs.rmSync(oldDirectoryPath, { recursive: true, force: true });
    console.log(`[moveFilesAndDeleteOldDirectory] Removed old directory: ${oldDirectoryPath}`);
  } else {
    console.warn(`[moveFilesAndDeleteOldDirectory] Old directory does not exist: ${oldDirectoryPath}`);
  }
}

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


function cleanTransformedUsers() {
  const filePath = path.join(__dirname, "transformedUsersHashed.json");
  if (!fs.existsSync(filePath)) return;
  let users;
  try {
    users = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("Could not parse transformedUsers.json", e);
    return;
  }
  if (!Array.isArray(users)) return;
  const cleaned = users.map((user) => {
    if (!user || typeof user !== "object") return user;
    // Clean username: last word of fullname + @ + branchId, all trimmed and lowercased
    let username = user.fullname ? user.fullname.trim().split(/\s+/).pop() : "";
    let branch = user.branchId ? user.branchId.toString().replace(/\s+/g, '').toLowerCase() : "";
    const newUsername = `${username}@${branch}`.trim();
    // Clean emails
    let email = user.email ? user.email.trim() : user.email;
    let private_email = user.private_email ? user.private_email.trim() : user.private_email;
    // Clean folderPath: C:\e-archiveUploads\<branchId>\<userGroupId>\<username>
    let folderPath = `C:\\e-archiveUploads\\${user.branchId || ''}\\${user.userGroupId || ''}\\${newUsername}`;
    return {
      ...user,
      username: newUsername,
      email,
      private_email,
      folderPath,
    };
  });
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), "utf8");
  console.log("transformedUsers.json cleaned and updated.");
}

async function hashTransformedUserPasswords() {
  const fs = require("fs");
  const path = require("path");
  const srcPath = path.join(__dirname, "../transformedUsers.json");
  const destPath = path.join(__dirname, "../transformedUsersHashed.json");
  if (!fs.existsSync(srcPath)) return;
  let users;
  try {
    users = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  } catch (e) {
    console.error("Could not parse transformedUsers.json", e);
    return;
  }
  if (!Array.isArray(users)) return;
  const hashedUsers = await Promise.all(users.map(async (user) => {
    if (!user || typeof user !== "object" || !user.password) return user;
    const hashedPassword = await bcrypt.hash(user.password, 10);
    return {
      ...user,
      password: hashedPassword,
    };
  }));
  fs.writeFileSync(destPath, JSON.stringify(hashedUsers, null, 2), "utf8");
  console.log("transformedUsersHashed.json created with hashed passwords.");
}

// Utility to export usernames, passwords, and full names to userCredentials.txt
function exportUserCredentials() {
  const usersPath = path.join(__dirname, '../transformedUsers.json');
  const outputPath = path.join(__dirname, '../userCredentials.txt');
  if (!fs.existsSync(usersPath)) return;
  let users;
  try {
    users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  } catch (e) {
    console.error('Could not parse transformedUsers.json', e);
    return;
  }
  if (!Array.isArray(users)) return;
  const lines = users
    .filter(u => u && u.username && u.password && u.fullname)
    .map(u => `Username: ${u.username} | Password: ${u.password} | Full Name: ${u.fullname}`);
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log('User credentials exported to userCredentials.txt');
}

/**
 * Checks if the DEFAULT_PATH exists and is not empty. If not, builds a folder structure from the File table.
 * @returns {Promise<null|object>} Returns null if the folder exists and is not empty, or the structure if built from DB.
 */
async function getFallbackFolderStructureFromDB() {
  // Check if DEFAULT_PATH exists and is not empty
  if (fs.existsSync(DEFAULT_PATH)) {
    const entries = fs.readdirSync(DEFAULT_PATH);
    // Filter out system files like .DS_Store, thumbs.db, etc.
    const filtered = entries.filter(e => !e.startsWith('.') && e !== 'Thumbs.db');
    if (filtered.length > 0) {
      // Directory exists and is not empty
      return null;
    }
  }

  // Build structure from File table
  const files = await File.findAll();
  const structure = {};
  for (const file of files) {
    // file.filePath is the directory, file.fileName is the file
    // Remove DEFAULT_PATH from filePath if present
    let relPath = file.filePath.replace(DEFAULT_PATH, '').replace(/^\\|\//, '');
    const parts = relPath.split(/\\|\//).filter(Boolean);
    let current = structure;
    for (const part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
    // Place file in .files array
    if (!current.files) current.files = [];
    current.files.push(file.fileName);
  }
  return structure;
}

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
  importAuthorizations,
  cleanTransformedUsers,
  hashTransformedUserPasswords,
  exportUserCredentials,
  getFallbackFolderStructureFromDB,
};
