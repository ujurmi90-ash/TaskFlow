import { CONFIG, getStatusColor, getPriorityColor, getInitials, hashColor } from '../config.js';

export class Dashboard {
  render(container) {
    const tasks = this._getFilteredTasks();
    const stats = this._computeStats(tasks);

    container.innerHTML = `
      <div class="animate-fadeIn">
        ${this._renderStats(stats)}
        <div class="dashboard-grid">
          <div>
            ${this._renderRecentTasks(tasks)}
            ${this._renderOverdue(tasks)}
          </div>
          <div>
            ${this._renderProgress(stats)}
            ${this._renderWorkload(tasks)}
            ${this._renderPriorityBreakdown(tasks)}
          </div>
        </div>
      </div>
    `;

    this._bindEvents(container);
  }

  _getFilteredTasks() {
    return AppState.tasks || [];
  }

  _computeStats(tasks) {
    const total = tasks.length;
    const byStatus = {};
    CONFIG.STATUSES.forEach(s => byStatus[s] = 0);
    tasks.forEach(t => { if (byStatus[t.status] !== undefined) byStatus[t.status]++; });
    const completedPct = total > 0 ? Math.round((byStatus['Completed'] / total) * 100) : 0;
    return { total, byStatus, completedPct };
  }

  _renderStats(stats) {
    const cards = [
      { label: 'Total Tasks', value: stats.total, icon: '📋', color: 'var(--accent-primary)' },
      { label: 'In Progress', value: stats.byStatus['In Progress'], icon: '🔄', color: 'var(--status-progress)' },
      { label: 'Waiting', value: stats.byStatus['Waiting'], icon: '⏳', color: 'var(--status-waiting)' },
      { label: 'Completed', value: stats.byStatus['Completed'], icon: '✅', color: 'var(--status-completed)' },
    ];

    return `
      <div class="stats-grid">
        ${cards.map(c => `
          <div class="stat-card" style="--card-color:${c.color}">
            <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${c.color};border-radius:4px 0 0 4px;"></div>
            <div class="stat-value" style="color:${c.color}">${c.value}</div>
            <div class="stat-label">${c.label}</div>
            <div class="stat-icon">${c.icon}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderProgress(stats) {
    const pct = stats.completedPct;
    const r = 54, c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;

    return `
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">Completion</h3></div>
        <div class="flex-center p-md">
          <div class="progress-ring-container">
            <svg width="140" height="140" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--bg-glass-heavy)" stroke-width="10"/>
              <circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#progressGrad)" stroke-width="10"
                stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1s ease"/>
              <defs><linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--accent-primary)"/>
                <stop offset="100%" stop-color="var(--accent-secondary)"/>
              </linearGradient></defs>
            </svg>
            <span class="progress-ring-text text-gradient">${pct}%</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderWorkload(tasks) {
    const ownerCounts = {};
    CONFIG.TEAM_MEMBERS.forEach(m => ownerCounts[m] = 0);
    tasks.forEach(t => (t.owners || []).forEach(o => { if (ownerCounts[o] !== undefined) ownerCounts[o]++; }));
    const max = Math.max(...Object.values(ownerCounts), 1);
    const sorted = Object.entries(ownerCounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) return '';

    return `
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">Team Workload</h3></div>
        ${sorted.map(([name, count]) => `
          <div class="workload-bar">
            <span class="bar-label">${name}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
            <span class="bar-count">${count}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderPriorityBreakdown(tasks) {
    const counts = {};
    CONFIG.PRIORITIES.forEach(p => counts[p] = 0);
    tasks.forEach(t => { if (counts[t.priority] !== undefined) counts[t.priority]++; });

    return `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Priority</h3></div>
        <div class="flex-col gap-sm">
          ${CONFIG.PRIORITIES.map(p => `
            <div class="flex items-center gap-sm">
              <span class="badge badge-priority-${p.toLowerCase()}">${p}</span>
              <span class="text-sm text-muted ml-auto font-mono">${counts[p]}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderRecentTasks(tasks) {
    const recent = tasks.slice(0, 10);
    if (recent.length === 0) {
      return `
        <div class="card mb-lg">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">No tasks yet</div>
            <div class="empty-desc">Import your spreadsheet or create tasks from Gmail to get started.</div>
            <button class="btn btn-primary mt-md" id="dash-import-btn">📥 Import CSV</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">Recent Tasks</h3></div>
        <div class="task-mini-list">
          ${recent.map(t => `
            <div class="task-mini-item" data-task-id="${t.id}">
              <span class="badge badge-status-${this._statusClass(t.status)} status-badge-clickable" data-task-id="${t.id}">${t.status}</span>
              <span class="task-mini-title">${this._escHtml(t.title)}</span>
              ${t.priority ? `<span class="badge badge-priority-${t.priority.toLowerCase()}">${t.priority}</span>` : ''}
              ${t.owners?.length ? `
                <div class="avatar-group">
                  ${t.owners.slice(0, 2).map(o => `<div class="avatar avatar-sm" style="background:${hashColor(o)}" title="${o}">${getInitials(o)}</div>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderOverdue(tasks) {
    const today = new Date().toISOString().split('T')[0];
    const overdue = tasks.filter(t => t.endDate && t.endDate < today && t.status !== 'Completed');
    if (overdue.length === 0) return '';

    return `
      <div class="card" style="border-color:rgba(239,68,68,0.3)">
        <div class="card-header"><h3 class="card-title" style="color:var(--error)">⚠ Overdue (${overdue.length})</h3></div>
        <div class="task-mini-list">
          ${overdue.slice(0, 5).map(t => `
            <div class="task-mini-item" data-task-id="${t.id}">
              <span class="badge badge-status-blocked">Overdue</span>
              <span class="task-mini-title">${this._escHtml(t.title)}</span>
              <span class="text-xs font-mono text-muted">${t.endDate}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _bindEvents(container) {
    container.querySelectorAll('.task-mini-item[data-task-id]').forEach(el => {
      el.addEventListener('click', () => {
        const task = AppState.tasks.find(t => t.id === el.dataset.taskId);
        if (task) EventBus.emit('task:edit', task);
      });
    });

    container.querySelector('#dash-import-btn')?.addEventListener('click', () => {
      EventBus.emit('import:open');
    });
  }

  _statusClass(status) {
    const map = { 'To Do': 'todo', 'In Progress': 'progress', 'Waiting': 'waiting', 'Approved': 'approved', 'Blocked': 'blocked', 'Completed': 'completed' };
    return map[status] || 'todo';
  }

  _escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
