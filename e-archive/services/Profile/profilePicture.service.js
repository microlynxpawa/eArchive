const path = require("path");
const { getProvider } = require("../../storage/storageProvider");

async function storeProfilePicture(userId, file) {
  if (!userId) throw new Error("Invalid user information.");
  if (!file) throw new Error("No file uploaded.");

  const timestamp = Date.now();
  const ext = path.extname(file.originalname);
  const uniqueFilename = `${userId}_${timestamp}${ext}`;

  // Always store under the profile-pictures/ prefix (cloud-key format)
  const cloudKey = `profile-pictures/${uniqueFilename}`;

  const provider = await getProvider();
  await provider.upload(file.buffer, cloudKey, file.mimetype);

  return cloudKey;
}

module.exports = storeProfilePicture;
