const Sequelize = require("sequelize");
const User = require("../../model/user");

async function fetchUsersByEmail(query) {
  const sequelize = Sequelize;

  if (!query || typeof query !== "string") {
  console.log("Received query******************:", query);

    throw new Error("Query parameter must be a non-empty string.");
    
  }


  const searchTerms = query
    .split(" ")
    .map(term => term.trim())
    .filter(term => term);

  const whereClause = {
    [sequelize.Op.or]: searchTerms.map(term => ({
      email: {
        [sequelize.Op.like]: `%${term}%`,
      },
    })),
  };

  return await User.findAll({
    where: whereClause,
    attributes: ["id", "email", "folderPath"],
  });
}

module.exports = fetchUsersByEmail;
