const mime = require("mime");
const File = require("../../model/file");
const AuditLog = require("../../model/auditLogs");
const { getProvider } = require("../../storage/storageProvider");

/**
 * Returns the cloud storage key and MIME type for a file.
 * The caller is responsible for streaming the file to the response.
 *
 * @param {string} fileName
 * @param {number} userId
 * @returns {Promise<{ cloudKey: string, mimeType: string }>}
 */
const getFileContentLogic = async (fileName, userId) => {
  if (!fileName) throw new Error("File name is missing");

  const fileRecord = await File.findOne({ where: { fileName } });
  if (!fileRecord) throw new Error("File not found in the database");

  const prefix = (fileRecord.filePath || "").replace(/\\/g, "/").replace(/\/?$/, "/");
  const cloudKey = prefix + fileName;

  const provider = await getProvider();
  if (!(await provider.exists(cloudKey))) {
    throw new Error("File not found on storage");
  }

  const mimeType = mime.getType(fileName) || "application/octet-stream";

  const userLogs = await AuditLog.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  if (userLogs) await userLogs.update({ viewed: true });

  return { cloudKey, mimeType };
};

module.exports = getFileContentLogic;
