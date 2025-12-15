# e-Archive Client (React)

This is a Vite + React prototype frontend for the e-archive project. It re-uses the static `assets` folder that you placed inside this `client` directory.

Quick start (PowerShell):

```powershell
cd "w:\Mycrolynxe\e-archive\client"
# install deps
npm install
# run dev server
npm run dev
```

Notes:
- The scaffolding created `src` components (`Header`, `Dashboard`) and an `index.html` that links into `/assets/css/style.css` so the UI will have the project's styles and images available.
- Next steps I can take for you:
  - Convert existing EJS pages into React routes/components (users, upload, gallery, audit logs)
  - Add data fetching to integrate with your existing Express API (e.g. `app.js` routes)
  - Implement authentication and protected routes

If you want, I can now:
- Run `npm install` and `npm run dev` in the client folder (requires a terminal run from you or permission to run commands), or
- Continue scaffolding more components mapping existing EJS templates into JSX.
