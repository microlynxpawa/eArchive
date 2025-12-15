const ArchiveCategory = require("../../model/archiveCategory");

const removeUserGroupLogic = async (deleteRecord) => {
  if (!deleteRecord) throw new Error("Delete id not found");

  await ArchiveCategory.destroy({ where: { id: deleteRecord } });

  return `Record deleted successfully: ${deleteRecord}`;
};

module.exports = removeUserGroupLogic;
