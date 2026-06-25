const User = require("../../model/user");
const File = require("../../model/file");
const { getProvider } = require("../../storage/storageProvider");
const { toCloudKey } = require("../../util/directory");

const sendFilesViaEmail = async (emails, files) => {
  if (!emails || !files || !Array.isArray(files)) {
    throw new Error("Emails and files (array) are required.");
  }

  const missingFiles = [];
  const provider = await getProvider();

  for (const file of files) {
    const fileRecord = await File.findOne({ where: { fileName: file } });
    if (!fileRecord) {
      missingFiles.push(file);
      console.warn(`[sendFilesViaEmail] File not found in DB: ${file}`);
      continue;
    }

    const sourceKey = toCloudKey(fileRecord.filePath) + file;

    for (const email of emails) {
      const user = await User.findOne({ where: { email } });
      if (!user || !user.folderPath) {
        console.warn(`[sendFilesViaEmail] User/folderPath missing for email: ${email}`);
        continue;
      }

      const destPrefix = toCloudKey(user.folderPath);
      const destKey = destPrefix + file;

      try {
        await provider.copy(sourceKey, destKey);
        await File.create({
          userId: user.id,
          fileName: fileRecord.fileName,
          filePath: destPrefix,
          department: fileRecord.department,
          ranchName: fileRecord.ranchName,
          sentFrom: sourceKey,
        });
      } catch (err) {
        console.error(`[sendFilesViaEmail] Error copying ${file} to ${email}:`, err);
      }
    }
  }

  return { missingFiles };
};

module.exports = sendFilesViaEmail;
