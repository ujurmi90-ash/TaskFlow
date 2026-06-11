# TaskFlow — Setup & Deployment Guide

TaskFlow is a Gmail-connected task management application with Kanban, Daily Log, and Team views. It can run locally in your web browser, run as a native desktop application, or be compiled into cross-platform installer packages (Windows, macOS, Android).

---

## Prerequisites

- **Node.js LTS** (for desktop packaging and local server tools)
- **Google Cloud Project** (for Gmail API and Google Drive Sync)
- **GitHub Account** (optional, for compiling macOS and Android packages)

---

## Step 1: Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `TaskFlow`.
3. Go to **APIs & Services** -> **Library**, search for **Gmail API**, and click **Enable**.
4. Go to **OAuth consent screen**:
   - Choose **External** -> click **Create**.
   - Fill in App Name (`TaskFlow`) and emails.
   - Under **Scopes**, add:
     - `.../auth/gmail.readonly` (read inbox emails)
     - `.../auth/gmail.send` (send email replies)
     - `.../auth/userinfo.profile` (user profile picture/initials)
     - `.../auth/userinfo.email` (user email tracking)
     - `.../auth/drive.appdata` (private Google Drive application database storage)
   - Under **Test users**, add your email address and any teammate emails.
5. Go to **Credentials**:
   - Click **Create Credentials** -> **OAuth client ID**.
   - Application type: **Web application**.
   - Authorized JavaScript origins: `http://localhost:8000`.
   - Click **Create** and copy the Client ID.
6. Open `js/config.js` and paste your client ID:
   ```javascript
   GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
   ```

---

## Option A: Run Locally in your Web Browser

Open a PowerShell terminal in the project directory and run:

```powershell
.\server.ps1
```

Then open your browser to: **http://localhost:8000**

---

## Option B: Run as a Native Desktop App (Dev Mode)

To run the application in a standalone, dedicated desktop window (powered by Electron):

1. Install project dependencies:
   ```powershell
   npm install
   ```
2. Start the desktop app:
   ```powershell
   npm run electron:start
   ```

---

## Option C: Build the Windows Installer (`.exe`)

To compile the application into a standalone Windows installer:

1. Run the build script:
   ```powershell
   npm run electron:build
   ```
2. Once complete, you will find the installer file (`TaskFlow Setup 1.0.0.exe`) in the newly created `dist/` directory. Double-click it to install TaskFlow on your computer!

---

## Option D: Build Mac & Android Installers automatically (GitHub)

Because macOS installers must be compiled on Apple hardware, and Android apps require complex compilers, we configured a **GitHub Actions CI/CD Pipeline**.

To compile installers for **macOS (`.dmg`)** and **Android (`.apk`)** automatically:

1. Create a new repository on your **GitHub** account.
2. Push your project folder to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial desktop setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
3. Go to the **Actions** tab on your GitHub repository page.
4. You will see the **Build Cross-Platform Installers** workflow running!
5. Once complete, click on the workflow run, scroll down to **Artifacts**, and download:
   - `taskflow-desktop-macos-latest` (contains the Mac `.dmg` installer)
   - `taskflow-android-apk` (contains the installable Android `.apk` package)
   - `taskflow-desktop-windows-latest` (backup Windows installer)

---

## Troubleshooting

### "403: disallowed_useragent" on Login
- The app handles this automatically in desktop mode by overriding Electron's User-Agent string to match Chrome. If you encounter this, ensure you launch the app using `npm run electron:start` so the main process configures the headers correctly.

### Port 8000 Collision
- If you see `Port 8000 is already in use`, it means another server is running (e.g., your browser server or another app). The desktop app will automatically connect to the running server, so it will continue working normally!
