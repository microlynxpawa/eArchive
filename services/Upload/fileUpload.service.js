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

const DEFAULT_PATH = process.env.FOLDER || "C:\\e-archiveUploads";

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
    // Create a new folder path
    folderPath = Path.join(
      DEFAULT_PATH,
      user.branch.dataValues.name,
      user.archive_category.dataValues.name,
      user.username
    );
  
    // Ensure the directory exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  
    // Update the user's folderPath in the database
    await user.update({ folderPath: folderPath });
  
    console.log("Folder created successfully:", folderPath);
  }
  
  // If folderPath already exists or has been created, save the file directly
  saveFileLogic(file, folderPath, fileName, user);

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
