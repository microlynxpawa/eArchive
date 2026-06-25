const Path = require("path");
const ArchiveCategory = require("../../model/archiveCategory");
const branch = require("../../model/branch");
const User = require("../../model/user");
const File = require("../../model/file");
const AuditLog = require("../../model/auditLogs");
const { ensureUniqueFileName, toCloudKey } = require("../../util/directory");
const { getProvider } = require("../../storage/storageProvider");

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

  await File.create({
    userId: user.id,
    fileName: uniqueFilename,
    filePath: folderPrefix,
    department: user.archive_category.dataValues.name,
    ranchName: user.branch.dataValues.name,
  });

  const userLogs = await AuditLog.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  if (userLogs) await userLogs.update({ uploaded: true });

  return { message: "File uploaded successfully", path: folderPrefix };
};

module.exports = uploadFileLogic;
