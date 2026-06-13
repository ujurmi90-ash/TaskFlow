import { CONFIG, generateId } from '../config.js';
import { db } from '../services/database.js';

export class TaskModal {
  constructor() {
    this.task = null;
    this.isEdit = false;
    this.selectedOwners = [];
    this.customProjects = [];
    this.customSubCats = [];
    this.addingProject = false;
    this.addingSubCat = false;
  }

  init() {
    EventBus.on('task:edit', (task) => this._open(task, true));
    EventBus.on('task:create', (data) => this._open(data, false));
  }

  async _open(data, isEdit) {
    this.isEdit = isEdit;
    this.task = isEdit ? { ...data } : { status: 'To Do', priority: 'Medium', dateGroup: new Date().toISOString().split('T')[0], ...data };
    this.selectedOwners = [...(this.task.owners || [])];
    this.customProjects = await db.getCustomProjects();
    this.customSubCats = await db.getCustomSubCategories();
    this.addingProject = false;
    this.addingSubCat = false;
    this._render();
  }

  _render() {
    const root = document.getElementById('modal-root');
    const t = this.task;
    const allProjects = [...CONFIG.DEFAULT_PROJECTS, ...this.customProjects];
    const allSubCats = [...CONFIG.DEFAULT_SUB_CATEGORIES, ...this.customSubCats];

    root.innerHTML = `
      <div class="modal-overlay" id="task-modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">${this.isEdit ? 'Edit Task' : 'New Task'}</h2>
            <button class="modal-close" id="task-modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Title</label>
              <input class="form-input" id="task-title" value="${this._escAttr(t.title || '')}" placeholder="Task title..." />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Project</label>
                ${this.addingProject ? `
                  <div class="flex gap-sm">
                    <input class="form-input" id="new-project-input" placeholder="New project name..." autofocus />
                    <button class="btn btn-primary btn-sm" id="save-new-project">Save</button>
                    <button class="btn btn-ghost btn-sm" id="cancel-new-project">✕</button>
                  </div>
                ` : `
                  <select class="form-select" id="task-project">
                    <option value="">Select project</option>
                    ${allProjects.map(p => `<option value="${p}" ${t.project === p ? 'selected' : ''}>${p}</option>`).join('')}
                    <option value="__add_new__">+ Add New Project</option>
                  </select>
                `}
              </div>
              <div class="form-group">
                <label class="form-label">Sub-Category</label>
                ${this.addingSubCat ? `
                  <div class="flex gap-sm">
                    <input class="form-input" id="new-subcat-input" placeholder="New sub-category..." autofocus />
                    <button class="btn btn-primary btn-sm" id="save-new-subcat">Save</button>
                    <button class="btn btn-ghost btn-sm" id="cancel-new-subcat">✕</button>
                  </div>
                ` : `
                  <select class="form-select" id="task-subcat">
                    <option value="">Select sub-category</option>
                    ${allSubCats.map(s => `<option value="${s}" ${t.subCategory === s ? 'selected' : ''}>${s}</option>`).join('')}
                    <option value="__add_new__">+ Add New Sub-Category</option>
                  </select>
                `}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Task Type</label>
                <select class="form-select" id="task-type">
                  <option value="">Select type</option>
                  ${CONFIG.TASK_TYPES.map(ty => `<option value="${ty}" ${t.taskType === ty ? 'selected' : ''}>${ty}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select class="form-select" id="task-priority">
                  ${CONFIG.PRIORITIES.map(p => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="task-status">
                  ${CONFIG.STATUSES.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Date Group</label>
                <input class="form-input" type="date" id="task-dategroup" value="${t.dateGroup || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Owner(s)</label>
              <div class="owner-chips" id="owner-chips">
                ${(AppState.teamMembers || []).map(m => {
                  const name = typeof m === 'object' && m !== null ? m.name : m;
                  const isSelected = this.selectedOwners.includes(name);
                  return `
                    <span class="owner-chip ${isSelected ? 'selected' : ''}" data-owner="${this._escAttr(name)}">${this._escAttr(name)}</span>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Start Date</label>
                <input class="form-input" type="date" id="task-start" value="${t.startDate || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">End Date</label>
                <input class="form-input" type="date" id="task-end" value="${t.endDate || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">📧 Mail Link</label>
              <input class="form-input" id="task-mail" value="${this._escAttr(t.mailLink || '')}" placeholder="https://mail.google.com/..." />
            </div>
            <div class="form-group">
              <label class="form-label">📋 Monday Link</label>
              <input class="form-input" id="task-monday" value="${this._escAttr(t.mondayLink || '')}" placeholder="https://monday.com/..." />
            </div>
            <div class="form-group">
              <label class="form-label">📄 Doc / Excel Link</label>
              <input class="form-input" id="task-doc" value="${this._escAttr(t.docLink || '')}" placeholder="https://docs.google.com/..." />
            </div>

            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-textarea" id="task-notes" placeholder="Additional notes...">${t.notes || ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            ${this.isEdit ? '<button class="btn btn-danger" id="task-delete-btn">Delete</button>' : ''}
            <div class="flex-1"></div>
            <button class="btn btn-secondary" id="task-cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="task-save-btn">${this.isEdit ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const root = document.getElementById('modal-root');

    // Close
    root.querySelector('#task-modal-close')?.addEventListener('click', () => this._close());
    root.querySelector('#task-cancel-btn')?.addEventListener('click', () => this._close());
    root.querySelector('#task-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'task-modal-overlay') this._close();
    });

    // Owner chips
    root.querySelectorAll('.owner-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.owner;
        if (this.selectedOwners.includes(name)) {
          this.selectedOwners = this.selectedOwners.filter(o => o !== name);
          chip.classList.remove('selected');
        } else {
          this.selectedOwners.push(name);
          chip.classList.add('selected');
        }
      });
    });

    // Add new project
    const projectSelect = root.querySelector('#task-project');
    projectSelect?.addEventListener('change', () => {
      if (projectSelect.value === '__add_new__') {
        this.addingProject = true;
        this._render();
      }
    });

    root.querySelector('#save-new-project')?.addEventListener('click', async () => {
      const input = root.querySelector('#new-project-input');
      const name = input.value.trim();
      if (name) {
        await db.addCustomProject(name);
        this.customProjects = await db.getCustomProjects();
        this.task.project = name;
      }
      this.addingProject = false;
      this._render();
    });
    root.querySelector('#cancel-new-project')?.addEventListener('click', () => {
      this.addingProject = false;
      this._render();
    });

    // Add new sub-category
    const subcatSelect = root.querySelector('#task-subcat');
    subcatSelect?.addEventListener('change', () => {
      if (subcatSelect.value === '__add_new__') {
        this.addingSubCat = true;
        this._render();
      }
    });

    root.querySelector('#save-new-subcat')?.addEventListener('click', async () => {
      const input = root.querySelector('#new-subcat-input');
      const name = input.value.trim();
      if (name) {
        await db.addCustomSubCategory(name);
        this.customSubCats = await db.getCustomSubCategories();
        this.task.subCategory = name;
      }
      this.addingSubCat = false;
      this._render();
    });
    root.querySelector('#cancel-new-subcat')?.addEventListener('click', () => {
      this.addingSubCat = false;
      this._render();
    });

    // Save
    root.querySelector('#task-save-btn')?.addEventListener('click', async () => {
      const data = this._collectFormData();
      if (!data.title.trim()) {
        EventBus.emit('toast:show', { type: 'error', message: 'Title is required' });
        return;
      }

      try {
        if (this.isEdit) {
          await db.updateTask(this.task.id, data);
        } else {
          await db.addTask({ ...data, id: generateId() });
        }

        const tasks = await db.getAllTasks();
        AppState.tasks = tasks;
        EventBus.emit('tasks:updated');
        EventBus.emit('toast:show', { type: 'success', message: this.isEdit ? 'Task updated' : 'Task created' });
        this._close();
      } catch (err) {
        EventBus.emit('toast:show', { type: 'error', message: 'Failed: ' + err.message });
      }
    });

    // Delete
    root.querySelector('#task-delete-btn')?.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try {
        await db.deleteTask(this.task.id);
        const tasks = await db.getAllTasks();
        AppState.tasks = tasks;
        EventBus.emit('tasks:updated');
        EventBus.emit('toast:show', { type: 'info', message: 'Task deleted' });
        this._close();
      } catch (err) {
        EventBus.emit('toast:show', { type: 'error', message: 'Delete failed: ' + err.message });
      }
    });
  }

  _collectFormData() {
    const root = document.getElementById('modal-root');
    const val = (id) => root.querySelector(id)?.value || '';
    return {
      title: val('#task-title'),
      project: val('#task-project'),
      subCategory: val('#task-subcat'),
      taskType: val('#task-type'),
      priority: val('#task-priority'),
      status: val('#task-status'),
      dateGroup: val('#task-dategroup'),
      owners: [...this.selectedOwners],
      startDate: val('#task-start'),
      endDate: val('#task-end'),
      mailLink: val('#task-mail'),
      mondayLink: val('#task-monday'),
      docLink: val('#task-doc'),
      notes: val('#task-notes'),
      emailId: this.task.emailId || '',
      emailSubject: this.task.emailSubject || '',
      emailFrom: this.task.emailFrom || '',
    };
  }

  _close() {
    document.getElementById('modal-root').innerHTML = '';
  }

  _escAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  _escHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

}
