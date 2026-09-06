const File = require("../../model/file");
const { getFileScope, toRelativePath } = require("./fileScope");

/**
 * Build folder structure from the File table.
 * filePath is a relative forward-slash prefix (e.g. "BranchA/DeptB/user1/").
 *
 * Visibility is decided entirely by fileScope, which search also uses, so the
 * tree and search always agree on what a user may see.
 */
async function buildFolderStructure(_basePath, userId) {
  const scope = await getFileScope(userId);

  const files = await File.findAll({ where: scope.where });
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
    if (!scope.matches(file)) continue;
    insertFile(toRelativePath(file.filePath), file.fileName);
  }

  return structure;
}

module.exports = buildFolderStructure;
