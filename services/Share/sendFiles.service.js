const fs = require('fs');
const Path = require('path');
const User = require("../../model/user");
const File = require("../../model/file");

// Service Function to Send Files
const sendFilesToUsers = async (users, files) => {
  if (!users || !files || !Array.isArray(files)) {
    throw new Error('Users and files (array) are required.');
  }

  const missingFiles = [];

  for (const file of files) {
    // Fetch file record from the database
    const fileRecord = await File.findOne({ where: { fileName: file } });
    if (!fileRecord) {
      missingFiles.push(file);
      console.warn(`File not found in database: ${file}`);
      continue;
    }

    // Construct the full path of the file
    const sourceFilePath = Path.join(fileRecord.filePath, file);

    if (!fs.existsSync(sourceFilePath)) {
      missingFiles.push(file);
      console.warn(`File does not exist at source location: ${file}`);
      continue;
    }

    // Iterate through users and copy the file to each user's folder
    for (const username of users) {
      const user = await User.findOne({ where: { username } });
      if (!user || !user.folderPath) {
        console.warn(`User not found or folderPath missing for username: ${username}`);
        continue;
      }

      // Define target file path
      const targetFilePath = Path.join(user.folderPath, file);

      try {
        // Ensure the target directory exists
        fs.mkdirSync(user.folderPath, { recursive: true });

        // Copy the file
        fs.copyFileSync(sourceFilePath, targetFilePath);
      } catch (err) {
        console.error(`Error copying file ${file} to ${username}'s folder:`, err);
      }
    }
  }

  return { missingFiles };
};

module.exports =  sendFilesToUsers;
