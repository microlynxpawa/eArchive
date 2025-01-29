const Department = require("../../model/archiveCategory");

/**
 * Fetch a branch by name.
 * @param {string} branchName - The name of the branch to search for.
 * @returns {Promise<Object>} - Branch data as a plain object.
 * @throws Will throw an error if the branch is not found or if a database error occurs.
 */
const getDepartmentByName = async (departmentName) => {
  if (!departmentName) {
    throw new Error("Department name is required.");
  }
  
  const department = await Department.findOne({ where: { name: departmentName }, raw: true });

  if (!department) {
    throw new Error("Department not found.");
  }
  
  return department;
};

module.exports = getDepartmentByName;
