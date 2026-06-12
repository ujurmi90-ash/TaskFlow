import { CONFIG, getStatusColor, getInitials, hashColor, formatDate } from '../config.js';
import { db } from '../services/database.js';

export class DailyLog {
  constructor() {
    this.collapsedGroups = new Set();
    this.inlineDropdown = null;
  }

  render(container) {
    const tasks = this._applyFilters(AppState.tasks || []);
    const groups = this._groupByDate(tasks);

    container.innerHTML = `
      <div class="animate-fadeIn">
        ${this._renderFilters()}
        <div class="flex-between mb-md">
          <span class="text-sm text-muted font-mono">${tasks.length} tasks</span>
          <button class="btn btn-secondary btn-sm" id="add-date-group-btn">+ Add Date Group</button>
        </div>
        ${groups.length === 0 ? this._renderEmpty() : this._renderGroups(groups)}
      </div>
      <button class="btn-fab" id="fab-add-task" title="Add Task">+</button>
    `;

    this._bindEvents(container);
  }

  _applyFilters(tasks) {
    const f = AppState.filters;
    return tasks.filter(t => {
      if (f.status && t.status !== f.status) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.owner && !(t.owners || []).includes(f.owner)) return false;
      if (f.project && t.project !== f.project) return false;
      if (f.taskType && t.taskType !== f.taskType) return false;
      if (f.search) {
        const s = f.search.toLowerCase();
        if (!t.title?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }

  _groupByDate(tasks) {
    const map = new Map();
    tasks.forEach(t => {
      const key = t.dateGroup || 'No Date';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }

  _renderFilters() {
    const f = AppState.filters;
    return `
      <div class="filter-bar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search tasks..." id="filter-search" value="${f.search || ''}"/>
        </div>
        <select class="form-select" id="filter-status">
          <option value="">All Status</option>
          ${CONFIG.STATUSES.map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select class="form-select" id="filter-priority">
          <option value="">All Priority</option>
          ${CONFIG.PRIORITIES.map(p => `<option value="${p}" ${f.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <select class="form-select" id="filter-owner">
          <option value="">All Owners</option>
          ${(AppState.teamMembers || []).map(m => {
            const name = typeof m === 'object' && m !== null ? m.name : m;
            return `<option value="${name}" ${f.owner === name ? 'selected' : ''}>${name}</option>`;
          }).join('')}
        </select>
        <select class="form-select" id="filter-project">
          <option value="">All Projects</option>
          ${CONFIG.DEFAULT_PROJECTS.map(p => `<option value="${p}" ${f.project === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <select class="form-select" id="filter-type">
          <option value="">All Types</option>
          ${CONFIG.TASK_TYPES.map(t => `<option value="${t}" ${f.taskType === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    `;
  }

  _renderGroups(groups) {
    return groups.map(([date, tasks]) => {
      const collapsed = this.collapsedGroups.has(date);
      const dateDisplay = date === 'No Date' ? 'No Date' : this._formatDateGroup(date);
      return `
        <div class="date-group" data-date="${date}">
          <div class="date-group-header ${collapsed ? 'collapsed' : ''}" data-date="${date}">
            <span class="toggle-icon">▼</span>
            <span>${dateDisplay}</span>
            <span class="task-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
          </div>
          ${!collapsed ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>📧</th>
                  <th>📋</th>
                  <th>📄</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th class="hide-mobile">Start</th>
                  <th class="hide-mobile">End</th>
                </tr>
              </thead>
              <tbody>
                ${tasks.map(t => this._renderRow(t)).join('')}
              </tbody>
            </table>
            <div class="p-sm">
              <button class="btn btn-ghost btn-sm add-task-to-group" data-date="${date}">+ Add Task</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  _renderRow(t) {
    const sc = this._statusClass(t.status);
    const pc = t.priority ? t.priority.toLowerCase() : 'medium';
    return `
      <tr data-task-id="${t.id}">
        <td style="max-width:250px" title="${this._escAttr(t.title)}">${this._esc(t.title)}</td>
        <td>${t.mailLink ? `<a href="${t.mailLink}" target="_blank" class="link-icon mail" title="Gmail" onclick="event.stopPropagation()">📧</a>` : '<span class="text-muted">—</span>'}</td>
        <td>${t.mondayLink ? `<a href="${t.mondayLink}" target="_blank" class="link-icon monday" title="Monday" onclick="event.stopPropagation()">📋</a>` : '<span class="text-muted">—</span>'}</td>
        <td>${t.docLink ? `<a href="${t.docLink}" target="_blank" class="link-icon doc" title="Doc" onclick="event.stopPropagation()">📄</a>` : '<span class="text-muted">—</span>'}</td>
        <td>${t.taskType ? `<span class="badge badge-type">${t.taskType}</span>` : ''}</td>
        <td><span class="badge badge-priority-${pc} status-badge-clickable" data-field="priority" data-task-id="${t.id}">${t.priority || 'Medium'}</span></td>
        <td>
          ${(t.owners || []).length > 0 ? `
            <div class="avatar-group">
              ${t.owners.slice(0, 3).map(o => `<div class="avatar avatar-sm" style="background:${hashColor(o)}" title="${o}">${getInitials(o)}</div>`).join('')}
            </div>
          ` : '<span class="text-muted">—</span>'}
        </td>
        <td><span class="badge badge-status-${sc} status-badge-clickable" data-field="status" data-task-id="${t.id}">${t.status}</span></td>
        <td class="hide-mobile font-mono text-xs text-muted">${t.startDate || '—'}</td>
        <td class="hide-mobile font-mono text-xs text-muted">${t.endDate || '—'}</td>
      </tr>
    `;
  }

  _renderEmpty() {
    return `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-title">No tasks found</div>
        <div class="empty-desc">Import your spreadsheet or create a new task to get started.</div>
        <button class="btn btn-primary mt-md" id="empty-import-btn">📥 Import CSV</button>
      </div>
    `;
  }

  _bindEvents(container) {
    // Search
    const searchInput = container.querySelector('#filter-search');
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        AppState.filters.search = e.target.value;
        this.render(container);
      }, 300);
    });

    // Filter dropdowns
    ['status', 'priority', 'owner', 'project', 'type'].forEach(key => {
      const el = container.querySelector(`#filter-${key}`);
      const stateKey = key === 'type' ? 'taskType' : key;
      el?.addEventListener('change', () => {
        AppState.filters[stateKey] = el.value;
        this.render(container);
      });
    });

    // Date group toggle
    container.querySelectorAll('.date-group-header').forEach(h => {
      h.addEventListener('click', () => {
        const date = h.dataset.date;
        if (this.collapsedGroups.has(date)) this.collapsedGroups.delete(date);
        else this.collapsedGroups.add(date);
        this.render(container);
      });
    });

    // Row click -> edit
    container.querySelectorAll('tr[data-task-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.status-badge-clickable')) return;
        if (e.target.closest('a')) return;
        const task = AppState.tasks.find(t => t.id === row.dataset.taskId);
        if (task) EventBus.emit('task:edit', task);
      });
    });

    // Inline status/priority quick-edit
    container.querySelectorAll('.status-badge-clickable').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showInlineDropdown(badge, container);
      });
    });

    // Add task to group
    container.querySelectorAll('.add-task-to-group').forEach(btn => {
      btn.addEventListener('click', () => {
        EventBus.emit('task:create', { dateGroup: btn.dataset.date });
      });
    });

    // Add date group
    container.querySelector('#add-date-group-btn')?.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      EventBus.emit('task:create', { dateGroup: today });
    });

    // FAB
    container.parentElement?.querySelector('#fab-add-task')?.addEventListener('click', () => {
      EventBus.emit('task:create', { dateGroup: new Date().toISOString().split('T')[0] });
    });

    // Empty import
    container.querySelector('#empty-import-btn')?.addEventListener('click', () => {
      EventBus.emit('import:open');
    });

    // Close inline dropdown on outside click
    document.addEventListener('click', () => this._closeInlineDropdown(), { once: true });
  }

  _showInlineDropdown(badge, container) {
    this._closeInlineDropdown();
    const field = badge.dataset.field;
    const taskId = badge.dataset.taskId;
    const options = field === 'status' ? CONFIG.STATUSES : CONFIG.PRIORITIES;
    const colorFn = field === 'status' ? getStatusColor : (p) => CONFIG.PRIORITY_COLORS[p] || '#6b7280';

    const rect = badge.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'inline-dropdown';
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;

    dropdown.innerHTML = options.map(opt => `
      <div class="inline-dropdown-item" data-value="${opt}">
        <span class="dot" style="background:${colorFn(opt)}"></span>
        ${opt}
      </div>
    `).join('');

    dropdown.querySelectorAll('.inline-dropdown-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const updates = {};
        updates[field] = item.dataset.value;
        await db.updateTask(taskId, updates);
        const tasks = await db.getAllTasks();
        AppState.tasks = tasks;
        EventBus.emit('tasks:updated');
        this._closeInlineDropdown();
        this.render(container);
        EventBus.emit('toast:show', { type: 'success', message: `${field === 'status' ? 'Status' : 'Priority'} updated` });
      });
    });

    document.body.appendChild(dropdown);
    this.inlineDropdown = dropdown;

    setTimeout(() => {
      document.addEventListener('click', () => this._closeInlineDropdown(), { once: true });
    }, 10);
  }

  _closeInlineDropdown() {
    if (this.inlineDropdown) {
      this.inlineDropdown.remove();
      this.inlineDropdown = null;
    }
  }

  _formatDateGroup(dateStr) {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  }

  _statusClass(status) {
    const map = { 'To Do': 'todo', 'In Progress': 'progress', 'Waiting': 'waiting', 'Approved': 'approved', 'Blocked': 'blocked', 'Completed': 'completed' };
    return map[status] || 'todo';
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
  _escAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}
