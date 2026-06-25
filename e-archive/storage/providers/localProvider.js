const fs = require("fs");
const path = require("path");

const FOLDER = process.env.FOLDER || "C:\\e-archiveUploads";

function absPath(cloudKey) {
  return path.join(FOLDER, cloudKey);
}

function ensureDir(absFilePath) {
  const dir = path.dirname(absFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const localProvider = {
  type: "local",

  async upload(buffer, cloudKey, _mimeType) {
    const dest = absPath(cloudKey);
    ensureDir(dest);
    fs.writeFileSync(dest, buffer);
  },

  async download(cloudKey) {
    return fs.readFileSync(absPath(cloudKey));
  },

  async delete(cloudKey) {
    const fp = absPath(cloudKey);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  },

  async copy(sourceKey, destKey) {
    const src = absPath(sourceKey);
    const dest = absPath(destKey);
    ensureDir(dest);
    fs.copyFileSync(src, dest);
  },

  async exists(cloudKey) {
    return fs.existsSync(absPath(cloudKey));
  },

  getReadStream(cloudKey) {
    return fs.createReadStream(absPath(cloudKey));
  },

  async getSignedUrl(cloudKey) {
    // Local files don't need signed URLs; return a path hint (not used directly)
    return null;
  },
};

module.exports = localProvider;
