const multer = require("multer");

// Always use memory storage so services can hand off the buffer
// to the active storage provider (local or S3).
function getUploadMiddleware() {
  return multer({ storage: multer.memoryStorage() });
}

module.exports = { getUploadMiddleware };
