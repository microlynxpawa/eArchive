# e-Archive Client - AI Agent Instructions

## Project Context: EJS → React UI Migration

**CRITICAL**: This project is **rebuilding the exact same user interface** from the existing EJS/Express application (`w:\Mycrolynxe\e-archive\e-archive`) into a modern React SPA. We are NOT building new features — we are recreating pixel-perfect parity with the original UI.

### Source of Truth
- **Original EJS Templates**: `w:\Mycrolynxe\e-archive\e-archive\views\dashboard\pages\*.ejs`
- **Backend API**: Same Express server (unchanged routes/controllers in `e-archive\routes` and `e-archive\controllers`)
- **Goal**: React components that render the same HTML structure, use the same CSS classes, and call the same endpoints as the EJS views

### Migration Status
- ✅ **Completed**: Auth (login), Layout (header/sidebar/footer), Dashboard, Gallery (core structure)
- 🚧 **In Progress**: Gallery folder interactions, batch rendering, search/filter
- ❌ **Pending**: FileUpload, UserManagement, Departments, Branches, AuditTrail (need full EJS → React conversion)

## Project Architecture

This is a **Vite + React SPA client** that replaces server-rendered EJS views while preserving the existing backend API, vendor assets, and business logic.

### Key Design Decisions

- **Exact UI Replication**: When converting an EJS page, inspect the original template in `e-archive\views\dashboard\pages\*.ejs` to match HTML structure, CSS classes, data attributes, and DOM IDs exactly
- **Hybrid Asset Strategy**: Reuses legacy vendor assets from `/public/assets` (Bootstrap, Feather icons, custom theme CSS) instead of npm packages to maintain visual parity with the original EJS templates
- **Imperative-then-Refactor Pattern**: Complex pages like `Gallery.jsx` initially port EJS DOM manipulation imperatively (for speed/parity), then refactor to React components incrementally
- **Same Backend API**: All endpoints, controllers, services, and database models remain in the EJS project (`e-archive\routes`, `e-archive\controllers`, `e-archive\services`) — React client consumes existing JSON endpoints
- **Session-Based Auth**: Backend uses `express-session` with credentials; all API calls require `fetch(..., { credentials: 'include' })`
- **Dual-Server Dev Setup**: Vite dev server on `:5173`, Express API on `:4801` (configured in CORS on backend)

## Critical Workflows

### EJS → React Conversion Process
**When converting a new page:**
1. **Locate EJS source**: Find template in `e-archive\views\dashboard\pages\<page-name>.ejs`
2. **Identify data flow**: Check route in `e-archive\routes\adminRoute.js` → controller in `e-archive\controllers\adminController.js` → service in `e-archive\services\*`
3. **Extract static HTML**: Copy HTML structure, preserve all CSS classes, IDs, data attributes
4. **Convert EJS logic to React**: Replace `<% ... %>` loops/conditionals with JSX `.map()`, ternaries, etc.
5. **Replace inline scripts**: Convert `<script>` blocks to React `useEffect()` hooks
6. **Fetch data from API**: Use `fetch()` with credentials to call existing endpoints (prefer JSON endpoints or create new ones that return JSON instead of rendering EJS)
7. **Test parity**: Compare side-by-side with original EJS page in browser (layout, interactions, data display)

### Development Commands
```powershell
# Client (run from w:\Mycrolynxe\e-archive\client)
npm run dev        # Vite dev server → http://localhost:5173

# Backend (run from w:\Mycrolynxe\e-archive\e-archive)
npm start          # Express server → http://localhost:4801
# or for production:
pm2 start app.js --name "e-archive"
```

### Authentication Flow
1. Login at `/` (Auth.jsx) → POST to `http://localhost:4801/admin/sign-in` with credentials
2. Backend sets session cookie (credentials must be included in fetch)
3. Layout.jsx checks auth via GET `/admin/check-auth` on mount
4. Unauthenticated users redirected to `/` (login)
5. Logout via GET `/admin/logout` (clears session)

**Critical**: Backend `authMiddleware.js` detects XHR/API requests and returns JSON 401 instead of HTML redirect, allowing SPA to handle navigation.

## API Conventions

### Endpoint Pattern
All admin routes prefixed `/admin/*`:
- `/admin/sign-in` - POST login
- `/admin/check-auth` - GET auth probe
- `/admin/dashboard-data` - GET user + messages
- `/admin/file-structure` - GET folder tree (returns `{ fileStructure: {...} }`)
- `/admin/sendFilesToUsers` - POST send files
- `/admin/delete-file` - DELETE files
- `/file-content?fileName=...` - GET file preview

### Fetch Boilerplate
```javascript
const res = await fetch('http://localhost:4801/admin/endpoint', {
  credentials: 'include',  // REQUIRED for session cookies
  headers: { 
    'Accept': 'application/json',
    'Content-Type': 'application/json'  // for POST/PUT
  },
  method: 'GET' | 'POST' | 'DELETE',
  body: JSON.stringify(data) // if POST/PUT
})
```

## Component Patterns

### EJS Template Reference Examples
- **Gallery**: `e-archive\views\dashboard\pages\see-file.ejs` → `client\src\pages\Gallery.jsx`
- **Dashboard**: `e-archive\views\dashboard\pages\index.ejs` → `client\src\pages\dashboard.jsx`
- **File Upload**: `e-archive\views\dashboard\pages\file-upload.ejs` → `client\src\pages\FileUpload.jsx` *(pending)*
- **User Management**: `e-archive\views\dashboard\pages\user-management.ejs` → `client\src\pages\UserManagement.jsx` *(pending)*
- **Audit Trail**: `e-archive\views\dashboard\pages\audit-log.ejs` → `client\src\pages\AuditTrail.jsx` *(pending)*

### Layout Structure
- `App.jsx`: Routes (`/` for auth, `/admin/*` for authenticated pages)
- `Layout.jsx`: Authenticated wrapper → checks auth, renders PageHeader + Sidebar + Footer + modals
- Pages: `Dashboard`, `Gallery`, `FileUpload`, `AuditTrail`, `UserManagement`, `Departments`, `Branches`

### Vendor Script Loading
**Critical Pattern**: Vendor scripts (jQuery, Bootstrap, sidebar-menu.js) loaded via `<script defer>` in `index.html`. Guard usage in components:
```javascript
const $ = window.$ || window.jQuery
if ($) {
  // jQuery-dependent code
} else {
  // Native fallback
}
```

**Why**: Original EJS templates use jQuery/Bootstrap plugins. We preserve these dependencies to avoid rewriting complex UI interactions (datatables, modals, notifications).

### Gallery.jsx Special Handling
**Original EJS**: `e-archive\views\dashboard\pages\see-file.ejs` (500+ lines of inline JavaScript)

- **File Structure Shape**: Server returns nested object with `{ files: [...] }` arrays for leaf folders, and nested objects for folders. Empty folders are `{}` or `{ files: [] }`.
- **Batch Grouping**: Files grouped by batch name (extracted via regex `/@([^@_\-\.]+)[_\-\./]`) and rendered as collapsible sub-folders.
- **Date Sorting**: Files sorted descending by embedded date (`\d{1,2}-\d{1,2}-\d{4}` pattern).
- **Event Handlers**: Direct `addEventListener` on dynamically created folder buttons (avoiding jQuery delegation issues). Each folder button toggles its `.sub-items` sibling.
- **"Show all folders" Link**: Single handler on `#reveal-all-folders` toggles all `.sub-items` display and updates link text.
- **Ported Features**: Pick & send, delete, preview, search by date, folder expand/collapse, batch grouping
- **Pending**: React component refactor (currently imperative DOM manipulation for parity)

## Project-Specific Conventions

### File Paths
- **Upload Path on Server**: `C:\e-archiveUploads` (backend env var `FOLDER`)
- **Folder Structure**: `Admin/{branch}/{department}/{username}/` hierarchy
- **File Item Path Attribute**: `data-fullpath="C:\\e-archiveUploads\\{parentKey}\\{fileName}"` (used for send/delete operations)

### CSS & Styling
- **Theme Variables**: Use CSS custom properties for dark-mode support:
  - `--gallery-bg`, `--gallery-text`, `--link-color`, `--panel-border`
  - Dark mode: `.dark`, `[data-theme='dark']`, `body.dark` selectors
- **Vendor Classes**: Preserve existing Bootstrap/theme classes (`.page-wrapper`, `.compact-wrapper`, `.box-shadow`, `.btn-primary`, etc.)

### State Management
- **No Redux/Context**: Simple component state + fetch on mount
- **Window globals**: `window.fileStructure` used for debugging/fallback in Gallery
- **Session state**: Managed server-side; client only stores nothing

## Integration Points

### Backend Dependencies
- **Models**: User, File, BranchDepartment, AuditLog, AdminActions, Authorization (Sequelize)
- **Services**: 
  - `services/Display/fileDisplay.service.js` → `buildFolderStructure(basePath, userId)`
  - `services/Display/fileContent.service.js` → `getFileContentLogic(fileName, userId)`
- **Middleware**: `authUser`, `rememberMeMiddleware` (session-based)

### External Services
- **Database**: MySQL via Sequelize (connection in `e-archive/dbConnect/index.js`)
- **Backup Service**: Separate .NET service on `:5080` (not used by client directly)
- **Cron Jobs**: Backend runs `tempFolderCleanUp.js` daily at midnight

## Debugging Aids

### Comparing with EJS Original
**When debugging UI differences:**
1. Run both servers: Express (`:4801`) and Vite (`:5173`)
2. Open EJS version: `http://localhost:4801/admin/<page-route>`
3. Open React version: `http://localhost:5173/admin/<page-route>`
4. Use DevTools to compare DOM structure, classes, styles, event listeners
5. Check Network tab for API call differences (EJS may render data server-side, React fetches via API)

### Console Logging Pattern
Gallery includes `[gallery]` prefixed logs for event tracing:
```javascript
console.log('[gallery] folder click', folderKey, 'before=', sub.style.display)
console.log('[gallery] reveal click - sub count=', count, 'visibleCount=', visible)
```

### Common Issues
1. **CORS/Cookie Issues**: Ensure backend CORS allows `http://localhost:5173` with `credentials: true` and client uses `credentials: 'include'`
2. **Folder Toggle Not Working**: Check for duplicate event handlers (jQuery + native); ensure only one handler per element
3. **Empty Folder Icons**: `renderStructure` only appends folder buttons if `.sub-items` has children (prevents rendering empty `{}` nodes)
4. **Dark Mode Not Applied**: Check CSS variable definitions and selectors match theme toggle mechanism
5. **Missing Vendor Assets**: Ensure `/public/assets` copied from original EJS project to `client/public/assets`

## Testing & Validation

- **Manual E2E Flow**: Login → Dashboard → Gallery (expand folders, search by date, pick/send, delete, preview)
- **Auth Check**: Open DevTools → Network → verify `/check-auth` returns 200, cookies set with `Set-Cookie` header
- **File Operations**: Check Console for `[gallery]` logs and Network for POST/DELETE responses
- **Visual Parity**: Side-by-side comparison with EJS version (same layout, spacing, colors, interactions)

---

**Admin Test Credentials**: `microadmin` / `1234`

**Key References**:
- Original EJS Project: `w:\Mycrolynxe\e-archive\e-archive`
- React SPA Client: `w:\Mycrolynxe\e-archive\client`
- EJS Views: `e-archive\views\dashboard\pages\*.ejs`
- Backend API: `e-archive\routes\adminRoute.js`, `e-archive\controllers\adminController.js`

**Pro Tip**: When modifying Gallery.jsx or converting a new page, always check the corresponding EJS template first to understand the original data flow, DOM structure, and client-side JavaScript. The React version should produce identical HTML and behavior.
