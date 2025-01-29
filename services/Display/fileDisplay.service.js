const Auths = require("../../model/authorizations");
const User = require("../../model/user");
const path = require("path");
const fs = require("fs");

async function buildFolderStructure(basePath, userId) {
  try {
    const user = await User.findOne({ where: { id: userId } });
    const auth = await Auths.findOne({ where: { userId: userId } });

    if (!user || !auth) {
      throw new Error("User or authorization data not found");
    }

    const folderPath = user.folderPath;
    const folderParts = folderPath.split(path.sep);

    if (folderParts.length < 5) {
      throw new Error("Invalid folderPath structure");
    }

    const [branch, department, userFolder] = [
      folderParts[2],
      folderParts[3],
      folderParts[4],
    ];

    const adminPath = path.join(basePath, branch);
    const supervisorPath = path.join(adminPath, department);
    const userPath = path.join(supervisorPath, userFolder);

    const structure = {};

    if (auth.canViewBranchFiles) {
      structure[branch] = traverse(adminPath);
    } else if (auth.canViewDepartmentFiles) {
      structure[department] = traverse(supervisorPath);
    } else if (auth.canViewOwnFiles) {
      structure[userFolder] = getFiles(userPath);
    }

    return structure;
  } catch (error) {
    console.error("Error building folder structure:", error.message);
    throw error;
  }

  // Helper function to traverse directories recursively
  function traverse(dir) {
    if (!fs.existsSync(dir)) return {};
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const result = {};
    entries.forEach((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        result[entry.name] = traverse(entryPath);
      } else if (entry.isFile()) {
        result.files = result.files || [];
        result.files.push(entry.name);
      }
    });
    return result;
  }

  // Helper function to get files in a directory
  function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((file) => file.name);
  }
}

module.exports = buildFolderStructure;
