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

  for (const filePath of files) {
    try {
      // Extract fileName from the path
      const fileName = Path.basename(filePath);
      // Fetch file record from the database
      const fileRecord = await File.findOne({ where: { fileName } });

      // Always attempt to delete the file from the filesystem if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedFiles.push(filePath);
      } else {
        missingFiles.push(filePath);
        console.warn(`File does not exist at path: ${filePath}`);
      }

      // If a DB record exists, delete it
      if (fileRecord) {
        // Update audit log  
        const userLogs = await AuditLog.findOne({
          where: { userId: userId },
          order: [['createdAt', 'DESC']]
        });
        if (userLogs) await userLogs.update({deleted : true});
        await File.destroy({ where: { fileName } });
      }
    } catch (err) {
      console.error(`Error deleting file ${filePath}:`, err);
      errors.push({ file: filePath, error: err.message });
    }
  }

  return { deletedFiles, missingFiles, errors };
};

module.exports = deleteFiles;