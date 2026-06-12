import { CONFIG, getStatusColor, getPriorityColor, getInitials, hashColor } from '../config.js';
import { db } from '../services/database.js';

export class MyTasks {
  constructor() {
    this.expandedSections = new Set(['To Do', 'In Progress', 'Waiting']);
  }

  render(container) {
    const user = AppState.user || {};
    const userEmail = (user.email || '').toLowerCase();
    const userName = (user.name || '').toLowerCase();

    // Match identity against the team directory
    const myMember = (AppState.teamMembers || []).find(m => {
      const mName = typeof m === 'object' && m !== null ? m.name : m;
      const mEmail = typeof m === 'object' && m !== null ? m.email : '';
      return mEmail.toLowerCase() === userEmail || mName.toLowerCase() === userName;
    });

    const myName = myMember ? (typeof myMember === 'object' ? myMember.name : myMember) : null;

    if (!myName) {
      container.innerHTML = `
        <div class="empty-state animate-fadeIn" style="margin:var(--space-xl) auto; max-width:600px;">
          <div class="empty-icon" style="margin-bottom:var(--space-xs);">👤</div>
          <div class="empty-title">Workspace Profile Setup Required</div>
          <div class="empty-desc" style="margin-bottom:var(--space-md);">
            You are signed in as <strong style="color:var(--text-primary);">${this._esc(user.name || 'Unknown User')}</strong> (${this._esc(user.email || '')}). 
            However, your profile is not linked in the team directory yet.
          </div>
          
          <div style="background:var(--bg-card); border:1px solid var(--border-color); padding:var(--space-md); border-radius:var(--radius-md); text-align:left; font-size:var(--text-sm); line-height:1.5; margin-bottom:var(--space-md);">
            <p style="font-weight:700; margin-bottom:var(--space-sm); color:var(--text-primary);">Are you one of the team members below? Click to link your account:</p>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:var(--space-xs); margin-bottom:var(--space-md);">
              ${(AppState.teamMembers || []).map(m => {
                const name = typeof m === 'object' && m !== null ? m.name : m;
                const email = typeof m === 'object' && m !== null ? m.email : '';
                const role = typeof m === 'object' && m !== null ? m.role : '';
                return `
                  <button class="btn btn-ghost btn-sm link-member-profile-btn" data-member-name="${this._escAttr(name)}" style="background:var(--bg-glass); border:1px solid var(--border-color); display:flex; flex-direction:column; align-items:flex-start; text-align:left; padding:8px 12px; gap:2px; height:auto; width:100%; border-radius:var(--radius-md);">
                    <span style="font-weight:600; color:var(--text-primary); font-size:var(--text-sm);">${this._esc(name)}</span>
                    <span style="font-size:10px; color:var(--text-muted);">${this._esc(role || 'Team Member')}</span>
                    ${email ? `
                      <span style="font-size:10px; color:var(--accent-primary); font-family:var(--font-mono);">${this._esc(email)}</span>
                    ` : `
                      <span style="font-size:10px; color:var(--warning); font-style:italic;">No email configured</span>
                    `}
                  </button>
                `;
              }).join('')}
            </div>
            
            <p style="font-weight:700; margin-bottom:var(--space-xs); color:var(--text-primary);">Or create a new profile with your signed-in name:</p>
            <div class="flex gap-sm">
              <input class="form-input" id="new-member-profile-name" value="${this._escAttr(user.name || '')}" placeholder="Your display name..." style="flex:1;" />
              <button class="btn btn-primary" id="btn-create-new-profile" style="background:var(--accent-gradient); border:none; white-space:nowrap; padding:0 var(--space-md);">Create & Link</button>
            </div>
          </div>

          <button class="btn btn-ghost" id="btn-configure-team-profile">👥 Manage Team Directory</button>
        </div>
      `;
      this._bindSetupEvents(container, user);
      return;
    }

    // Filter tasks assigned to the current user
    const tasks = AppState.tasks || [];
    const myTasks = tasks.filter(t => (t.owners || []).includes(myName));
    const stats = this._computeStats(myTasks);

    container.innerHTML = `
      <div class="animate-fadeIn">
        
        <!-- Welcome Header -->
        <div class="mb-lg flex-between flex-wrap gap-md" style="border-bottom:1px solid var(--border-color); padding-bottom:var(--space-md);">
          <div>
            <h2 class="text-2xl font-bold text-primary">Hi, ${this._esc(myName)}!</h2>
            <p class="text-sm text-muted">Here is your personal tasks workspace overview.</p>
          </div>
          <div class="flex items-center gap-xs">
            <span class="text-xs font-mono text-muted" style="background:var(--bg-glass); padding:4px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
              EMAIL: ${this._esc(user.email)}
            </span>
          </div>
        </div>

        <!-- Dashboard Widgets Grid -->
        <div class="dashboard-grid mb-lg">
          <div>
            <!-- Personal Stats Cards -->
            ${this._renderStatsCards(stats)}
            
            <!-- Collapsible Task List -->
            ${this._renderCollapsibleTasks(myTasks)}
          </div>

          <div>
            <!-- Personal Completion Progress -->
            ${this._renderProgressRing(stats)}

            <!-- Overdue Tasks -->
            ${this._renderOverdue(myTasks)}
          </div>
        </div>

      </div>
    `;

    this._bindDashboardEvents(container);
  }

  _computeStats(tasks) {
    const total = tasks.length;
    const byStatus = {};
    CONFIG.STATUSES.forEach(s => byStatus[s] = 0);
    tasks.forEach(t => { if (byStatus[t.status] !== undefined) byStatus[t.status]++; });
    const completedPct = total > 0 ? Math.round((byStatus['Completed'] / total) * 100) : 0;
    return { total, byStatus, completedPct };
  }

  _renderStatsCards(stats) {
    const cards = [
      { label: 'Assigned Tasks', value: stats.total, icon: '📋', color: 'var(--accent-primary)' },
      { label: 'In Progress', value: stats.byStatus['In Progress'], icon: '🔄', color: 'var(--status-progress)' },
      { label: 'Waiting', value: stats.byStatus['Waiting'], icon: '⏳', color: 'var(--status-waiting)' },
      { label: 'Completed', value: stats.byStatus['Completed'], icon: '✅', color: 'var(--status-completed)' },
    ];

    return `
      <div class="stats-grid mb-lg">
        ${cards.map(c => `
          <div class="stat-card" style="--card-color:${c.color}; min-height:85px; padding:var(--space-md);">
            <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${c.color};border-radius:4px 0 0 4px;"></div>
            <div class="stat-value" style="color:${c.color}; font-size:var(--text-2xl);">${c.value}</div>
            <div class="stat-label" style="font-size:var(--text-xs);">${c.label}</div>
            <div class="stat-icon" style="font-size:1.5rem; opacity:0.25;">${c.icon}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderProgressRing(stats) {
    const pct = stats.completedPct;
    const r = 54, c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;

    return `
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">My Completion Rate</h3></div>
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
            <span class="progress-ring-text text-gradient" style="font-size:var(--text-xl); font-weight:800;">${pct}%</span>
          </div>
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
        <div class="card-header"><h3 class="card-title" style="color:var(--error)">⚠ Overdue Tasks (${overdue.length})</h3></div>
        <div class="task-mini-list">
          ${overdue.slice(0, 8).map(t => `
            <div class="task-mini-item" data-task-id="${t.id}" style="border-left: 3px solid var(--error);">
              <span class="task-mini-title" style="font-weight:600;">${this._esc(t.title)}</span>
              <span class="text-xs font-mono text-muted" style="margin-left:auto;">Due: ${t.endDate}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderCollapsibleTasks(myTasks) {
    if (myTasks.length === 0) {
      return `
        <div class="card">
          <div class="empty-state" style="padding:var(--space-2xl) var(--space-md);">
            <div class="empty-icon">🎉</div>
            <div class="empty-title">All caught up!</div>
            <div class="empty-desc">You don't have any tasks assigned to you in this workspace.</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="flex-col gap-md">
        ${CONFIG.STATUSES.map(s => {
          const list = myTasks.filter(t => t.status === s);
          if (list.length === 0) return '';
          const isExpanded = this.expandedSections.has(s);
          
          return `
            <div class="card" style="border-color:rgba(255,255,255,0.06); overflow:hidden;">
              <div class="card-header flex-between cursor-pointer mytasks-section-header" data-status="${s}" style="padding:var(--space-md) var(--space-lg); background:rgba(255,255,255,0.01);">
                <div class="flex items-center gap-sm">
                  <span style="width:10px; height:10px; border-radius:50%; background:${getStatusColor(s)};"></span>
                  <h3 class="card-title" style="font-size:var(--text-sm); font-weight:700;">${s}</h3>
                  <span class="badge" style="background:var(--bg-glass-heavy); border:1px solid var(--border-color); font-size:var(--text-xs); color:var(--text-secondary); padding:2px 8px;">
                    ${list.length}
                  </span>
                </div>
                <span class="chevron" style="transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform var(--transition-fast); color:var(--text-muted);">▶</span>
              </div>
              
              ${isExpanded ? `
                <div class="task-mini-list" style="padding:var(--space-sm); border-top:1px solid var(--border-color); gap:4px;">
                  ${list.map(t => `
                    <div class="task-mini-item" data-task-id="${t.id}" style="padding:var(--space-md); border:1px solid var(--border-color); background:var(--bg-card); transition: all var(--transition-fast);">
                      <div class="flex-col flex-1 min-width:0;">
                        <span class="task-mini-title" style="font-weight:600; color:var(--text-primary);">${this._esc(t.title)}</span>
                        <div class="flex items-center gap-xs mt-sm flex-wrap">
                          <span class="badge badge-priority-${t.priority.toLowerCase()}">${t.priority}</span>
                          ${t.project ? `<span class="text-xs text-accent" style="font-family:var(--font-mono);">${t.project}</span>` : ''}
                          ${t.endDate ? `<span class="text-xs text-muted" style="margin-left:auto; font-family:var(--font-mono);">Due: ${t.endDate}</span>` : ''}
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _bindSetupEvents(container, user) {
    container.querySelector('#btn-configure-team-profile')?.addEventListener('click', () => {
      EventBus.emit('team:manage');
    });

    // Link profile button click handler
    container.querySelectorAll('.link-member-profile-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.memberName;
        const email = user.email || '';
        if (!name || !email) return;

        try {
          const members = (AppState.teamMembers || []).map(m => {
            const mName = typeof m === 'object' && m !== null ? m.name : m;
            const mEmail = typeof m === 'object' && m !== null ? m.email : '';
            const mRole = typeof m === 'object' && m !== null ? m.role : '';
            if (mName.toLowerCase() === name.toLowerCase()) {
              return { name: mName, email: email, role: mRole };
            }
            return typeof m === 'object' ? m : { name: mName, email: mEmail, role: mRole };
          });

          await db.saveTeamMembers(members);
          AppState.teamMembers = members;
          EventBus.emit('team:updated');
          EventBus.emit('tasks:updated');
          EventBus.emit('toast:show', { type: 'success', message: `Linked your account to ${name}!` });
        } catch (err) {
          EventBus.emit('toast:show', { type: 'error', message: 'Failed to link: ' + err.message });
        }
      });
    });

    // Create & link new profile
    container.querySelector('#btn-create-new-profile')?.addEventListener('click', async () => {
      const nameInput = container.querySelector('#new-member-profile-name');
      const name = nameInput?.value.trim();
      const email = user.email || '';
      
      if (!name) {
        EventBus.emit('toast:show', { type: 'error', message: 'Name is required' });
        return;
      }

      try {
        const members = (AppState.teamMembers || []).map(m => {
          if (typeof m === 'object' && m !== null) return { ...m };
          return { name: m, email: '', role: '' };
        });

        if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
          EventBus.emit('toast:show', { type: 'info', message: 'A profile with that name already exists. Please click it in the list above to link.' });
          return;
        }

        members.push({ name, email, role: 'Team Member' });

        await db.saveTeamMembers(members);
        AppState.teamMembers = members;
        EventBus.emit('team:updated');
        EventBus.emit('tasks:updated');
        EventBus.emit('toast:show', { type: 'success', message: `Created and linked profile for ${name}!` });
      } catch (err) {
        EventBus.emit('toast:show', { type: 'error', message: 'Failed to create: ' + err.message });
      }
    });
  }

  _escAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  _bindDashboardEvents(container) {
    // Collapsible header toggler
    container.querySelectorAll('.mytasks-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const status = header.dataset.status;
        if (this.expandedSections.has(status)) {
          this.expandedSections.delete(status);
        } else {
          this.expandedSections.add(status);
        }
        this.render(container);
      });
    });

    // Task edit modals click bindings
    container.querySelectorAll('.task-mini-item[data-task-id]').forEach(item => {
      item.addEventListener('click', () => {
        const task = AppState.tasks.find(t => t.id === item.dataset.taskId);
        if (task) {
          EventBus.emit('task:edit', task);
        }
      });
    });
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}
