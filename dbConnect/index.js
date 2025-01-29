const { Sequelize } = require("sequelize");

// access credential db credentials
const { DBNAME, DBPASS, DBUSER } = process.env;
// creating an instance of the sequelize
const sequelize = new Sequelize(DBNAME, DBUSER, DBPASS, {
  dialect: "mysql",
  host: "localhost",
  logging: (msg) => {
    if (msg.includes("CREATE TABLE") || msg.includes("INSERT")) {
      console.log(msg);
    } else if (msg.includes("Error")) {
      console.error(msg);
    }
  },
});

module.exports = sequelize;
