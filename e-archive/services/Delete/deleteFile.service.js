const Path = require("path");
const File = require("../../model/file");
const AuditLog = require("../../model/auditLogs");
const { getProvider } = require("../../storage/storageProvider");
const { toCloudKey } = require("../../util/directory");

/**
 * Delete files by name (preferred) or by full path (legacy — filename extracted automatically).
 * @param {string[]} files - Array of file names or legacy absolute paths
 * @param {number} userId
 */
const deleteFiles = async (files, userId) => {
  if (!files || !Array.isArray(files)) {
    throw new Error("Files (array) are required.");
  }

  const deletedFiles = [];
  const missingFiles = [];
  const errors = [];

  const provider = await getProvider();

  for (const fileInput of files) {
    try {
      // Accept both file names and legacy absolute paths
      const fileName = Path.basename(fileInput);

      const fileRecord = await File.findOne({ where: { fileName } });
      if (!fileRecord) {
        missingFiles.push(fileName);
        console.warn(`[deleteFiles] No DB record found for: ${fileName}`);
        continue;
      }

      const cloudKey = toCloudKey(fileRecord.filePath) + fileName;

      await provider.delete(cloudKey);
      deletedFiles.push(fileName);

      const userLogs = await AuditLog.findOne({
        where: { userId },
        order: [["createdAt", "DESC"]],
      });
      if (userLogs) await userLogs.update({ deleted: true });

      await File.destroy({ where: { fileName } });
    } catch (err) {
      console.error(`[deleteFiles] Error deleting ${fileInput}:`, err);
      errors.push({ file: fileInput, error: err.message });
    }
  }

  return { deletedFiles, missingFiles, errors };
};

module.exports = deleteFiles;
