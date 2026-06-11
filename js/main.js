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

