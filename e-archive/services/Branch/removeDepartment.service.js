const fs = require("fs");
const path = require("path");
const BranchDepartment = require("../../model/branch-department");

async function handleDeleteDepartment({ branchName, departmentName }) {

    if (!branchName || !departmentName) {
        return res.status(400).json({ error: "branchName and departmentName are required." });
      }
  try {
    // Find the record in the database based on branchName and departmentName
    const existingEntry = await BranchDepartment.findOne({
      where: { branchName, departmentName },
    });

    if (!existingEntry) {
      throw new Error(
        `No department found with branchName "${branchName}" and departmentName "${departmentName}".`
      );
    }

    // Get the folder path from the database record
    const { departmentFolderPath } = existingEntry;

    // Check if the folder exists in the file system
    if (fs.existsSync(departmentFolderPath)) {
      // Delete the department folder and its contents recursively
      fs.rmSync(departmentFolderPath, { recursive: true, force: true });
      console.log(`Folder deleted: ${departmentFolderPath}`);
    } else {
      console.warn(`Folder does not exist: ${departmentFolderPath}`);
    }

    // Delete the record from the database
    await existingEntry.destroy();
    console.log(
      `Record deleted for branchName "${branchName}" and departmentName "${departmentName}".`
    );

    return {
      success: true,
      message: `Department "${departmentName}" under branch "${branchName}" successfully deleted.`,
    };
  } catch (error) {
    console.error("Error in handleDeleteDepartment:", error);
    throw error;
  }
}

module.exports = handleDeleteDepartment;
