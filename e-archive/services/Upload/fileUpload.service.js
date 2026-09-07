const Path = require("path");
const ArchiveCategory = require("../../model/archiveCategory");
const branch = require("../../model/branch");
const User = require("../../model/user");
const File = require("../../model/file");
const AuditLog = require("../../model/auditLogs");
const { ensureUniqueFileName, toCloudKey } = require("../../util/directory");
const { getProvider } = require("../../storage/storageProvider");
const { enqueueForIndex } = require("../Search/indexer/queue.service");

const uploadFileLogic = async (file, fileName, userId) => {
  if (!file) throw new Error("No file uploaded");

  const user = await User.findOne({
    where: { id: userId },
    include: [
      { model: branch, attributes: ["name"] },
      { model: ArchiveCategory, attributes: ["name"] },
    ],
  });
  if (!user) throw new Error("User not found");

  let folderPrefix = user.folderPath;
  if (!folderPrefix) {
    // Build a relative forward-slash prefix (cloud key format)
    const branchName = user.branch.dataValues.name;
    const catName = user.archive_category.dataValues.name;
    folderPrefix = `${branchName}/${catName}/${user.username}/`;
    await user.update({ folderPath: folderPrefix });
  }
  folderPrefix = toCloudKey(folderPrefix);

  const uniqueFilename = ensureUniqueFileName(fileName);
  const cloudKey = folderPrefix + uniqueFilename;

  const provider = await getProvider();
  await provider.upload(file.buffer, cloudKey, file.mimetype);

  const record = await File.create({
    userId: user.id,
    fileName: uniqueFilename,
    filePath: folderPrefix,
    department: user.archive_category.dataValues.name,
    ranchName: user.branch.dataValues.name,
  });

  // Queue the file for text extraction. This is one INSERT and the worker
  // re-reads the bytes later, so the upload does not get slower and request
  // memory does not grow. Indexing must never be able to fail an upload: a
  // file that is not searchable yet is a much smaller problem than a file that
  // did not save, so any error here is logged and swallowed.
  try {
    await enqueueForIndex(record.id, { priority: 100 });
  } catch (err) {
    console.error("[SearchIndex] enqueue failed for file", record.id, err.message);
  }

  const userLogs = await AuditLog.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  if (userLogs) await userLogs.update({ uploaded: true });

  return { message: "File uploaded successfully", path: folderPrefix };
};

module.exports = uploadFileLogic;
