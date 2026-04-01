const ArchiveCategory = require("../../model/archiveCategory");

const removeUserGroupLogic = async (deleteRecord) => {
  console.log('[removeUserGroupLogic] Called with deleteRecord:', deleteRecord);
  try {
    if (!deleteRecord) throw new Error("Delete id not found");

    const result = await ArchiveCategory.destroy({ where: { id: deleteRecord } });
    console.log(`[removeUserGroupLogic] Destroy result for id ${deleteRecord}:`, result);

    return `Record deleted successfully: ${deleteRecord}`;
  } catch (error) {
    console.error('[removeUserGroupLogic] Error:', error);
    throw error;
  }
};

module.exports = removeUserGroupLogic;
