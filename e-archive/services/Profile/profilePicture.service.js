const path = require('path');
const fs = require('fs');

async function storeProfilePicture(userId, file) {
  if (!userId) {
    throw new Error('Invalid user information.');
  }
  if (!file) {
    throw new Error('No file uploaded.');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const ext = path.extname(file.originalname);
  const uniqueFilename = `${userId}_${timestamp}${ext}`;

  // Define file path
  const uploadDir = 'C:\\e-archiveUploads\\profile-pictures';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filePath = path.join(uploadDir, uniqueFilename);
  // const filePath = `profile-pictures/${uniqueFilename}`;
  // Move file to destination
  try {
    fs.renameSync(file.path, filePath);
  } catch (err) {
    throw new Error('Failed to move file: ' + err.message);
  }

  return filePath;
}

module.exports = storeProfilePicture;
