// Service File: fileService.js
const fs = require("fs");
const Path = require("path");
const mime = require("mime");
const File = require("../../model/file");

/**
 * Fetch file content logic.
 * @param {string} fileName - The name of the file to retrieve.
 * @returns {Promise<{ fullPath: string, mimeType: string }>} - Object containing the full path and MIME type of the file.
 */
const getFileContentLogic = async (fileName) => {
  if (!fileName) {
    throw new Error("File name is missing");
  }

  // Query the database for the file's path
  const fileRecord = await File.findOne({ where: { fileName } });

  if (!fileRecord) {
    throw new Error("File not found in the database");
  }

  const fullPath = Path.join(fileRecord.filePath, fileName); // Combine path and file name

  if (!fs.existsSync(fullPath)) {
    throw new Error("File not found on the server");
  }

  // Get the MIME type of the file
  const mimeType = mime.getType(fullPath);

  return { fullPath, mimeType };
};

module.exports = getFileContentLogic;
