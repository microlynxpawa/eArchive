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
const cors = require('cors');
const { fileContent } = require("./controllers/adminController.js");
const cron = require("node-cron");
const runCleanupTasks = require("./util/tempFolderCleanUp.js");
const defineAssociations = require("./model/associations.js");
const fs = require("fs");

const logger = require("./logger"); // <-- Add this line to initialize logger and patch console.error

// Start daily backup scheduler (runs backup immediately and then every 24 hours)
require("./services/Backup/backupScheduler.js");

const DEFAULT_PATH = process.env.FOLDER ;

// Define the default static folder for uploads during upload process
const CleanUp_PATH = path.resolve(
  process.env.Temp_Upload_Folder_Path
);

const { PORT, SECRET } = process.env;

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
    secret: SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// Simple CORS + preflight handling to allow the React dev server to make requests with credentials
const CLIENT_ORIGINS = [
  'http://localhost:4500',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow localhost:4500 or any origin from port 4500 (for network access via IP)
  if (origin && (CLIENT_ORIGINS.includes(origin) || origin.match(/^http:\/\/[\d.]+:4500$/))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));

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

// COMMENTED OUT: API-only server - no redirects
// app.get("/", (req, res) => res.redirect("/admin"));
// app.get("/file-content",fileContent); // Moved to /admin/file-content in adminRoute

app.use("/admin", adminRoute);


const startServer = async () => {
   await dbConnect.authenticate();
  try {
    await dbConnect.sync({ alter: true });
  } catch (err) {
    console.error('[DB Sync] Failed to sync database (server will still start):', err.message);
  }
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
