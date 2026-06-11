import { authService } from '../services/auth.js';
import { db } from '../services/database.js';
import { getInitials, hashColor } from '../config.js';

export class Sidebar {
  constructor() {
    this.collapsed = false;
    this._syncUnsubscribe = null;
  }

  render(container) {
    const user = AppState.user;
    const syncStatus = AppState.syncStatus || 'idle';
    const navItems = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'dailylog', icon: '📅', label: 'Daily Log' },
      { id: 'kanban', icon: '📋', label: 'Kanban Board' },
      { id: 'byperson', icon: '👥', label: 'By Person' },
      { id: 'emails', icon: '📧', label: 'Emails' },
      { id: 'taskdetails', icon: '🔍', label: 'Task Details' },
    ];

    const syncLabel = syncStatus === 'syncing' ? 'Syncing…' :
                      syncStatus === 'synced'  ? 'Synced' :
                      syncStatus === 'error'   ? 'Sync Error' : 'Not synced';
    const syncDotColor = syncStatus === 'syncing' ? '#eab308' :
                         syncStatus === 'synced'  ? '#22c55e' :
                         syncStatus === 'error'   ? '#ef4444' : '#6b7280';

    container.innerHTML = `
      <aside class="sidebar ${this.collapsed ? 'collapsed' : ''}" id="sidebar">
        <div class="sidebar-toggle" id="sidebar-toggle" title="Toggle sidebar">◀</div>
        <div class="sidebar-logo">
          <div class="logo-icon">✦</div>
          <span>TaskFlow</span>
        </div>
        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <div class="sidebar-nav-item ${AppState.currentView === item.id ? 'active' : ''}" data-view="${item.id}">
              <span class="nav-icon">${item.icon}</span>
              <span class="sidebar-text">${item.label}</span>
            </div>
          `).join('')}
        </nav>
        <div class="sidebar-divider"></div>
        <div class="sidebar-actions">
          <button class="btn btn-ghost btn-sm w-full" id="team-manage-btn" style="justify-content:flex-start">
            <span class="nav-icon">👥</span>
            <span class="sidebar-text">Manage Team</span>
          </button>
          <button class="btn btn-ghost btn-sm w-full" id="import-btn" style="justify-content:flex-start">
            <span class="nav-icon">📥</span>
            <span class="sidebar-text">Import CSV</span>
          </button>
          <button class="btn btn-ghost btn-sm w-full" id="export-btn" style="justify-content:flex-start">
            <span class="nav-icon">📤</span>
            <span class="sidebar-text">Export CSV</span>
          </button>
        </div>
        <div class="sidebar-divider"></div>

        <!-- Sync Status -->
        <div class="sidebar-sync" id="sidebar-sync" style="padding:var(--space-sm) var(--space-md); display:flex; align-items:center; gap:var(--space-sm); cursor:pointer;" title="Click to sync now">
          <span style="width:8px; height:8px; border-radius:50%; background:${syncDotColor}; flex-shrink:0; ${syncStatus === 'syncing' ? 'animation:pulse 1s ease-in-out infinite;' : ''}"></span>
          <span class="sidebar-text" style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-mono);">${syncLabel}</span>
          <button class="btn-icon btn-ghost sm" id="sync-now-btn" title="Sync Now" style="margin-left:auto; font-size:var(--text-xs);">🔄</button>
        </div>

        <div class="sidebar-divider"></div>
        <div class="sidebar-user">
          <div class="avatar" style="background:${user ? hashColor(user.email || '') : 'var(--accent-gradient)'}">
            ${user ? getInitials(user.name || user.email || '') : '?'}
          </div>
          <div class="sidebar-user-info">
            <div class="user-name">${user?.name || 'Not signed in'}</div>
            <div class="user-email">${user?.email || ''}</div>
          </div>
          <div class="flex gap-xs">
            <button class="btn-icon btn-ghost sm" id="switch-account-btn" title="Switch Account">🔄</button>
            <button class="btn-icon btn-ghost sm" id="signout-btn" title="Sign out">⏻</button>
          </div>
        </div>
      </aside>
    `;

    this._bindEvents(container);

    // Live-update sync status without re-rendering entire sidebar
    if (this._syncUnsubscribe) this._syncUnsubscribe();
    this._syncUnsubscribe = null;

    const syncEl = container.querySelector('#sidebar-sync');
    if (syncEl) {
      const handler = ({ status }) => {
        const label = status === 'syncing' ? 'Syncing…' :
                      status === 'synced'  ? 'Synced' :
                      status === 'error'   ? 'Sync Error' : 'Not synced';
        const dotColor = status === 'syncing' ? '#eab308' :
                         status === 'synced'  ? '#22c55e' :
                         status === 'error'   ? '#ef4444' : '#6b7280';

        const dot = syncEl.querySelector('span:first-child');
        const text = syncEl.querySelector('.sidebar-text');
        if (dot) {
          dot.style.background = dotColor;
          dot.style.animation = status === 'syncing' ? 'pulse 1s ease-in-out infinite' : 'none';
        }
        if (text) text.textContent = label;
      };
      EventBus.on('sync:changed', handler);
      this._syncUnsubscribe = () => EventBus.off('sync:changed', handler);
    }
  }

  _bindEvents(container) {
    // Nav items
    container.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        AppState.currentView = item.dataset.view;
        EventBus.emit('view:changed', item.dataset.view);
      });
    });

    // Toggle
    const toggle = container.querySelector('#sidebar-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        this.collapsed = !this.collapsed;
        const sidebar = container.querySelector('#sidebar');
        sidebar.classList.toggle('collapsed', this.collapsed);
        document.querySelector('.app-layout')?.classList.toggle('sidebar-collapsed', this.collapsed);
        toggle.textContent = this.collapsed ? '▶' : '◀';
      });
    }

    // Manage Team
    container.querySelector('#team-manage-btn')?.addEventListener('click', () => {
      EventBus.emit('team:manage');
    });

    // Import
    container.querySelector('#import-btn')?.addEventListener('click', () => {
      EventBus.emit('import:open');
    });

    // Export
    container.querySelector('#export-btn')?.addEventListener('click', async () => {
      const tasks = await db.exportTasks();
      const headers = ['Task', 'Task Type', 'Priority', 'Owner', 'Status', 'Project', 'Sub-Category', 'Start Date', 'End Date', 'Mail Link', 'Monday Link', 'Doc Link', 'Notes', 'Date Group'];
      const rows = tasks.map(t => [
        t.title, t.taskType, t.priority, (t.owners || []).join(' & '), t.status,
        t.project, t.subCategory, t.startDate, t.endDate,
        t.mailLink, t.mondayLink, t.docLink, t.notes, t.dateGroup
      ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taskflow-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      EventBus.emit('toast:show', { type: 'success', message: `Exported ${tasks.length} tasks` });
    });

    // Sign out
    container.querySelector('#signout-btn')?.addEventListener('click', () => {
      authService.signOut();
    });
    
    // Switch Account explicitly
    container.querySelector('#switch-account-btn')?.addEventListener('click', () => {
      authService.switchAccount();
    });
    
    // Switch Account by clicking user profile
    const userProfileEl = container.querySelector('.sidebar-user-info');
    if (userProfileEl) {
      userProfileEl.style.cursor = 'pointer';
      userProfileEl.title = 'Switch Account';
      userProfileEl.addEventListener('click', () => {
        authService.switchAccount();
      });
    }

    // Sync Now button
    container.querySelector('#sync-now-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      EventBus.emit('sync:trigger');
      EventBus.emit('toast:show', { type: 'info', message: 'Syncing with Google Drive…' });
    });

    // Clicking the sync area also triggers sync
    container.querySelector('#sidebar-sync')?.addEventListener('click', () => {
      EventBus.emit('sync:trigger');
      EventBus.emit('toast:show', { type: 'info', message: 'Syncing with Google Drive…' });
    });
  }
}

