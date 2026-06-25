const Path = require("path");
const ArchiveCategory = require("../../model/archiveCategory");
const branch = require("../../model/branch");
const User = require("../../model/user");
const File = require("../../model/file");
const AuditLog = require("../../model/auditLogs");
const { ensureUniqueFileName, toCloudKey } = require("../../util/directory");
const { getProvider } = require("../../storage/storageProvider");

async function uploadMultipleFiles(files, customNames, userId) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new Error("No files uploaded");
  }
  if (!customNames || customNames.length !== files.length) {
    throw new Error("Custom names missing or count mismatch");
  }

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
    const branchName = user.branch.dataValues.name;
    const catName = user.archive_category.dataValues.name;
    folderPrefix = `${branchName}/${catName}/${user.username}/`;
    await user.update({ folderPath: folderPrefix });
  }
  folderPrefix = toCloudKey(folderPrefix);

  const provider = await getProvider();
  const savedFiles = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = Path.extname(file.originalname);
    const customName = Array.isArray(customNames) ? customNames[i] : customNames;

    let base = customName;
    let batch = "";
    if (customName.includes("@")) {
      [base, batch] = customName.split("@", 2);
    }
    base = base.replace(/[^a-zA-Z0-9\-_. ]/g, "_");
    let safeName = batch ? `${base}@${batch}` : base;
    if (!safeName.toLowerCase().endsWith(ext.toLowerCase())) safeName += ext;
    safeName = ensureUniqueFileName(safeName);

    const cloudKey = folderPrefix + safeName;
    await provider.upload(file.buffer, cloudKey, file.mimetype);

    await File.create({
      userId: user.id,
      fileName: safeName,
      filePath: folderPrefix,
      department: user.archive_category.dataValues.name,
      ranchName: user.branch.dataValues.name,
    });

    savedFiles.push({ filename: safeName, originalname: file.originalname });
  }

  const userLogs = await AuditLog.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  if (userLogs) await userLogs.update({ uploaded: true });

  return { message: "Files uploaded successfully.", files: savedFiles };
}

module.exports = { uploadMultipleFiles };
