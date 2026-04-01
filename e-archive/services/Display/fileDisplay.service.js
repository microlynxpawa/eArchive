
const File = require("../../model/file");
const Auths = require("../../model/authorizations");
const User = require("../../model/user");
const ArchiveCategory = require("../../model/archiveCategory");
const Branch = require("../../model/branch");

/**
 * Always build folder structure from the database (File table).
 * @param {string} basePath - Not used, kept for compatibility.
 * @param {number} userId
 * @returns {Promise<object>} Folder structure object
 */
async function buildFolderStructure(_basePath, userId) {
  // Get user and their permissions, including userGroup (department) and branch info
  const user = await User.findOne({ 
    where: { id: userId },
    include: [
      { model: ArchiveCategory, attributes: ['id', 'name'] },
      { model: Branch, attributes: ['id', 'name'] }
    ]
  });
  const auth = await Auths.findOne({ where: { userId: userId } });
  if (!user || !auth) throw new Error("User or authorization data not found");
  
  // Get user department and branch
  const userDepartment = user.archive_category ? user.archive_category.name : null;
  const userBranch = user.branch ? user.branch.name : null;
  const userBranchId = user.branchId;

  // Fetch all files from DB
  const files = await File.findAll();
  const structure = {};

  // Helper to insert file into nested structure
  function insertFile(relPath, fileName) {
    const parts = relPath.split(/\\|\//).filter(Boolean);
    let current = structure;
    for (const part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
    if (!current.files) current.files = [];
    current.files.push(fileName);
  }

  
  // Build structure based on permissions
  let filesInserted = 0;
  for (const file of files) {
    // Extract branch name from file path
    // Path format: C:\e-archiveUploads\[BRANCH]\[DEPARTMENT]\...
    // The branch is the first folder after e-archiveUploads
    let fileBranch = null;
    const pathMatch = file.filePath.match(/e-archiveUploads[\\\/]([^\\\/]+)/);
    if (pathMatch && pathMatch[1]) {
      fileBranch = pathMatch[1];
    }

    // Remove base path from filePath for structure building
    let relPath = file.filePath;
    if (relPath.startsWith(process.env.FOLDER)) {
      relPath = relPath.replace(process.env.FOLDER, '').replace(/^\\|\//, '');
    }

    // Only include files user is allowed to see
    if (auth.canViewBranchFiles) {
      // Branch-level: show all files
      insertFile(relPath, file.fileName);
      filesInserted++;
    } else if (auth.canViewDepartmentFiles) {
      // Department-level: only files in user's department AND user's branch
      if (file.department === userDepartment && fileBranch === userBranch) {
        insertFile(relPath, file.fileName);
        filesInserted++;
      }
    } else if (auth.canViewOwnFiles) {
      // User-level: only files owned by user
      if (file.userId === userId) {
        insertFile(relPath, file.fileName);
        filesInserted++;
      }
    }
  }
  return structure;
}

module.exports = buildFolderStructure;
