const { app, BrowserWindow, shell, session } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');



let mainWindow;
let staticServer;
let pendingToken = null;

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

    // Handle token endpoints for secure loopback authentication
    if (req.method === 'POST' && parsedUrl === '/api/save-token') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          pendingToken = JSON.parse(body);
          console.log('[Main Process] Received token from browser, saved to pendingToken.');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end('OK');
        } catch (e) {
          console.error('[Main Process] Invalid JSON received on /api/save-token:', e);
          res.statusCode = 400;
          res.end('Invalid JSON');
        }
      });
      return;
    }

    if (req.method === 'GET' && parsedUrl === '/api/get-token') {
      if (pendingToken) {
        console.log('[Main Process] /api/get-token polled. pendingToken exists: true');
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ token: pendingToken }));
      pendingToken = null; // Reset after reading
      return;
    }

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
    icon: path.join(__dirname, 'www', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadURL('http://localhost:8000/?platform=desktop');
  mainWindow.webContents.openDevTools();

  // Intercept new window requests (e.g. target="_blank" or window.open)
  // Force all popup requests (like Google OAuth and external links) to open in the user's default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Clear Service Workers and Cache Storage on startup to prevent loading stale cached assets
  try {
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage']
    });
    console.log('Cleared Service Workers and Cache Storage on startup.');
  } catch (err) {
    console.error('Failed to clear storage data:', err);
  }

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
