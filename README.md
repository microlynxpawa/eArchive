## Hosting

### Backend (`e-archive/`)
```bash
pm2 start app.js --name "e-archive"
pm2 startup && pm2 save
```

### Frontend (`client/`)
Build and serve the dist folder:
```bash
npm run build
pm2 serve dist 4500 --name e-archive-ui --spa
pm2 startup && pm2 save && pm2 reload e-archive-ui
```

Nginx reverse-proxies port 80 → `127.0.0.1:3000`.

### Runtime config (no rebuild needed)
Edit `client/dist/config.json` to update API URLs in production:
```json
{
  "VITE_API_URL": "http://your-server:3000",
  "ADMIN_API_URL": "http://your-server:3000",
  "FILE_CONTENT_API_URL": "http://your-server:3000"
}
```
