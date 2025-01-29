// Service File: services/fileService.js
const fs = require("fs");
const Path = require("path");
const ArchiveCategory = require("../../model/archiveCategory");
const branch = require("../../model/branch");
const User = require("../../model/user");
const File = require("../../model/file");
const {
  ensureDirectoryExists,
  ensureUniqueFileName,
} = require("../../util/directory");

const uploadFileLogic = async (file, fileName, userId, askQuestion) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  // Fetch the user with associated branch and category
  const user = await User.findOne({
    where: { id: userId },
    include: [
      { model: branch, attributes: ["name"] },
      { model: ArchiveCategory, attributes: ["name"] },
    ],
  });

  if (!user) {
    throw new Error("User not found");
  }

  let folderPath = user.folderPath;

  if (!folderPath) {
    const userAnswer = await askQuestion(
      "No suited folder for this file exists! Do you want to create one? Y/N"
    );

    if (["y", "yes"].includes(userAnswer.toLowerCase())) {
      // Create a new folder path
      folderPath = Path.join(
        DEFAULT_PATH,
        user.branch.dataValues.name,
        user.archive_category.dataValues.name,
        user.username
      );

      // Update the user's folderPath in the database
      await user.update({ folderPath: folderPath });

      // Ensure the directory exists and save the file
      saveFileLogic(file, folderPath, fileName, user);
    } else if (["n", "no"].includes(userAnswer.toLowerCase())) {
      throw new Error("Upload canceled by user");
    } else {
      throw new Error("Invalid input");
    }
  } else {
    // If folderPath already exists, save the file directly
    saveFileLogic(file, folderPath, fileName, user);
  }

  return {
    message: "File uploaded successfully",
    path: folderPath,
  };
};

const saveFileLogic = (file, folderPath, fileName, user) => {
  ensureDirectoryExists(folderPath);
  const uniqueFilename = ensureUniqueFileName(fileName);
  const destinationPath = Path.join(folderPath, uniqueFilename);
  fs.copyFileSync(file.path, destinationPath);

  const fileData = {
    userId: user.id,
    fileName: uniqueFilename,
    filePath: folderPath,
    department: user.archive_category.dataValues.name,
    branchName: user.branch.dataValues.name,
  };

  File.create(fileData);
};

module.exports = uploadFileLogic;
