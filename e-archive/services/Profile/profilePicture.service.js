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
  
  // Copy file to destination (works across drives, unlike renameSync)
  try {
    fs.copyFileSync(file.path, filePath);
    // Delete the temporary file after successful copy
    fs.unlinkSync(file.path);
  } catch (err) {
    throw new Error('Failed to move file: ' + err.message);
  }

  // Return only the filename, not the full path, so it can be accessed via /profile-pictures/{filename}
  return uniqueFilename;
}

module.exports = storeProfilePicture;
