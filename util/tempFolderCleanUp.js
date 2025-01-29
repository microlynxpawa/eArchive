const fs = require("fs");
const path = require("path");

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

module.exports = cleanTempFolders;
