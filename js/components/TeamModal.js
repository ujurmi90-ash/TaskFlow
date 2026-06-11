import { db } from '../services/database.js';

export class TeamModal {
  constructor() {
    this.members = [];
  }

  init() {
    EventBus.on('team:manage', async () => {
      this.members = [...(AppState.teamMembers || [])];
      this._render();
    });
  }

  _render() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="team-modal-overlay">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h2 class="modal-title">Manage Team</h2>
            <button class="modal-close" id="team-modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="flex gap-sm mb-md">
              <input class="form-input" id="new-member-input" placeholder="New team member name..." />
              <button class="btn btn-primary" id="add-member-btn">Add</button>
            </div>
            
            <div class="flex-col gap-sm" id="team-list">
              ${this.members.map((m, idx) => `
                <div class="flex-between p-sm" style="background:var(--bg-glass);border-radius:var(--radius-sm);">
                  <span class="font-medium">${this._esc(m)}</span>
                  <button class="btn-icon btn-ghost sm remove-member-btn" data-index="${idx}" title="Remove">✕</button>
                </div>
              `).join('')}
              ${this.members.length === 0 ? '<div class="text-center text-muted text-sm p-sm">No team members</div>' : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="team-save-btn">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const root = document.getElementById('modal-root');

    // Close
    root.querySelector('#team-modal-close')?.addEventListener('click', () => this._close());
    root.querySelector('#team-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'team-modal-overlay') this._close();
    });

    // Add member
    const addBtn = root.querySelector('#add-member-btn');
    const input = root.querySelector('#new-member-input');
    
    const addMember = () => {
      const name = input.value.trim();
      if (name && !this.members.includes(name)) {
        this.members.push(name);
        this._render();
      } else if (this.members.includes(name)) {
        EventBus.emit('toast:show', { type: 'info', message: 'Member already exists' });
      }
    };
    
    addBtn?.addEventListener('click', addMember);
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addMember();
    });

    // Remove member
    root.querySelectorAll('.remove-member-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.members.splice(idx, 1);
        this._render();
      });
    });

    // Save
    root.querySelector('#team-save-btn')?.addEventListener('click', async () => {
      try {
        await db.saveTeamMembers(this.members);
        AppState.teamMembers = [...this.members];
        EventBus.emit('team:updated');
        EventBus.emit('tasks:updated'); // Re-render views
        EventBus.emit('toast:show', { type: 'success', message: 'Team updated successfully' });
        this._close();
      } catch (err) {
        EventBus.emit('toast:show', { type: 'error', message: 'Failed to save team: ' + err.message });
      }
    });
  }

  _close() {
    document.getElementById('modal-root').innerHTML = '';
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}
