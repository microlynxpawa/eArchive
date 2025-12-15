const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
require("dotenv").config();

// Define the folders to clean from .env variables
const TEMP_FOLDERS = process.env.TEMP_FOLDERS
  ? process.env.TEMP_FOLDERS.split(",")
  : [];

/**
 * Deletes all files in a folder.
 * @param {string} folderPath - Path to the folder.
 */
const cleanFolder = (folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      }
    });
  } catch (error) {
    console.error(`Error cleaning folder ${folderPath}:`, error);
  }
};

/**
 * Cleans all temporary folders.
 */
const cleanTempFolders = () => {
  TEMP_FOLDERS.forEach(cleanFolder);
};

/**
 * Cleans the server's trash (recycle bin) on Windows.
 */
if (process.platform === "win32") {
const cleanRecycleBin = () => {
  const command = 'powershell -command "Clear-RecycleBin -Force"';

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("Error cleaning recycle bin:", error);
      return;
    }
    console.log("Recycle bin cleaned successfully.");
  });
};
}
else {
  // For Linux or macOS, you can use a different command or library
    console.log("Recycle bin cleaning is not implemented for this OS.");
};

/**
 * Main cleanup task to clean temporary folders and the recycle bin.
 */
const runCleanupTasks = () => {
  console.log("Running cleanup tasks...");
  cleanTempFolders();
  cleanRecycleBin();
};

module.exports = runCleanupTasks;
