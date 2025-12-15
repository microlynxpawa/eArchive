const branch = require("../../model/branch");
const { removeDirectory } = require("../../util/directory");

const removeBranchLogic = async (deleteRecord) => {
  if (!deleteRecord) {
    throw new Error("Delete id not found");
  }
  
  // Find the branch by ID
  const isFound = await branch.findOne({ where: { id: deleteRecord } });
  if (!isFound) {
    throw new Error("Record not found");
  }

  // Remove the corresponding directory
  const isRemoved = removeDirectory(isFound.dataValues.name);
  if (!isRemoved) {
    throw new Error("Failed to remove directory");
  }

  // Delete the record from the database
  await branch.destroy({ where: { id: deleteRecord } });

  return "Record deleted successfully";
};

module.exports = removeBranchLogic;
