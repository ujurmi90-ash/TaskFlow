// Check if this is the system browser receiving the OAuth redirect token for the desktop app
const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const accessToken = params.get('access_token');
const isDesktopApp = window.location.search.includes('platform=desktop');

if (accessToken && !isDesktopApp) {
  // We are in the system browser, redirected from Google OAuth.
  // Send the token to the local server.
  fetch('/api/save-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken,
      expires_in: params.get('expires_in') || 3600
    })
  })
  .then(() => {
    // Replace body with success message
    document.body.innerHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; overflow: hidden; box-sizing: border-box; width: 100vw;">
        <div style="background-color: #1e293b; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); max-width: 420px; width: 90%;">
          <div style="font-size: 4rem; color: #22c55e; margin-bottom: 1rem; line-height: 1;">✓</div>
          <h1 style="color: #3b82f6; margin-top: 0; font-size: 1.8rem; font-weight: 700;">Login Successful!</h1>
          <p style="color: #94a3b8; font-size: 1.1rem; line-height: 1.5; margin: 1rem 0 0 0;">You have successfully authenticated with Google. You can close this browser window and return to the TaskFlow desktop app.</p>
        </div>
      </div>
    `;
  })
  .catch(err => {
    console.error('Failed to send token to desktop app:', err);
    document.body.innerHTML = '<p style="color: red; padding: 20px; text-align: center;">Failed to send login token to the desktop application. Please ensure the app is running.</p>';
  });
  
  // Stop executing the rest of the application in the system browser
  throw new Error('OAuth Redirect Handled');
}

import { authService } from './services/auth.js';
import { db } from './services/database.js';
import { syncService } from './services/sync.js';
import { App } from './components/App.js';
import { Toast } from './components/Toast.js';

// ---- Global State ----
window.AppState = {
  currentView: 'dashboard',
  tasks: [],
  filters: { status: '', priority: '', owner: '', project: '', taskType: '', search: '' },
  user: null,
  isAuthenticated: false,
  syncStatus: 'idle' // 'idle' | 'syncing' | 'synced' | 'error'
};

// ---- Event Bus ----
window.EventBus = {
  _listeners: {},
  on(event, cb) { (this._listeners[event] ||= []).push(cb); },
  off(event, cb) { this._listeners[event] = (this._listeners[event] || []).filter(l => l !== cb); },
  emit(event, data) { (this._listeners[event] || []).forEach(cb => cb(data)); }
};

// ---- App Init ----
async function init() {
  try {
    await db.init();
    console.log('Database initialized');

    // Init toast system
    const toast = new Toast();
    toast.init();

    // Init auth (non-blocking — Google scripts may load slowly)
    authService.init().then(() => {
      console.log('Auth initialized');
    }).catch(err => {
      console.warn('Auth init failed (Google scripts may not have loaded):', err);
    });

    // Sync status listener
    syncService.onSyncChange((status, message) => {
      window.AppState.syncStatus = status;
      EventBus.emit('sync:changed', { status, message });

      if (status === 'synced') {
        // Reload tasks from DB after sync pulls remote changes
        db.getAllTasks().then(tasks => {
          window.AppState.tasks = tasks;
          window._syncTriggeredUpdate = true;
          EventBus.emit('tasks:updated');
          window._syncTriggeredUpdate = false;
        });
        db.getTeamMembers().then(members => {
          window.AppState.teamMembers = members;
        });
      }
      if (status === 'error') {
        EventBus.emit('toast:show', { type: 'error', message: 'Sync failed: ' + (message || 'Unknown error') });
      }
    });

    // Auth state change handler
    authService.onAuthChange(async (isSignedIn, profile) => {
      window.AppState.isAuthenticated = isSignedIn;
      window.AppState.user = profile;

      if (isSignedIn) {
        const tasks = await db.getAllTasks();
        window.AppState.tasks = tasks;

        // Start sync after login
        syncService.init().catch(err => {
          console.warn('Sync init failed:', err);
        });
      } else {
        window.AppState.tasks = [];
        syncService.stop();
      }

      EventBus.emit('auth:changed', { isSignedIn, profile });
    });

    // Listen for task updates — trigger sync after local changes
    EventBus.on('tasks:updated', async () => {
      const tasks = await db.getAllTasks();
      window.AppState.tasks = tasks;

      // Only sync if this update was NOT triggered by sync itself (prevent loop)
      if (!window._syncTriggeredUpdate && authService.isSignedIn()) {
        // Small delay to batch rapid changes (e.g. CSV import)
        clearTimeout(window._syncDebounce);
        window._syncDebounce = setTimeout(() => {
          syncService.syncNow();
        }, 2000);
      }
    });

    // Manual sync trigger
    EventBus.on('sync:trigger', () => {
      syncService.syncNow();
    });

    // Render app
    const app = new App();
    const appRoot = document.getElementById('app');
    app.render(appRoot);

  } catch (err) {
    console.error('App init failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);

