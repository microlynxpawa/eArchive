const fs = require("fs");
const Path = require("path");
const User = require("../../model/user");
const File = require("../../model/file");

// Service Function to Send Files by Email
const sendFilesViaEmail = async (emails, files) => {
  if (!emails || !files || !Array.isArray(files)) {
    throw new Error("Emails and files (array) are required.");
  }

  const missingFiles = [];
  console.log(`Processing files: ${JSON.stringify(files)}`);
  console.log(`Processing emails: ${JSON.stringify(emails)}`);

  for (const file of files) {
    console.log(`Starting processing for file: ${file}`);

    // Fetch file record from the database
    const fileRecord = await File.findOne({ where: { fileName: file } });
    if (!fileRecord) {
      missingFiles.push(file);
      console.warn(`File not found in database: ${file}`);
      continue;
    }

    // Construct the full path of the file
    const sourceFilePath = Path.join(fileRecord.filePath, file);
    console.log(`Source file path for ${file}: ${sourceFilePath}`);

    if (!fs.existsSync(sourceFilePath)) {
      missingFiles.push(file);
      console.warn(`File does not exist at source location: ${file}`);
      continue;
    }

    // Iterate through emails and copy the file to each user's folder
    for (const email of emails) {
      console.log(`Processing email: ${email}`);

      const user = await User.findOne({ where: { email } });
      if (!user) {
        console.warn(`User not found for email: ${email}`);
        continue;
      }

      if (!user.folderPath) {
        console.warn(`folderPath is missing for user with email: ${email}`);
        continue;
      }

      // Define target file path
      const targetFilePath = Path.join(user.folderPath, file);
      console.log(`Target file path for ${email}: ${targetFilePath}`);

      try {
        // Ensure the target directory exists
        fs.mkdirSync(user.folderPath, { recursive: true });

        // Copy the file
        fs.copyFileSync(sourceFilePath, targetFilePath);
        console.log(`Successfully copied file: ${file} to ${email}'s folder.`);
      } catch (err) {
        console.error(
          `Error copying file ${file} to ${email}'s folder:`,
          err
        );
      }
    }
  }

  if (missingFiles.length > 0) {
    console.warn(`The following files were missing or not processed: ${JSON.stringify(missingFiles)}`);
  } else {
    console.log("All files processed successfully.");
  }

  return { missingFiles };
};

module.exports = sendFilesViaEmail;
