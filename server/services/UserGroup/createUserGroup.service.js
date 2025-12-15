const ArchiveCategory = require("../../model/archiveCategory");

const createOrUpdateUserGroup = async (data) => {
  const { catName, catDescription, btnAction, updateRecord } = data;

  if (!catName || !catDescription || !btnAction) {
    throw new Error("All fields are required");
  }

  if (btnAction === "Create") {
    // Create a new user group
    await ArchiveCategory.create({
      name: catName,
      description: catDescription,
      created_by: "joel",
    });
    return { message: "User group created", statusCode: 200 };
  } else {
    // Update existing user group
    const isFound = await ArchiveCategory.findOne({
      where: { id: updateRecord },
    });
    if (!isFound) {
      throw new Error("Record not found");
    }

    await ArchiveCategory.update(
      { name: catName, description: catDescription, created_by: "joel" },
      { where: { id: updateRecord } }
    );

    return { message: "User group updated", statusCode: 200 };
  }
};

module.exports = createOrUpdateUserGroup;
