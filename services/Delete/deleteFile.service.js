const fs = require('fs');
const Path = require('path');
const File = require('../../model/file');

// Service Function to Delete Files
const deleteFiles = async (files) => {
  if (!files || !Array.isArray(files)) {
    throw new Error('Files (array) are required.');
  }

  const deletedFiles = [];
  const missingFiles = [];
  const errors = [];

  for (const file of files) {
    try {
      // Fetch file record from the database
      const fileRecord = await File.findOne({ where: { fileName: file } });

      if (!fileRecord) {
        missingFiles.push(file);
        console.warn(`File not found in database: ${file}`);
        continue;
      }

      // Construct the full path of the file
      const filePath = Path.join(fileRecord.filePath, file);

      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
        console.warn(`File does not exist at path: ${file}`);
        continue;
      }

      // Delete the file from the filesystem
      fs.unlinkSync(filePath);

      // Delete the file record from the database
      await File.destroy({ where: { fileName: file } });

      deletedFiles.push(file);
    } catch (err) {
      console.error(`Error deleting file ${file}:`, err);
      errors.push({ file, error: err.message });
    }
  }

  return { deletedFiles, missingFiles, errors };
};

module.exports = deleteFiles;
