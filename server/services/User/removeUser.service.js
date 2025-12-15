const User = require("../../model/user");
const {removeDirectory} = require("../../util/directory")

/**
 * Removes a user record by ID and deletes their associated folder.
 * @param {number} deleteRecord - The ID of the user to be deleted.
 * @returns {Promise<{message: string, statusCode: number}>} - A message and status code.
 */
const deleteUserById = async (deleteRecord) => {
  if (!deleteRecord) {
    throw new Error("Delete ID not found");
  }

  // Fetch the user record
  const userToDelete = await User.findByPk(deleteRecord);
  if (!userToDelete) {
    throw new Error("User not found");
  }

  // Get the folder path
  const folderPath = userToDelete.folderPath;

  // Delete the user record from the database
  await User.destroy({ where: { id: deleteRecord } });

  // Delete the user's folder if the folderPath exists
  if (folderPath) {
    const folderDeleted = removeDirectory(folderPath);
    if (folderDeleted) {
      console.log(`Folder at ${folderPath} deleted successfully.`);
    } else {
      console.log(`Folder at ${folderPath} not found.`);
    }
  }

  return { message: "Record and associated folder deleted successfully", statusCode: 200 };
};

module.exports = deleteUserById;
