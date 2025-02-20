const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Define the folders to clean
const TEMP_FOLDERS = [
  "C:\\Users\\LENOVO\\Downloads\\e-archive\\e-archive\\e-archive\\util\\eArchiiveUploads\\temporary",
  "C:\\Users\\LENOVO\\Downloads\\e-archive\\e-archive\\e-archive\\eArchiiveUploads",
];

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
const cleanRecycleBin = () => {
  const command = 'rd /s /q %SystemDrive%\\$Recycle.Bin';

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("Error cleaning recycle bin:", error);
      return;
    }
    console.log("Recycle bin cleaned successfully.");
  });
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
