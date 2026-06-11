import { CONFIG, getStatusColor, getInitials, hashColor } from '../config.js';

export class ByPerson {
  constructor() {
    this.expanded = new Set(CONFIG.TEAM_MEMBERS.slice(0, 3));
  }

  render(container) {
    const tasks = AppState.tasks || [];
    const byPerson = this._groupByPerson(tasks);

    container.innerHTML = `
      <div class="animate-fadeIn">
        <div class="person-grid">
          ${byPerson.map(([name, personTasks]) => this._renderPerson(name, personTasks)).join('')}
        </div>
      </div>
    `;

    this._bindEvents(container);
  }

  _groupByPerson(tasks) {
    const map = new Map();
    AppState.teamMembers.forEach(m => map.set(m, []));
    map.set('Unassigned', []);

    tasks.forEach(t => {
      if (!t.owners || t.owners.length === 0) {
        map.get('Unassigned').push(t);
      } else {
        t.owners.forEach(o => {
          if (!map.has(o)) map.set(o, []);
          map.get(o).push(t);
        });
      }
    });

    return Array.from(map.entries())
      .filter(([, tasks]) => tasks.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
  }

  _renderPerson(name, tasks) {
    const isExpanded = this.expanded.has(name);
    const statusCounts = {};
    CONFIG.STATUSES.forEach(s => statusCounts[s] = 0);
    tasks.forEach(t => { if (statusCounts[t.status] !== undefined) statusCounts[t.status]++; });

    return `
      <div class="person-section">
        <div class="person-header ${isExpanded ? 'expanded' : ''}" data-person="${name}">
          <div class="avatar" style="background:${hashColor(name)}">${getInitials(name)}</div>
          <div class="flex-col">
            <span class="font-semibold">${name}</span>
            <span class="text-xs text-muted">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="person-stats">
            ${CONFIG.STATUSES.filter(s => statusCounts[s] > 0).map(s => `
              <div style="display:flex;align-items:center;gap:3px;">
                <span class="person-stat-dot" style="background:${getStatusColor(s)}" title="${s}"></span>
                <span class="text-xs font-mono text-muted">${statusCounts[s]}</span>
              </div>
            `).join('')}
          </div>
          <span class="chevron">▶</span>
        </div>
        ${isExpanded ? `
          <div class="person-tasks">
            ${tasks.map(t => `
              <div class="person-task-row" data-task-id="${t.id}">
                <span class="badge badge-status-${this._statusClass(t.status)}">${t.status}</span>
                <span class="flex-1 truncate">${this._esc(t.title)}</span>
                ${t.priority ? `<span class="badge badge-priority-${t.priority.toLowerCase()}">${t.priority}</span>` : ''}
                ${t.project ? `<span class="text-xs text-accent">${t.project}</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  _bindEvents(container) {
    container.querySelectorAll('.person-header').forEach(h => {
      h.addEventListener('click', () => {
        const name = h.dataset.person;
        if (this.expanded.has(name)) this.expanded.delete(name);
        else this.expanded.add(name);
        this.render(container);
      });
    });

    container.querySelectorAll('.person-task-row').forEach(row => {
      row.addEventListener('click', () => {
        const task = AppState.tasks.find(t => t.id === row.dataset.taskId);
        if (task) EventBus.emit('task:edit', task);
      });
    });
  }

  _statusClass(s) {
    const map = { 'To Do': 'todo', 'In Progress': 'progress', 'Waiting': 'waiting', 'Approved': 'approved', 'Blocked': 'blocked', 'Completed': 'completed' };
    return map[s] || 'todo';
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}
