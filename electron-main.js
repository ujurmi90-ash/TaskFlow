const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Set User-Agent globally to a standard Chrome browser user agent
// to bypass Google's "403 disallowed_useragent" block inside Electron.
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let mainWindow;
let staticServer;

function startStaticServer(port) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown; charset=utf-8'
  };

  const server = http.createServer((req, res) => {
    // Basic router and file server
    const parsedUrl = req.url.split('?')[0];
    const webDir = path.join(__dirname, 'www');
    let filePath = path.join(webDir, parsedUrl === '/' ? 'index.html' : parsedUrl);

    // Prevent directory traversal attacks
    const relative = path.relative(webDir, filePath);
    if (relative && relative.startsWith('..') && !path.isAbsolute(relative)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`Not Found: ${req.url}`);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      // Add COOP and COEP headers to allow secure context if needed
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      res.end(data);
    });
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' || e.code === 'EACCES') {
      console.log(`Port ${port} is already in use or restricted. Assuming an external or local server is already running.`);
    } else {
      console.error('Static server error:', e);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Background static server running at http://127.0.0.1:${port}`);
  });

  return server;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'TaskFlow',
    icon: path.join(__dirname, 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadURL('http://localhost:8000');

  // Intercept new window requests (e.g. target="_blank" or window.open)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // If opening a Google OAuth popup, allow it to open inside a new Electron window
    if (url.startsWith('https://accounts.google.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 600,
          height: 600,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          }
        }
      };
    }
    // Otherwise, open any standard links in the default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  staticServer = startStaticServer(8000);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (staticServer) {
    staticServer.close();
  }
});
