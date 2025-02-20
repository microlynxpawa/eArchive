const fs = require('fs');
const Path = require('path');
const File = require('../../model/file');
const AuditLog = require('../../model/auditLogs')

// Service Function to Delete Files
const deleteFiles = async (files, userId) => {
  if (!files || !Array.isArray(files)) {
    throw new Error('Files (array) are required.');
  }

  const deletedFiles = [];
  const missingFiles = [];
  const errors = [];

  for (const fileName of files) {
    try {
      // Fetch file record from the database
      const fileRecord = await File.findOne({ where: { fileName } });
      if (!fileRecord) {
        missingFiles.push(fileName);
        console.warn(`File not found in database: ${fileName}`);
        continue;
      }

      // Construct the full path of the file
      const filePath = Path.join(fileRecord.filePath, fileName);

      if (!fs.existsSync(filePath)) {
        missingFiles.push(fileName);
        console.warn(`File does not exist at path: ${filePath}`);
        continue;
      }

      // Delete the file from the filesystem
      fs.unlinkSync(filePath);

      // Update audit log  
      const userLogs = await AuditLog.findOne({
        where: { userId: userId },
        order: [['createdAt', 'DESC']] // Ensures the latest record is selected
      });
      await userLogs.update({deleted : true});

      // Delete the file record from the database
      await File.destroy({ where: { fileName } });

      deletedFiles.push(fileName);
    } catch (err) {
      console.error(`Error deleting file ${fileName}:`, err);
      errors.push({ file: fileName, error: err.message });
    }
  }

  return { deletedFiles, missingFiles, errors };
};

module.exports = deleteFiles;