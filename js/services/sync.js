import { authService } from './auth.js';
import { db } from './database.js';

class SyncService {
  constructor() {
    this.syncing = false;
    this.lastSyncTime = null;
    this.syncInterval = null;
    this.listeners = [];
    this.SYNC_FILE_NAME = 'taskflow_db.json';
    this.POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
  }

  // ---- Public API ----

  async init() {
    // Start automatic background polling
    this._startPolling();
    // Run initial sync
    await this.syncNow();
  }

  async syncNow() {
    if (this.syncing || !authService.isSignedIn()) return;

    this.syncing = true;
    this._notify('syncing');

    try {
      // 1. Read remote state from Google Drive
      const remote = await this._downloadRemote();

      // 2. Read local state from IndexedDB
      const localTasks = await db.getAllTasks();
      const localTeam = await db.getTeamMembers();

      const localState = {
        tasks: localTasks,
        teamMembers: localTeam,
        lastModified: new Date().toISOString()
      };

      // 3. Merge
      let merged;
      if (remote) {
        merged = this._merge(localState, remote);
      } else {
        merged = localState;
      }

      // 4. Write merged state back to local IndexedDB
      await this._writeLocalDB(merged);

      // 5. Upload merged state to Google Drive
      merged.lastModified = new Date().toISOString();
      await this._uploadRemote(merged);

      this.lastSyncTime = new Date();
      this._notify('synced');
    } catch (err) {
      console.error('[Sync] Failed:', err);
      this._notify('error', err.message);
    } finally {
      this.syncing = false;
    }
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  onSyncChange(callback) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(l => l !== callback); };
  }

  getStatus() {
    if (this.syncing) return 'syncing';
    if (this.lastSyncTime) return 'synced';
    return 'idle';
  }

  getLastSyncTime() {
    return this.lastSyncTime;
  }

  // ---- Internal: Polling ----

  _startPolling() {
    this.stop();
    this.syncInterval = setInterval(() => {
      if (authService.isSignedIn()) {
        this.syncNow();
      }
    }, this.POLL_INTERVAL_MS);
  }

  // ---- Internal: Google Drive Operations ----

  async _getFileId() {
    const token = authService.getToken();
    if (!token) throw new Error('Not authenticated');

    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${this.SYNC_FILE_NAME}'&fields=files(id,modifiedTime)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      authService.signOut();
      throw new Error('Session expired');
    }
    if (!res.ok) {
      let errorMsg = `Drive list failed: ${res.status}`;
      try {
        const errData = await res.json();
        if (errData?.error?.message) {
          errorMsg = errData.error.message;
        }
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  async _downloadRemote() {
    const fileId = await this._getFileId();
    if (!fileId) return null;

    const token = authService.getToken();
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      authService.signOut();
      throw new Error('Session expired');
    }
    if (!res.ok) {
      let errorMsg = `Drive download failed: ${res.status}`;
      try {
        const errData = await res.json();
        if (errData?.error?.message) {
          errorMsg = errData.error.message;
        }
      } catch (e) {}
      throw new Error(errorMsg);
    }

    return await res.json();
  }

  async _uploadRemote(state) {
    const token = authService.getToken();
    if (!token) throw new Error('Not authenticated');

    const fileId = await this._getFileId();
    const body = JSON.stringify(state);

    if (fileId) {
      // Update existing file
      const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });
      if (!res.ok) {
        let errorMsg = `Drive upload (update) failed: ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error?.message) {
            errorMsg = errData.error.message;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }
    } else {
      // Create new file in appDataFolder
      const metadata = {
        name: this.SYNC_FILE_NAME,
        parents: ['appDataFolder']
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([body], { type: 'application/json' }));

      const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      if (!res.ok) {
        let errorMsg = `Drive upload (create) failed: ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error?.message) {
            errorMsg = errData.error.message;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }
    }
  }

  // ---- Internal: Merge Logic ----

  _merge(local, remote) {
    const merged = {
      tasks: this._mergeTasks(local.tasks || [], remote.tasks || []),
      teamMembers: this._mergeTeamMembers(local.teamMembers || [], remote.teamMembers || []),
      lastModified: new Date().toISOString()
    };
    return merged;
  }

  _mergeTasks(localTasks, remoteTasks) {
    const taskMap = new Map();

    // Add all local tasks
    for (const task of localTasks) {
      taskMap.set(task.id, task);
    }

    // Merge remote tasks — last-write-wins per task based on updatedAt
    for (const remoteTask of remoteTasks) {
      const existing = taskMap.get(remoteTask.id);
      if (!existing) {
        // New task from remote — add it
        taskMap.set(remoteTask.id, remoteTask);
      } else {
        // Both have this task — keep the one with the latest updatedAt
        const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const remoteTime = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();
        if (remoteTime > localTime) {
          taskMap.set(remoteTask.id, remoteTask);
        }
      }
    }

    return Array.from(taskMap.values());
  }

  _mergeTeamMembers(localMembers, remoteMembers) {
    const memberMap = new Map();

    const addMember = (m) => {
      if (!m) return;
      const name = typeof m === 'object' ? m.name : m;
      if (!name) return;
      const key = name.trim().toLowerCase();

      const existing = memberMap.get(key);
      if (!existing) {
        memberMap.set(key, m);
      } else if (typeof m === 'object' && typeof existing !== 'object') {
        memberMap.set(key, m);
      } else if (typeof m === 'object' && typeof existing === 'object') {
        memberMap.set(key, {
          name: existing.name || m.name,
          email: existing.email || m.email,
          role: existing.role || m.role
        });
      }
    };

    (localMembers || []).forEach(addMember);
    (remoteMembers || []).forEach(addMember);

    return Array.from(memberMap.values());
  }

  // ---- Internal: Write merged state to local IndexedDB ----

  async _writeLocalDB(state) {
    if (state.tasks && state.tasks.length > 0) {
      const localTasks = await db.getAllTasks();
      const localMap = new Map(localTasks.map(t => [t.id, t]));
      
      const tasksToPut = [];
      
      for (const remoteTask of state.tasks) {
        const local = localMap.get(remoteTask.id);
        if (!local) {
          tasksToPut.push(remoteTask);
        } else {
          const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
          const remoteTime = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();
          if (remoteTime > localTime) {
            tasksToPut.push(remoteTask);
          }
        }
      }
      
      if (tasksToPut.length > 0) {
        console.log(`[Sync] Writing ${tasksToPut.length} new/updated tasks to local DB out of ${state.tasks.length} total.`);
        const store = db._tx('tasks', 'readwrite');
        await Promise.all(tasksToPut.map(t => db._request(store, 'put', t)));
      } else {
        console.log('[Sync] No local tasks updates needed.');
      }
    }

    if (state.teamMembers && state.teamMembers.length > 0) {
      const localTeam = await db.getTeamMembers();
      const localTeamStr = JSON.stringify(localTeam);
      const remoteTeamStr = JSON.stringify(state.teamMembers);
      if (localTeamStr !== remoteTeamStr) {
        await db.saveTeamMembers(state.teamMembers);
      }
    }
  }

  // ---- Internal: Notify listeners ----

  _notify(status, message) {
    this.listeners.forEach(cb => cb(status, message));
  }
}

export const syncService = new SyncService();
