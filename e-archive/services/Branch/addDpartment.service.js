const fs = require("fs");
const path = require("path");
const BranchDepartment = require("../../model/branch-department");
const DEFAULT_PATH = process.env.FOLDER || "C:\\e-archiveUploads";

async function handleAddDepartment({ branchName, departmentName, branchId, departmentId }) {
  try {
// Branch folder path
const branchFolderPath = path.join(DEFAULT_PATH, branchName);

// Department folder path
const departmentFolderPath = path.join(branchFolderPath, departmentName);

// Ensure the branch folder exists
if (!fs.existsSync(branchFolderPath)) {
  fs.mkdirSync(branchFolderPath, { recursive: true });
}

// Ensure the department folder exists within the branch folder
if (!fs.existsSync(departmentFolderPath)) {
  fs.mkdirSync(departmentFolderPath, { recursive: true });
}

    // Check if a record with the same branchName and departmentName exists
    let existingEntry = await BranchDepartment.findOne({
      where: { branchName, departmentName },
    });

    let newEntry;
    if (existingEntry) {
      // Update the existing record
      existingEntry.branchId = branchId;
      existingEntry.departmentId = departmentId;
      existingEntry.departmentFolderPath = departmentFolderPath;
      await existingEntry.save();
      newEntry = existingEntry;
    } else {
      // Create a new record
      newEntry = await BranchDepartment.create({
        branchName,
        departmentName,
        branchId,
        departmentId,
        departmentFolderPath,
      });
    }

    return newEntry; // Return the newly created or updated entry
  } catch (error) {
    console.error("Error in handleAddDepartment:", error);
    throw error;
  }
}

module.exports = handleAddDepartment;
