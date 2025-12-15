# e-archive

## Project Overview
e-archive is a digital archiving system designed to securely store, manage, and retrieve documents and records. It provides an intuitive interface for users to upload, search, and organize files while ensuring data integrity and security.

---

## Features
- **Document Upload**: Upload and store documents in various formats.
- **Search Functionality**: Quickly search for documents using keywords or metadata.
- **User Management**: Role-based access control for administrators and users.
- **Secure Storage**: Ensures data security with encryption and secure authentication.
- **Version Control**: Maintain and track changes to documents over time.
- **Audit Logs**: Keep track of user activities for accountability.

---

## Admin Authentication
To access the admin panel, use the following credentials:

- **Username**: `microadmin`
- **Password**: `1234`

---

## Installation and Setup
Follow these steps to set up the project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/e-archive.git

2. Navigate to the project directory:
cd e-archive

3. Install dependencies:
npm install

4. Start the development server:npm start

Usage
Open the application in your browser at http://localhost:3000.
Log in using the admin credentials provided above or create a new user account.
Use the dashboard to upload, search, and manage documents.
Technologies Used
Frontend: React.js
Backend: Node.js, Express.js
Database: MongoDB
Authentication: JSON Web Tokens (JWT)
Styling: Bootstrap
Contributing
Contributions are welcome! Please follow these steps:

1. Fork the repository:
git clone https://github.com/your-repo/e-archive.git

2. Create a new branch for your feature or bug fix:
git checkout -b feature-name

3. Commit your changes:
git commit -m "Description of changes"

4. Push to your branch:
git push origin feature-name

5. Open a pull request.

License
This project is licensed under the MIT License. See the LICENSE file for details.

Contact
For any inquiries or support, please contact the project maintainer at support@e-archive.com.

if we are on c:\ drive but project is on a different drive we first E: to switch to drive E for instance.


# PM2 Commands

```bash
# Install PM2
npm install -g pm2

# Start the app cd project dir
npm install -g pm2-windows-startup # for windows 
pm2 start app.js --name "e-archive"

# Enable auto-restart on reboot
pm2-startup install # for windows
pm2 startup # for unix
pm2 save

# Monitor the app
pm2 monit

# View logs
pm2 logs e-archive

# Zero-downtime reload
pm2 reload e-archive

# Manage the app
pm2 list
pm2 stop e-archive
pm2 restart e-archive
pm2 delete e-archive
```
# Nginx
Download nginx and extract to C:\nginx
cd C:\nginx nginx.exe
stop server nginx -s stop
open file C:\nginx\conf\nginx.conf
Paste
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://127.0.0.1:3000;  # your node app port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

then nginx -s reload

RUN nginx as a service

Download https://nssm.cc/download
Extract it on the C:\ drive
Run CMD as admin and cd C:\nssm\win64
Run nssm install nginx fill the form { Path: C:\nginx\nginx.exe, Startup dir: C:\nginx }
Run nssm start nginx