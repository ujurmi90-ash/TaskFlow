import { CONFIG, getStatusColor, getPriorityColor, getInitials, hashColor } from '../config.js';
import { db } from '../services/database.js';

export class KanbanBoard {
  render(container) {
    const tasks = AppState.tasks || [];

    container.innerHTML = `
      <div class="animate-fadeIn">
        <div class="kanban-board" id="kanban-board">
          ${CONFIG.STATUSES.map(status => {
            const statusTasks = tasks.filter(t => t.status === status);
            return `
              <div class="kanban-column" data-status="${status}" id="col-${this._slugify(status)}">
                <div class="kanban-column-header">
                  <span>${status}</span>
                  <span class="count">${statusTasks.length}</span>
                </div>
                <div class="kanban-column-body" data-status="${status}">
                  ${statusTasks.map(t => this._renderCard(t)).join('')}
                  ${statusTasks.length === 0 ? '<div class="empty-state p-md"><span class="text-xs text-muted">Drop tasks here</span></div>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <button class="btn-fab" id="fab-add-kanban" title="Add Task">+</button>
    `;

    this._bindEvents(container);
  }

  _renderCard(t) {
    const pc = t.priority ? t.priority.toLowerCase() : 'medium';
    return `
      <div class="kanban-card" draggable="true" data-task-id="${t.id}">
        <div class="card-title">${this._esc(t.title)}</div>
        <div class="card-meta">
          <span class="badge badge-priority-${pc}">${t.priority || 'Medium'}</span>
          ${t.taskType ? `<span class="badge badge-type">${t.taskType}</span>` : ''}
          ${t.project ? `<span class="card-project">${t.project}</span>` : ''}
        </div>
        ${(t.owners || []).length > 0 ? `
          <div class="avatar-group mt-sm">
            ${t.owners.slice(0, 3).map(o => `<div class="avatar avatar-sm" style="background:${hashColor(o)}" title="${o}">${getInitials(o)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  _bindEvents(container) {
    // Click card -> edit
    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', () => {
        const task = AppState.tasks.find(t => t.id === card.dataset.taskId);
        if (task) EventBus.emit('task:edit', task);
      });
    });

    // Drag & Drop
    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.taskId);
        card.classList.add('dragging');
        setTimeout(() => card.style.opacity = '0.4', 0);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.style.opacity = '';
        container.querySelectorAll('.kanban-column-body').forEach(col => col.classList.remove('drag-over'));
      });
    });

    container.querySelectorAll('.kanban-column-body').forEach(colBody => {
      colBody.addEventListener('dragover', (e) => {
        e.preventDefault();
        colBody.classList.add('drag-over');
      });

      colBody.addEventListener('dragleave', (e) => {
        if (!colBody.contains(e.relatedTarget)) {
          colBody.classList.remove('drag-over');
        }
      });

      colBody.addEventListener('drop', async (e) => {
        e.preventDefault();
        colBody.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = colBody.dataset.status;

        if (taskId && newStatus) {
          await db.updateTask(taskId, { status: newStatus });
          const tasks = await db.getAllTasks();
          AppState.tasks = tasks;
          EventBus.emit('tasks:updated');
          this.render(container);
          EventBus.emit('toast:show', { type: 'success', message: `Moved to ${newStatus}` });
        }
      });
    });

    // FAB
    const fab = container.parentElement?.querySelector('#fab-add-kanban');
    if (fab) {
      fab.addEventListener('click', () => {
        EventBus.emit('task:create', { dateGroup: new Date().toISOString().split('T')[0] });
      });
    }
  }

  _slugify(str) { return str.toLowerCase().replace(/\s+/g, '-'); }
  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}
