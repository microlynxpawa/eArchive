const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Ensure the temporary folder exists
const tempDir = path.join(__dirname, 'eArchiiveUploads/temporary');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: tempDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const uploading = multer({ storage });

module.exports = uploading;
