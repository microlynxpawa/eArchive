const fs = require('fs');
const Path = require('path');
const User = require("../../model/user");
const File = require("../../model/file");

// Service Function to Send Files by Username
const sendFilesToUsers = async (usernames, files) => {
  console.log("[sendFilesToUsers] Called with usernames:", usernames);
  console.log("[sendFilesToUsers] Called with files:", files);

  if (!usernames || !files || !Array.isArray(files)) {
    console.error("[sendFilesToUsers] Invalid input: usernames or files missing/invalid");
    throw new Error("Usernames and files (array) are required.");
  }

  const missingFiles = [];

  for (const file of files) {
    console.log(`[sendFilesToUsers] Processing file: ${file}`);

    // Fetch file record from the database
    const fileRecord = await File.findOne({ where: { fileName: file } });
    if (!fileRecord) {
      missingFiles.push(file);
      console.warn(`[sendFilesToUsers] File not found in database: ${file}`);
      continue;
    }
    console.log(`[sendFilesToUsers] Found file record in DB:`, fileRecord);

    // Construct the full path of the file
    const sourceFilePath = Path.join(fileRecord.filePath, file);
    console.log(`[sendFilesToUsers] Source file path for ${file}: ${sourceFilePath}`);

    if (!fs.existsSync(sourceFilePath)) {
      missingFiles.push(file);
      console.warn(`[sendFilesToUsers] File does not exist at source location: ${sourceFilePath}`);
      continue;
    }
    console.log(`[sendFilesToUsers] File exists on disk: ${sourceFilePath}`);

    // Iterate through usernames and copy the file to each user's folder
    for (const username of usernames) {
      console.log(`[sendFilesToUsers] Processing username: ${username}`);

      const user = await User.findOne({ where: { username } });
      if (!user) {
        console.warn(`[sendFilesToUsers] User not found for username: ${username}`);
        continue;
      }
      console.log(`[sendFilesToUsers] Found user:`, user);

      if (!user.folderPath) {
        console.warn(`[sendFilesToUsers] folderPath is missing for user with username: ${username}`);
        continue;
      }
      console.log(`[sendFilesToUsers] User folderPath: ${user.folderPath}`);

      // Define target file path
      const targetFilePath = Path.join(user.folderPath, file);
      console.log(`[sendFilesToUsers] Target file path for ${username}: ${targetFilePath}`);

      try {
        // Ensure the target directory exists
        fs.mkdirSync(user.folderPath, { recursive: true });
        console.log(`[sendFilesToUsers] Ensured directory exists: ${user.folderPath}`);

        // Copy the file
        fs.copyFileSync(sourceFilePath, targetFilePath);
        console.log(`[sendFilesToUsers] Successfully copied file: ${file} to ${username}'s folder.`);
      } catch (err) {
        console.error(
          `[sendFilesToUsers] Error copying file ${file} to ${username}'s folder:`,
          err
        );
      }
    }
  }

  if (missingFiles.length > 0) {
    console.warn(`[sendFilesToUsers] The following files were missing or not processed: ${JSON.stringify(missingFiles)}`);
  } else {
    console.log("[sendFilesToUsers] All files processed successfully.");
  }

  return { missingFiles };
};

module.exports = sendFilesToUsers;
