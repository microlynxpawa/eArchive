const fs = require("fs");
const Path = require("path");
const ArchiveCategory = require("../../model/archiveCategory");
const branch = require("../../model/branch");
const User = require("../../model/user");
const File = require("../../model/file");
const AuditLog = require("../../model/auditLogs");
const {
  ensureDirectoryExists,
  ensureUniqueFileName,
} = require("../../util/directory");

const DEFAULT_PATH = process.env.FOLDER || "C:\\e-archiveUploads";

/**
 * Handles multiple file uploads, saves files with custom names, and updates the database.
 * @param {Array} files - Array of files (from multer)
 * @param {Array<string>} customNames - Array of custom names for each file
 * @param {string} userId - ID of the uploading user
* @returns {Promise<{ message: string, files: Array }>} - Upload result
 */
async function uploadMultipleFiles(files, customNames, userId) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new Error("No files uploaded");
  }
  if (!customNames || customNames.length !== files.length) {
    throw new Error("Custom names missing or count mismatch");
  }
  // Fetch user with branch and category
  const user = await User.findOne({
    where: { id: userId },
    include: [
      { model: branch, attributes: ["name"] },
      { model: ArchiveCategory, attributes: ["name"] },
    ],
  });
  if (!user) throw new Error("User not found");

  let folderPath = user.folderPath;
  if (!folderPath) {
    folderPath = Path.join(
      DEFAULT_PATH,
      user.branch.dataValues.name,
      user.archive_category.dataValues.name,
      user.username
    );
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    await user.update({ folderPath });
  }
  // Always ensure the directory exists before saving files (handles deleted folders)
  ensureDirectoryExists(folderPath);

  const savedFiles = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const origName = file.originalname;
    const ext = Path.extname(origName);
    const customName = Array.isArray(customNames) ? customNames[i] : customNames;
    // Split at @ to separate base and batch (if any)
    let base = customName;
    let batch = '';
    if (customName.includes('@')) {
      [base, batch] = customName.split('@', 2);
    }
    // Sanitize only the base (file name part) for filesystem safety
    base = base.replace(/[^a-zA-Z0-9\-_. ]/g, '_');
    // Batch name: do not change or modify at all
    let safeName = batch ? `${base}@${batch}` : base;
    // Ensure the name ends with the correct extension, but don't double it
    if (!safeName.toLowerCase().endsWith(ext.toLowerCase())) {
      safeName += ext;
    }
    safeName = ensureUniqueFileName(safeName);
    const destPath = Path.join(folderPath, safeName);
    fs.writeFileSync(destPath, file.buffer);
    // Save file record in DB
    await File.create({
      userId: user.id,
      fileName: safeName,
      filePath: folderPath,
      department: user.archive_category.dataValues.name,
      branchName: user.branch.dataValues.name,
    });
    savedFiles.push({ filename: safeName, originalname: origName });
  }
  // Optionally update audit log
  const userLogs = await AuditLog.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  if (userLogs) await userLogs.update({ uploaded: true });

  return { message: "Files uploaded successfully.", files: savedFiles };
}

module.exports = { uploadMultipleFiles };
