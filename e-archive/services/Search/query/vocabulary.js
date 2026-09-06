const Branch = require("../../../model/branch");
const ArchiveCategory = require("../../../model/archiveCategory");
const User = require("../../../model/user");

/**
 * The words the parser is allowed to recognise as branches, departments and
 * people: the real values from the database, not a hardcoded list.
 *
 * Cached briefly because it is read on every search and changes rarely. It is
 * also handed to the LLM parser later, so the model can only ever return names
 * that actually exist.
 */

const TTL_MS = 5 * 60 * 1000;
let cache = null;
let loadedAt = 0;

async function getVocabulary({ force = false } = {}) {
  if (!force && cache && Date.now() - loadedAt < TTL_MS) return cache;

  const [branches, departments, users] = await Promise.all([
    Branch.findAll({ attributes: ["id", "name"] }),
    ArchiveCategory.findAll({ attributes: ["id", "name"] }),
    User.findAll({ attributes: ["id", "username", "fullname"] }),
  ]);

  cache = {
    branches: branches.map((b) => ({ id: b.id, name: b.name })).filter((b) => b.name),
    departments: departments.map((d) => ({ id: d.id, name: d.name })).filter((d) => d.name),
    users: users.map((u) => ({
      id: u.id,
      username: u.username || "",
      fullname: u.fullname || "",
    })),
  };
  loadedAt = Date.now();
  return cache;
}

function invalidateVocabulary() {
  cache = null;
  loadedAt = 0;
}

module.exports = { getVocabulary, invalidateVocabulary };
