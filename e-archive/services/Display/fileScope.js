const { Op } = require("sequelize");
const Auths = require("../../model/authorizations");
const User = require("../../model/user");
const ArchiveCategory = require("../../model/archiveCategory");
const Branch = require("../../model/branch");

/**
 * Who is allowed to see which files.
 *
 * This is the single source of truth for file visibility. The folder tree and
 * search both use it, so the two can never drift apart and search can never
 * surface a file the user could not already open.
 *
 * Three tiers:
 *   canViewBranchFiles      -> every file in the system
 *   canViewDepartmentFiles  -> their department, within their own branch
 *   canViewOwnFiles         -> only files they uploaded
 *   none of the above       -> nothing
 *
 * Scoping happens in two parts, and callers need both:
 *
 *   where   a Sequelize clause that narrows the query before it runs
 *   matches a predicate applied to each row afterwards
 *
 * The split exists because a file's branch is not a column: it is the first
 * segment of filePath. The department tier is therefore filtered coarsely in
 * SQL and refined in JS, which is exactly what buildFolderStructure has always
 * done. Using `where` alone would return another branch's files.
 */

/** Relative, forward-slash form of a stored path, minus any absolute FOLDER prefix. */
function toRelativePath(filePath) {
  let relPath = (filePath || "").replace(/\\/g, "/");
  const folderEnv = (process.env.FOLDER || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (folderEnv && relPath.startsWith(folderEnv)) {
    relPath = relPath.slice(folderEnv.length).replace(/^\/+/, "");
  }
  return relPath;
}

/** The branch a file belongs to: the first segment of its relative path. */
function branchOfPath(filePath) {
  const parts = toRelativePath(filePath).split("/").filter(Boolean);
  return parts[0] || null;
}

async function getFileScope(userId) {
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

  // Narrow the query before it runs. Loading every file for a regular user
  // becomes very expensive as the archive grows.
  //
  // The department tier also narrows by branch here, not only in `matches`.
  // That is what lets callers COUNT in SQL instead of pulling rows back to
  // filter them. `matches` still has the final say, so a stored path that does
  // not fit the expected shape is excluded rather than leaked.
  const where = {};
  if (!auth.canViewBranchFiles && auth.canViewDepartmentFiles) {
    where.department = userDepartment;
    if (userBranch) where.filePath = { [Op.like]: `${userBranch}/%` };
  } else if (!auth.canViewBranchFiles && !auth.canViewDepartmentFiles && auth.canViewOwnFiles) {
    where.userId = user.id;
  } else if (!auth.canViewBranchFiles && !auth.canViewDepartmentFiles && !auth.canViewOwnFiles) {
    // No visibility at all. Make it impossible for a query to return anything.
    where.id = null;
  }

  // Final say on any individual row.
  const matches = (file) => {
    if (auth.canViewBranchFiles) return true;
    if (auth.canViewDepartmentFiles) {
      return file.department === userDepartment && branchOfPath(file.filePath) === userBranch;
    }
    if (auth.canViewOwnFiles) {
      return Number(file.userId) === Number(user.id);
    }
    return false;
  };

  return {
    user,
    auth,
    userBranch,
    userDepartment,
    where,
    matches,
    /** Which tier applied, for logging and for the UI to explain the result set. */
    tier: auth.canViewBranchFiles
      ? "all"
      : auth.canViewDepartmentFiles
        ? "department"
        : auth.canViewOwnFiles
          ? "own"
          : "none",
  };
}

module.exports = { getFileScope, toRelativePath, branchOfPath };
