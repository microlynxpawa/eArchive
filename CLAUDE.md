# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

Two components in a monorepo:

- **`client/`** — React 18 + Vite SPA (frontend, port 4500)
- **`e-archive/`** — Node.js/Express backend (API server, port 3000)

## Development Commands

### Backend (`e-archive/`)
```bash
cd e-archive
npm start        # nodemon app.js
npm test         # jest
```

Requires `e-archive/.env` (see `.env.example`). Key variables:
```
PORT=3000
DBNAME=         DBPASS=        DBUSER=
SALT=10
FOLDER=                   # root path for all archive file storage on disk
DEFAULT_FOLDERS=           # comma-separated folder names auto-created per user
SECRECT=                  # JWT/session secret (note: intentional typo — matches code)
Temp_Upload_Folder_Path=  # temporary multer upload staging directory
Profile_Pictures=         # path for stored profile picture files
```

### Frontend (`client/`)
```bash
cd client
npm run dev      # Vite dev server on port 4500
npm run build    # production build → dist/
npm run preview  # serve production build locally
```

## Production Deployment

Backend via PM2:
```bash
pm2 start app.js --name "e-archive"
pm2 startup && pm2 save
```

Frontend — serve the built `dist/` folder:
```bash
pm2 serve dist 4500 --name e-archive-ui --spa
pm2 startup && pm2 save
```

Nginx reverse-proxies port 80 → `127.0.0.1:3000` with WebSocket support.

## Architecture

### Backend Request Flow

All routes are defined in a single file: `e-archive/routes/adminRoute.js`, mounted at `/admin`. Every request passes through four middleware layers in order:

```
routeDectector → rememberMeMiddleware → authUser → getUserPermissions → adminController
```

All handler logic lives in `e-archive/controllers/adminController.js` (monolithic). Business logic is extracted into `e-archive/services/` organized by domain:

| Directory | Responsibility |
|---|---|
| `Auth/` | Sign-in, password update |
| `Upload/` | Single and multiple file upload via multer |
| `Display/` | File tree listing, file content serving |
| `Delete/` | File deletion |
| `Share/` | File sending between users, email delivery, history |
| `User/` | Create/remove users |
| `UserGroup/` | Archive category (group) management |
| `Branch/` | Branch and department CRUD |
| `AccessControl/` | Permission queries, department access |
| `AuditLog/` | Activity recording |
| `Backup/` | Daily backup scheduler (JS-based, runs within Express) |
| `Information/` | Admin messages CRUD |
| `Profile/` | Profile picture upload |

### Database (Sequelize + MySQL)

Models in `e-archive/model/`. Relationships are defined centrally in `associations.js` and called once at startup. Key relationships:
- **User** → belongs to **Branch** and **ArchiveCategory** (user group)
- **BranchDepartment** — join table between Branch and ArchiveCategory (departments are categories scoped to a branch)
- **File**, **AuditLog**, **Authorizations** — cascade delete on User removal
- **FileSendingHistory** — two User FKs: `senderId` (CASCADE) and `receiverId` (SET NULL)

`sequelize.sync({ alter: true })` runs on every startup, auto-applying model changes to the DB schema.

### Frontend API Routing

`client/src/main.jsx` installs a global `fetch` wrapper before mounting React. It routes relative paths to different backends:
- `/admin/*` → `ADMIN_API_URL`
- `/file-content/*` → `FILE_CONTENT_API_URL`
- everything else → `VITE_API_URL`

Config is loaded at runtime from `public/config.json` (editable in production without a rebuild), falling back to Vite build-time env vars (`VITE_API_URL`, `VITE_ADMIN_API_URL`, `VITE_FILE_CONTENT_API_URL`). All frontend `fetch` calls use relative paths (e.g. `/admin/sign-in`).

### File Storage

Files are stored on disk, not in the database. `FOLDER` env var sets the root. Each user gets a subdirectory auto-created on account creation. `e-archive/util/directory.js` handles all filesystem operations (directory creation, folder traversal, user data import/export).

Temporary multer uploads stage in `Temp_Upload_Folder_Path` and are purged nightly by a `node-cron` job (`0 0 * * *`) in `app.js`.

### Authentication

Session-based (24h cookie). `rememberMeMiddleware` supports persistent login tokens. `authUser` middleware validates the session; `getUserPermissions` fetches and attaches per-user permission flags used throughout the controller.
