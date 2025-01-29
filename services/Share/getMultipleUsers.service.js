const Sequelize = require("sequelize");
const User = require("../../model/user");

async function fetchUsersByQuery(query) {
  const sequelize = Sequelize;

  if (!query) {
    throw new Error("Query parameter is required.");
  }
  console.log("***************THIS is query "+query);

  // Split the query into individual terms
  const searchTerms = query
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term);

  // Construct a WHERE clause dynamically for multiple terms
  const whereClause = {
    [sequelize.Op.or]: searchTerms.map((term) => ({
      username: {
        [sequelize.Op.like]: `%${term}%`,
      },
    })),
  };

  // Fetch users from the database
  return await User.findAll({
    where: whereClause,
    attributes: ["id", "username", "folderPath"], // Limit the fields returned
  });
}

module.exports = fetchUsersByQuery;
