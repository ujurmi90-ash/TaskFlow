import { generateId } from '../config.js';

class Database {
  constructor() {
    this.dbName = 'TaskFlowDB';
    this.version = 1;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('status', 'status', { unique: false });
          taskStore.createIndex('priority', 'priority', { unique: false });
          taskStore.createIndex('dateGroup', 'dateGroup', { unique: false });
          taskStore.createIndex('project', 'project', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('customData')) {
          db.createObjectStore('customData', { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onerror = (e) => {
        console.error('DB open error:', e);
        reject(e);
      };
    });
  }

  _tx(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  _request(store, method, ...args) {
    return new Promise((resolve, reject) => {
      const req = store[method](...args);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---- Tasks CRUD ----

  async addTask(task) {
    const now = new Date().toISOString();
    const fullTask = {
      id: task.id || generateId(),
      title: task.title || '',
      taskType: task.taskType || '',
      priority: task.priority || 'Medium',
      owners: task.owners || [],
      status: task.status || 'To Do',
      project: task.project || '',
      subCategory: task.subCategory || '',
      startDate: task.startDate || '',
      endDate: task.endDate || '',
      mailLink: task.mailLink || '',
      mondayLink: task.mondayLink || '',
      docLink: task.docLink || '',
      notes: task.notes || '',
      dateGroup: task.dateGroup || new Date().toISOString().split('T')[0],
      emailId: task.emailId || '',
      emailSubject: task.emailSubject || '',
      emailFrom: task.emailFrom || '',
      createdAt: task.createdAt || now,
      updatedAt: now
    };
    const store = this._tx('tasks', 'readwrite');
    await this._request(store, 'put', fullTask);
    return fullTask;
  }

  async updateTask(id, updates) {
    const task = await this.getTask(id);
    if (!task) throw new Error(`Task ${id} not found`);
    const updated = { ...task, ...updates, updatedAt: new Date().toISOString() };
    const store = this._tx('tasks', 'readwrite');
    await this._request(store, 'put', updated);
    return updated;
  }

  async deleteTask(id) {
    const store = this._tx('tasks', 'readwrite');
    return this._request(store, 'delete', id);
  }

  async getTask(id) {
    const store = this._tx('tasks');
    return this._request(store, 'get', id);
  }

  async getAllTasks() {
    const store = this._tx('tasks');
    const tasks = await this._request(store, 'getAll');
    return tasks.sort((a, b) => {
      if (a.dateGroup && b.dateGroup) {
        const cmp = b.dateGroup.localeCompare(a.dateGroup);
        if (cmp !== 0) return cmp;
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }

  async getTasksByStatus(status) {
    const all = await this.getAllTasks();
    return all.filter(t => t.status === status);
  }

  async getTasksByOwner(owner) {
    const all = await this.getAllTasks();
    return all.filter(t => t.owners && t.owners.includes(owner));
  }

  async getTasksByDate(dateGroup) {
    const all = await this.getAllTasks();
    return all.filter(t => t.dateGroup === dateGroup);
  }

  async getTasksByProject(project) {
    const all = await this.getAllTasks();
    return all.filter(t => t.project === project);
  }

  async importTasks(tasksArray) {
    const store = this._tx('tasks', 'readwrite');
    const promises = tasksArray.map(task => {
      const now = new Date().toISOString();
      const fullTask = {
        id: task.id || generateId(),
        title: task.title || '',
        taskType: task.taskType || '',
        priority: task.priority || 'Medium',
        owners: task.owners || [],
        status: task.status || 'To Do',
        project: task.project || '',
        subCategory: task.subCategory || '',
        startDate: task.startDate || '',
        endDate: task.endDate || '',
        mailLink: task.mailLink || '',
        mondayLink: task.mondayLink || '',
        docLink: task.docLink || '',
        notes: task.notes || '',
        dateGroup: task.dateGroup || '',
        emailId: task.emailId || '',
        emailSubject: task.emailSubject || '',
        emailFrom: task.emailFrom || '',
        createdAt: task.createdAt || now,
        updatedAt: now
      };
      return this._request(store, 'put', fullTask);
    });
    await Promise.all(promises);
    return tasksArray.length;
  }

  async exportTasks() {
    return this.getAllTasks();
  }

  async clearAllTasks() {
    const store = this._tx('tasks', 'readwrite');
    return this._request(store, 'clear');
  }

  // ---- Custom Data ----

  async getCustomProjects() {
    try {
      const store = this._tx('customData');
      const data = await this._request(store, 'get', 'customProjects');
      return data?.values || [];
    } catch { return []; }
  }

  async addCustomProject(name) {
    const projects = await this.getCustomProjects();
    if (!projects.includes(name)) {
      projects.push(name);
      const store = this._tx('customData', 'readwrite');
      await this._request(store, 'put', { key: 'customProjects', values: projects });
    }
    return projects;
  }

  async getCustomSubCategories() {
    try {
      const store = this._tx('customData');
      const data = await this._request(store, 'get', 'customSubCategories');
      return data?.values || [];
    } catch { return []; }
  }

  async addCustomSubCategory(name) {
    const cats = await this.getCustomSubCategories();
    if (!cats.includes(name)) {
      cats.push(name);
      const store = this._tx('customData', 'readwrite');
      await this._request(store, 'put', { key: 'customSubCategories', values: cats });
    }
    return cats;
  }

  // ---- Settings ----

  async getSettings() {
    try {
      const store = this._tx('settings');
      const data = await this._request(store, 'get', 'appSettings');
      return data || { key: 'appSettings' };
    } catch { return { key: 'appSettings' }; }
  }

  async updateSettings(data) {
    const store = this._tx('settings', 'readwrite');
    await this._request(store, 'put', { key: 'appSettings', ...data });
  }

  // ---- Team Members ----
  async getTeamMembers() {
    try {
      const store = this._tx('customData');
      const data = await this._request(store, 'get', 'teamMembers');
      let members = [];
      if (data && data.values) {
        members = data.values;
      } else {
        const { CONFIG } = await import('../config.js');
        members = [...CONFIG.TEAM_MEMBERS];
      }
      const { CONFIG } = await import('../config.js');
      return members.map(m => {
        const name = typeof m === 'object' && m !== null ? m.name : m;
        const defaultMember = CONFIG.TEAM_MEMBERS.find(dm => dm.name.toLowerCase() === name.toLowerCase());
        if (defaultMember) {
          return {
            name: defaultMember.name,
            email: (typeof m === 'object' && m.email) || defaultMember.email || '',
            role: (typeof m === 'object' && m.role) || defaultMember.role || ''
          };
        }
        return typeof m === 'object' ? m : { name, email: '', role: '' };
      });
    } catch (e) {
      const { CONFIG } = await import('../config.js');
      return [...CONFIG.TEAM_MEMBERS];
    }
  }

  async saveTeamMembers(members) {
    const store = this._tx('customData', 'readwrite');
    await this._request(store, 'put', { key: 'teamMembers', values: members });
  }
}

export const db = new Database();
