The logic behing the bach up service is:
1- The company does not always use javascript so this service in .NET allows easy management of the app data and database in case an update is need

2- Since I am the only dev in the project, making code updates to increase speed and performances take time and running more services in the express js server would have increase the current latency while I am working on decreasing it in the express js server

3- backup folders get biggger over time so the backup service would take more time everyday if it is on the same server instance as the main app the users will experience extreme latency when the data gets to a certain amount.

The Back Up service connects to the db and strores the whole application state "eArchive mysql DataBase and eArchive Uploads Folder 'C:\e-archiveUploads' " under "C:\e-archive-back-up-data\<date>-bcp\" with a file\folder of the MySql database back up and the e-archiveUploads folder.


<!-- Commands -->
npm start
dotnet BackupService.dll


# Hosting
Install pm2 following instructions in e-archive readme 

Add BackupService to IIS 
verify backup service running with :
netstat -an | find "5000"
or
netstat -ano | findstr :5080
or
curl http://localhost:5080

