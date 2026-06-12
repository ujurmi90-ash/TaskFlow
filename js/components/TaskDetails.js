import { CONFIG, getStatusColor, getPriorityColor, getInitials, hashColor, classifyLink, formatDate } from '../config.js';
import { gmailService } from '../services/gmail.js';
import { db } from '../services/database.js';

export class TaskDetails {
  constructor() {
    this.selectedTaskId = null;
    this.searchQuery = '';
    this.filters = {
      status: '',
      priority: '',
      project: '',
      owner: ''
    };
    this.loadingEmail = false;
    this.customProjects = null;

    // Reset cached custom projects on any database / sync updates
    EventBus.on('tasks:updated', () => {
      this.customProjects = null;
    });
  }

  render(container) {
    // Fetch custom projects if not cached yet
    if (this.customProjects === null) {
      db.getCustomProjects().then(projects => {
        this.customProjects = projects;
        this.render(container);
      }).catch(err => {
        console.error('Failed to load custom projects:', err);
        this.customProjects = [];
        this.render(container);
      });
      container.innerHTML = '<div class="text-center p-xl text-muted">Loading workspace details…</div>';
      return;
    }

    const tasks = AppState.tasks || [];
    
    // Combine default projects, custom database projects, and any projects currently on tasks
    const allProjects = Array.from(new Set([
      ...CONFIG.DEFAULT_PROJECTS,
      ...(this.customProjects || []),
      ...tasks.map(t => t.project).filter(Boolean)
    ])).sort();

    // Fetch team members list (custom team members + default fallbacks)
    const teamMembers = AppState.teamMembers || CONFIG.TEAM_MEMBERS;

    // Filter tasks
    const filteredTasks = tasks.filter(t => {
      if (this.filters.status && t.status !== this.filters.status) return false;
      if (this.filters.priority && t.priority !== this.filters.priority) return false;
      if (this.filters.project && t.project !== this.filters.project) return false;
      if (this.filters.owner && !(t.owners || []).includes(this.filters.owner)) return false;
      
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const titleMatch = (t.title || '').toLowerCase().includes(query);
        const notesMatch = (t.notes || '').toLowerCase().includes(query);
        const subCatMatch = (t.subCategory || '').toLowerCase().includes(query);
        const typeMatch = (t.taskType || '').toLowerCase().includes(query);
        if (!titleMatch && !notesMatch && !subCatMatch && !typeMatch) return false;
      }
      return true;
    });

    const selectedTask = tasks.find(t => t.id === this.selectedTaskId);
    const hasSelectionClass = selectedTask ? 'show-detail' : '';

    container.innerHTML = `
      <div class="task-details-view ${hasSelectionClass} animate-fadeIn">
        
        <!-- Left Pane: Sidebar list of tasks -->
        <div class="task-details-sidebar">
          <div class="task-details-sidebar-header">
            <div class="search-bar" style="max-width:100%;">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search title or notes..." id="task-search-input" value="${this._escAttr(this.searchQuery)}" />
            </div>
            
            <div class="task-details-filters">
              <select class="form-select" id="filter-status" title="Filter by Status">
                <option value="">All Statuses</option>
                ${CONFIG.STATUSES.map(s => `<option value="${s}" ${this.filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              
              <select class="form-select" id="filter-priority" title="Filter by Priority">
                <option value="">All Priorities</option>
                ${CONFIG.PRIORITIES.map(p => `<option value="${p}" ${this.filters.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
              
              <select class="form-select" id="filter-project" title="Filter by Project">
                <option value="">All Projects</option>
                ${allProjects.map(p => `<option value="${p}" ${this.filters.project === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
              
              <select class="form-select" id="filter-owner" title="Filter by Owner">
                <option value="">All Owners</option>
                ${teamMembers.map(m => {
                  const name = typeof m === 'object' && m !== null ? m.name : m;
                  return `<option value="${name}" ${this.filters.owner === name ? 'selected' : ''}>${name}</option>`;
                }).join('')}
              </select>
            </div>

            <!-- Quick Action Buttons -->
            <div class="flex gap-xs mt-sm" style="border-top:1px solid var(--border-color); padding-top:var(--space-sm);">
              <button class="btn btn-ghost btn-xs text-xs" id="quick-add-project-btn" style="padding:4px 8px; font-size:var(--text-xs); border-radius:var(--radius-sm);" title="Add New Project">+ Project</button>
              <button class="btn btn-ghost btn-xs text-xs" id="quick-add-person-btn" style="padding:4px 8px; font-size:var(--text-xs); border-radius:var(--radius-sm);" title="Manage Team Members">+ Person</button>
              <button class="btn btn-primary btn-xs text-xs ml-auto" id="quick-add-task-btn" style="padding:4px 8px; font-size:var(--text-xs); border-radius:var(--radius-sm); background:var(--accent-gradient); border:none;" title="Create New Task">+ Task</button>
            </div>
          </div>
          
          <div class="task-details-list">
            ${filteredTasks.map(t => {
              const isSelected = t.id === this.selectedTaskId;
              return `
                <div class="task-details-item ${isSelected ? 'active' : ''}" data-task-id="${t.id}">
                  <div class="task-details-item-title">${this._escHtml(t.title)}</div>
                  <div class="task-details-item-meta">
                    <span class="badge badge-status-${this._statusClass(t.status)}">${t.status}</span>
                    <span class="badge badge-priority-${t.priority.toLowerCase()}">${t.priority}</span>
                    ${t.project ? `<span class="text-xs text-accent truncate" style="max-width:80px;">${t.project}</span>` : ''}
                    
                    ${t.owners && t.owners.length > 0 ? `
                      <div class="avatar-group ml-auto">
                        ${t.owners.map(o => `
                          <div class="avatar avatar-sm" style="background:${hashColor(o)}" title="${o}">
                            ${getInitials(o)}
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
            ${filteredTasks.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-xl) var(--space-md);">
                <div class="empty-icon" style="font-size:2rem;">📋</div>
                <div class="empty-title" style="font-size:var(--text-sm);">No tasks found</div>
                <div class="empty-desc" style="font-size:var(--text-xs);">Try adjusting your search query or filters.</div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Right Pane: Main Task details inspector -->
        <div class="task-details-content">
          ${selectedTask ? this._renderTaskDetail(selectedTask) : `
            <div class="empty-state" style="margin:auto;">
              <div class="empty-icon" style="font-size:4rem;">👁️</div>
              <div class="empty-title">Inspect Task Details</div>
              <div class="empty-desc">Select a task from the list on the left to see its full details, notes, links, and original email context.</div>
            </div>
          `}
        </div>

      </div>
    `;

    this._bindEvents(container);
  }

  _renderTaskDetail(t) {
    const startDateStr = t.startDate ? formatDate(t.startDate) : 'Not specified';
    const endDateStr = t.endDate ? formatDate(t.endDate) : 'Not specified';
    const dateGroupStr = t.dateGroup ? formatDate(t.dateGroup) : 'Not specified';
    
    // Links list
    const links = [];
    if (t.mailLink) links.push({ url: t.mailLink, type: 'mail', label: 'Gmail Reference' });
    if (t.mondayLink) links.push({ url: t.mondayLink, type: 'monday', label: 'Monday.com Item' });
    if (t.docLink) links.push({ url: t.docLink, type: 'doc', label: 'Attached Document' });

    return `
      <!-- Header Area -->
      <div class="task-details-header">
        <div class="flex items-center gap-sm">
          <button class="btn-icon btn-ghost task-details-back-btn" id="task-back-to-list-btn" title="Back to List" style="display:none; margin-right:var(--space-xs);">
            ←
          </button>
          <div class="task-details-project-tag">
            ${t.project || 'Uncategorized'} ${t.subCategory ? `• ${t.subCategory}` : ''}
          </div>
        </div>
        <h2 class="task-details-title">${this._escHtml(t.title)}</h2>
        <div class="task-details-badges">
          <span class="badge badge-status-${this._statusClass(t.status)}" style="font-size:var(--text-xs); padding:4px 10px;">
            ${t.status}
          </span>
          <span class="badge badge-priority-${t.priority.toLowerCase()}" style="font-size:var(--text-xs); padding:4px 10px;">
            Priority: ${t.priority}
          </span>
          ${t.taskType ? `<span class="badge badge-secondary" style="font-size:var(--text-xs); padding:4px 10px; background:var(--bg-glass-heavy); border:1px solid var(--border-color);">${t.taskType}</span>` : ''}
        </div>
      </div>

      <!-- Detail Info Grid -->
      <div class="task-details-grid">
        <div class="task-details-field">
          <div class="task-details-field-label">PROJECT</div>
          <div class="task-details-field-value">${t.project || '—'}</div>
        </div>
        <div class="task-details-field">
          <div class="task-details-field-label">SUB-CATEGORY</div>
          <div class="task-details-field-value">${t.subCategory || '—'}</div>
        </div>
        <div class="task-details-field">
          <div class="task-details-field-label">TASK TYPE</div>
          <div class="task-details-field-value">${t.taskType || '—'}</div>
        </div>
        <div class="task-details-field">
          <div class="task-details-field-label">START DATE</div>
          <div class="task-details-field-value">${startDateStr}</div>
        </div>
        <div class="task-details-field">
          <div class="task-details-field-label">END DATE</div>
          <div class="task-details-field-value">${endDateStr}</div>
        </div>
        <div class="task-details-field">
          <div class="task-details-field-label">DATE GROUP</div>
          <div class="task-details-field-value">${dateGroupStr}</div>
        </div>
      </div>

      <!-- Assignees (Owners) -->
      <div class="task-details-owners-section">
        <div class="task-details-section-title">👥 Assigned Owners</div>
        <div class="flex flex-wrap gap-sm" style="margin-top:var(--space-xs);">
          ${t.owners && t.owners.length > 0 ? t.owners.map(o => `
            <div class="flex items-center gap-xs" style="background:var(--bg-glass); border:1px solid var(--border-color); padding:6px 12px; border-radius:var(--radius-full);">
              <div class="avatar avatar-sm" style="background:${hashColor(o)}">${getInitials(o)}</div>
              <span class="text-sm font-semibold">${o}</span>
            </div>
          `).join('') : `
            <div class="text-sm text-muted">Unassigned</div>
          `}
        </div>
      </div>

      <!-- Notes Block -->
      <div class="task-details-notes-section">
        <div class="task-details-section-title">📝 Notes</div>
        <div class="task-details-notes-card">
          ${this._escHtml(t.notes) || '<span class="text-muted" style="font-style:italic;">No notes provided for this task.</span>'}
        </div>
      </div>

      <!-- Attached URLs -->
      ${links.length > 0 ? `
        <div class="task-details-links-section">
          <div class="task-details-section-title">🔗 External Resources</div>
          <div class="flex flex-col gap-sm" style="margin-top:var(--space-xs);">
            ${links.map(l => `
              <a href="${l.url}" target="_blank" class="task-details-link-card">
                <span class="link-icon ${l.type}" style="font-size:1.2rem; flex-shrink:0;">
                  ${l.type === 'mail' ? '📧' : l.type === 'monday' ? '📋' : '📄'}
                </span>
                <div class="flex-1 min-width:0;">
                  <div class="task-details-link-title">${l.label}</div>
                  <div class="task-details-link-url">${l.url}</div>
                </div>
                <span class="text-muted text-xs">↗</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Email Context card if created from email -->
      ${t.emailId ? `
        <div class="task-details-email-card">
          <div class="flex-col gap-xs">
            <div style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--accent-primary); font-weight:700;">
              📧 LINKED EMAIL CONTEXT
            </div>
            <div style="font-weight:600; font-size:var(--text-sm); color:var(--text-primary); margin-top:2px;">
              Subject: ${this._escHtml(t.emailSubject || '(no subject)')}
            </div>
            <div style="font-size:var(--text-xs); color:var(--text-secondary);">
              Sender: ${this._escHtml(t.emailFrom || 'Unknown')}
            </div>
            <button class="btn btn-primary btn-sm mt-md" id="view-linked-email-btn" data-email-id="${t.emailId}" style="width:fit-content; align-self:flex-start;" ${this.loadingEmail ? 'disabled' : ''}>
              ${this.loadingEmail ? 'Loading Email…' : 'View Original Email'}
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Actions Footer -->
      <div class="task-details-actions">
        <button class="btn btn-danger" id="task-details-delete-btn">Delete Task</button>
        <div class="flex-1"></div>
        <button class="btn btn-primary" id="task-details-edit-btn">Edit Task</button>
      </div>
    `;
  }

  _bindEvents(container) {
    // Search input handler
    const searchInput = container.querySelector('#task-search-input');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.render(container);
      // Keep focus on the search input when drawing list again
      const input = container.querySelector('#task-search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });

    // Filters
    const handleFilterChange = (selector, filterKey) => {
      container.querySelector(selector)?.addEventListener('change', (e) => {
        this.filters[filterKey] = e.target.value;
        this.render(container);
      });
    };
    handleFilterChange('#filter-status', 'status');
    handleFilterChange('#filter-priority', 'priority');
    handleFilterChange('#filter-project', 'project');
    handleFilterChange('#filter-owner', 'owner');

    // Quick add actions
    container.querySelector('#quick-add-project-btn')?.addEventListener('click', async () => {
      const name = prompt('Enter new project name:');
      if (name && name.trim()) {
        const trimmed = name.trim();
        try {
          await db.addCustomProject(trimmed);
          this.customProjects = null; // force reload
          this.render(container);
          EventBus.emit('toast:show', { type: 'success', message: 'Project added: ' + trimmed });
        } catch (err) {
          EventBus.emit('toast:show', { type: 'error', message: 'Failed to add project: ' + err.message });
        }
      }
    });

    container.querySelector('#quick-add-person-btn')?.addEventListener('click', () => {
      EventBus.emit('team:manage');
    });

    container.querySelector('#quick-add-task-btn')?.addEventListener('click', () => {
      EventBus.emit('task:create', {
        dateGroup: new Date().toISOString().split('T')[0]
      });
    });

    // Task list items click selection
    container.querySelectorAll('.task-details-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectedTaskId = item.dataset.taskId;
        this.render(container);
      });
    });

    // Back to list button (for mobile view)
    container.querySelector('#task-back-to-list-btn')?.addEventListener('click', () => {
      this.selectedTaskId = null;
      this.render(container);
    });

    // Edit Task button click trigger
    container.querySelector('#task-details-edit-btn')?.addEventListener('click', () => {
      const selectedTask = AppState.tasks.find(t => t.id === this.selectedTaskId);
      if (selectedTask) {
        EventBus.emit('task:edit', selectedTask);
      }
    });

    // Delete Task button click trigger
    container.querySelector('#task-details-delete-btn')?.addEventListener('click', async () => {
      const selectedTask = AppState.tasks.find(t => t.id === this.selectedTaskId);
      if (!selectedTask) return;
      if (!confirm('Are you sure you want to delete this task?')) return;

      try {
        await db.deleteTask(selectedTask.id);
        const tasks = await db.getAllTasks();
        AppState.tasks = tasks;
        EventBus.emit('tasks:updated');
        EventBus.emit('toast:show', { type: 'info', message: 'Task deleted' });
        this.selectedTaskId = null;
        this.render(container);
      } catch (err) {
        EventBus.emit('toast:show', { type: 'error', message: 'Failed to delete task: ' + err.message });
      }
    });

    // View Original Email context loader
    container.querySelector('#view-linked-email-btn')?.addEventListener('click', async (e) => {
      const emailId = e.target.dataset.emailId;
      if (!emailId || this.loadingEmail) return;

      this.loadingEmail = true;
      this.render(container);

      try {
        const email = await gmailService.fetchMessage(emailId);
        EventBus.emit('email:open', email);
      } catch (err) {
        console.error('Failed to load original email:', err);
        EventBus.emit('toast:show', { type: 'error', message: 'Failed to open original email: ' + err.message });
      }

      this.loadingEmail = false;
      this.render(container);
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

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
