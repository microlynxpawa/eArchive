const path = require("path");
const fs = require("fs");
const readline = require('readline');
const AuditLog = require('../model/auditLogs');
const ArchiveCategory = require("../model/archiveCategory");



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

const createBranchDirectory = (directory, subFolders) => {
  const branchPath = getDirectoryStoragePath(directory);
  if (!fs.existsSync(branchPath)) {
    fs.mkdirSync(branchPath, { recursive: true });
    subFolders.forEach((singleFolder) => {
      const subFolderPath = path.join(branchPath, singleFolder);
      if (!fs.existsSync(subFolderPath))
        fs.mkdirSync(subFolderPath, { recursive: true });
    });
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
    const normalizedPath = path.normalize(directory);

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

  if (targetPath && targetPath.trim() !== '') {
    filePath = path.resolve(targetPath);
  } else {
    const baseDir = path.resolve('uploads');
    const branchFolder = branch.replace(/\s+/g, '_').toLowerCase();
    const departmentFolder = department.replace(/\s+/g, '_').toLowerCase();
    const userFolder = userName.replace(/\s+/g, '_').toLowerCase();

    filePath = path.join(baseDir, branchFolder, departmentFolder, userFolder);
  }

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }

  const savedFilePath = path.join(filePath, file.originalname);

  fs.renameSync(file.path, savedFilePath);

  return savedFilePath;
};

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
};

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
  ];

  // Transform the permissions array into an object with true/false values
  return allPermissions.reduce((acc, { key, dbKey }) => {
    acc[dbKey] = permissions.includes(key);
    return acc;
  }, {});
};

const ensureUniqueFileName = (fileName) => {
  const fileExtension = path.extname(fileName); // Get the file extension
  const baseName = path.basename(fileName, fileExtension); // Get the base name without the extension
  const timestamp = Date.now(); // Get the current timestamp
  return `${baseName}_${timestamp}${fileExtension}`; // Return the modified file name
};

// Audit log utility functions

const createOrUpdateLoginRecord = async (userId, name) => {
  try {
    const unfinishedSession = await AuditLog.findOne({
      where: { userId, logoutTime: null },
    });

    if (!unfinishedSession) {
      // Create a new record for this login
      await AuditLog.create({
        userId,
        name,
        loginTime: new Date(),
      });
    } else {
      console.warn("Unfinished session detected; skipping login record creation.");
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
  slugify
};
