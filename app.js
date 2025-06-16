const express = require("express");
const dotEnv = require("dotenv");
// configure dotenv
dotEnv.config();
const path = require("path");
const ejsLayout = require("express-ejs-layouts");
const adminRoute = require("./routes/adminRoute.js");
const dbConnect = require("./dbConnect");
const { createDefaultDirectory, importUsers, importAuthorizations, cleanTransformedUsers, hashTransformedUserPasswords, exportUserCredentials } = require("./util/directory");
const session = require("express-session");
const { fileContent } = require("./controllers/adminController.js");
const cron = require("node-cron");
const runCleanupTasks = require("./util/tempFolderCleanUp.js");
const defineAssociations = require("./model/associations.js");
const fs = require("fs");

const DEFAULT_PATH = process.env.FOLDER ;

// Define the default static folder for uploads during upload process
const CleanUp_PATH = path.resolve(
  process.env.Temp_Upload_Folder_Path
);

const { PORT, SECRECT } = process.env;

// Import all models
require("./model/user");
require("./model/branch");
require("./model/archiveCategory");
require("./model/auditLogs");
require("./model/authorizations");
require("./model/branch-department");
require("./model/file");
defineAssociations();

// create express app
const app = express();
app.use(
  session({
    secret: SECRECT,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use('/profile-pictures', express.static(process.env.Profile_Pictures));
app.use(express.static(DEFAULT_PATH));
app.use(express.static(CleanUp_PATH));


app.use(ejsLayout);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Schedule cleanup every day at midnight
cron.schedule("0 0 * * *", () => {
  console.log("Running scheduled cleanup tasks...");
  runCleanupTasks();
});

app.get("/", (req, res) => res.redirect("/admin"));
app.get("/file-content",fileContent);

app.use("/admin", adminRoute);


const startServer = async () => {
   await dbConnect.authenticate();
   dbConnect.sync({ alter: true });
  createDefaultDirectory();
  // cleanTransformedUsers();
  // await hashTransformedUserPasswords();
  // importUsers();
  //  importAuthorizations();
  // exportUserCredentials();
  app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
    // console.log(envPaths);
    
  });
};

startServer();
