const File = require("../../model/file");
const Auths = require("../../model/authorizations");
const User = require("../../model/user");
const ArchiveCategory = require("../../model/archiveCategory");
const Branch = require("../../model/branch");

/**
 * Build folder structure from the File table.
 * filePath is now a relative forward-slash prefix (e.g. "BranchA/DeptB/user1/").
 */
async function buildFolderStructure(_basePath, userId) {
  const user = await User.findOne({
    where: { id: userId },
    include: [
      { model: ArchiveCategory, attributes: ["id", "name"] },
      { model: Branch, attributes: ["id", "name"] },
    ],
  });
  const auth = await Auths.findOne({ where: { userId } });
  if (!user || !auth) throw new Error("User or authorization data not found");

  const userDepartment = user.archive_category ? user.archive_category.name : null;
  const userBranch = user.branch ? user.branch.name : null;

  const files = await File.findAll();
  const structure = {};

  function insertFile(relPath, fileName) {
    const parts = relPath.replace(/\\/g, "/").split("/").filter(Boolean);
    let current = structure;
    for (const part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
    if (!current.files) current.files = [];
    current.files.push(fileName);
  }

  for (const file of files) {
    // Normalise filePath to relative forward-slash
    let relPath = (file.filePath || "").replace(/\\/g, "/");

    // Strip absolute FOLDER prefix if migration hasn't run yet
    const folderEnv = (process.env.FOLDER || "").replace(/\\/g, "/").replace(/\/+$/, "");
    if (folderEnv && relPath.startsWith(folderEnv)) {
      relPath = relPath.slice(folderEnv.length).replace(/^\/+/, "");
    }

    // Extract branch: first path component
    const parts = relPath.split("/").filter(Boolean);
    const fileBranch = parts[0] || null;

    if (auth.canViewBranchFiles) {
      insertFile(relPath, file.fileName);
    } else if (auth.canViewDepartmentFiles) {
      if (file.department === userDepartment && fileBranch === userBranch) {
        insertFile(relPath, file.fileName);
      }
    } else if (auth.canViewOwnFiles) {
      if (file.userId === userId) {
        insertFile(relPath, file.fileName);
      }
    }
  }

  return structure;
}

module.exports = buildFolderStructure;
