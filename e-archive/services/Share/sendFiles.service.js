const User = require("../../model/user");
const File = require("../../model/file");
const recordFileSending = require("./recordFileSending.service");
const { getProvider } = require("../../storage/storageProvider");
const { toCloudKey } = require("../../util/directory");

const sendFilesToUsers = async (usernames, files, senderContext = {}) => {
  if (!usernames || !files || !Array.isArray(files)) {
    throw new Error("Usernames and files (array) are required.");
  }

  const missingFiles = [];
  const sourceKeys = [];
  const provider = await getProvider();

  for (const file of files) {
    const fileRecord = await File.findOne({ where: { fileName: file } });
    if (!fileRecord) {
      missingFiles.push(file);
      console.warn(`[sendFilesToUsers] File not found in DB: ${file}`);
      continue;
    }

    const sourceKey = toCloudKey(fileRecord.filePath) + file;
    sourceKeys.push(sourceKey);

    for (const username of usernames) {
      const user = await User.findOne({ where: { username } });
      if (!user || !user.folderPath) {
        console.warn(`[sendFilesToUsers] User/folderPath missing for: ${username}`);
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
        console.error(`[sendFilesToUsers] Error copying ${file} to ${username}:`, err);
      }
    }
  }

  if (senderContext.senderId && senderContext.senderUsername) {
    try {
      await recordFileSending(
        senderContext.senderId,
        senderContext.senderUsername,
        usernames,
        files,
        senderContext.batchName || null,
        sourceKeys
      );
    } catch (err) {
      console.error("[sendFilesToUsers] Error recording send history:", err);
    }
  }

  return { missingFiles };
};

module.exports = sendFilesToUsers;
