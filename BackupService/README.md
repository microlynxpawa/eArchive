# To install
.NET Runtime
MySQL Server (with database and user)
mysqldump.exe (at the path in config) // only in case mysql set up not fully completed
AWS credentials (if using S3)
File system permissions for backup and uploads folders

# BackupService Project Structure Summary

This project uses a layered architecture common in ASP.NET Core applications. Each folder and file has a specific role to help organize code and make the project easier to maintain and understand.

## Key Folders & Files

- **Program.cs**: The starting point of the application. It sets up the web server, configures all the services your app will use (like database connections and external APIs), and launches the app.
- **Controllers/**: These files define the API endpoints (URLs) that users or other apps can call. Controllers receive HTTP requests, process them, and send back responses. They act as the "traffic managers" of your app.
- **Services/**: Services contain the main business logic of your application. They decide what needs to happen when a controller receives a request. Services often use repositories to get or save data.
- **Repositories/**: Repositories are responsible for all interactions with the database or other data sources. They provide methods to read, write, update, or delete data. This keeps data access code separate from business logic.
- **Models/**: Models define the structure of your data. They represent things like database tables, objects sent or received by the API, or other important data formats.
- **Configuration/**: This folder contains classes that help manage settings and environment variables, such as database connection strings or API keys. These settings are usually loaded from files like `appsettings.json`.
- **obj/** & **Properties/**: These are special folders managed by .NET tools. `obj` contains temporary files used during the build process. `Properties` often includes settings for debugging and launching the app.

## Application Flow (How Everything Works Together)

1. **Controllers** receive requests from users or other systems (like a web browser or mobile app). They decide which service should handle the request.
2. **Services** contain the rules and logic for your app. They process the request, often by calling one or more repositories to get or save data.
3. **Repositories** interact with the database or other storage systems to fetch or update data as needed.
4. **Models** are used throughout the app to define what data looks like and to transfer information between layers.
5. **Configuration** classes help the app read important settings from files or environment variables, making it easy to change things like database connections without changing code.
6. **Program.cs** brings everything together: it sets up all the dependencies, configures the app, and starts the web server so your app can handle requests.

This structure helps keep your code organized, makes it easier to test and update, and supports clean separation of concerns. Even if you're new to .NET, following this pattern will help you build reliable and maintainable applications.
