import { db } from '../services/database.js';

export class TeamModal {
  constructor() {
    this.members = [];
  }

  init() {
    EventBus.on('team:manage', async () => {
      // Normalize members list to consist of { name, email, role } objects
      this.members = (AppState.teamMembers || []).map(m => {
        if (typeof m === 'object' && m !== null) {
          return { name: m.name || '', email: m.email || '', role: m.role || '' };
        }
        return { name: m || '', email: '', role: '' };
      });
      this._render();
    });
  }

  _render() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="team-modal-overlay">
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <h2 class="modal-title">Manage Team</h2>
            <button class="modal-close" id="team-modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="flex-col gap-xs mb-md" style="background:rgba(255,255,255,0.02); border:1px dashed var(--border-color); padding:var(--space-md); border-radius:var(--radius-md);">
              <div class="form-group">
                <label class="form-label">Name</label>
                <input class="form-input" id="new-member-input" placeholder="Member name (e.g. Rukhsat)..." />
              </div>
              <div class="form-row" style="margin-top:4px; gap:var(--space-xs);">
                <div class="form-group" style="flex:1;">
                  <label class="form-label">Email</label>
                  <input class="form-input" id="new-member-email-input" placeholder="e.g. name@email.com..." />
                </div>
                <div class="form-group" style="flex:1;">
                  <label class="form-label">Role</label>
                  <input class="form-input" id="new-member-role-input" placeholder="e.g. Designer..." />
                </div>
              </div>
              <button class="btn btn-primary mt-sm" id="add-member-btn" style="background:var(--accent-gradient); border:none; width:100%;">+ Add Member</button>
            </div>
            
            <div class="flex-col gap-sm" id="team-list" style="max-height: 250px; overflow-y: auto; padding-right: 4px;">
              ${this.members.map((m, idx) => `
                <div class="flex-between p-sm" style="background:var(--bg-glass); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                  <div class="flex-col" style="min-width: 0; flex: 1; margin-right: var(--space-sm);">
                    <div style="display:flex; align-items:center; gap:var(--space-xs); flex-wrap:wrap;">
                      <span class="font-medium" style="color:var(--text-primary); font-weight:600;">${this._esc(m.name)}</span>
                      ${m.role ? `
                        <span class="badge" style="background:rgba(255,255,255,0.06); border:1px solid var(--border-color); font-size:9px; color:var(--text-secondary); padding:1px 6px; border-radius:var(--radius-sm); font-weight:500;">
                          ${this._esc(m.role)}
                        </span>
                      ` : ''}
                    </div>
                    ${m.email ? `
                      <span class="text-xs text-muted truncate" style="font-family:var(--font-mono); margin-top:2px;">${this._esc(m.email)}</span>
                    ` : `
                      <span class="text-xs text-muted" style="font-style:italic; opacity:0.5; margin-top:2px;">No email configured</span>
                    `}
                  </div>
                  <button class="btn-icon btn-ghost sm remove-member-btn" data-index="${idx}" title="Remove">✕</button>
                </div>
              `).join('')}
              ${this.members.length === 0 ? '<div class="text-center text-muted text-sm p-sm">No team members. Add someone above!</div>' : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="team-modal-cancel">Cancel</button>
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
    const close = () => this._close();
    root.querySelector('#team-modal-close')?.addEventListener('click', close);
    root.querySelector('#team-modal-cancel')?.addEventListener('click', close);
    root.querySelector('#team-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'team-modal-overlay') close();
    });

    // Add member
    const addBtn = root.querySelector('#add-member-btn');
    const input = root.querySelector('#new-member-input');
    const emailInput = root.querySelector('#new-member-email-input');
    const roleInput = root.querySelector('#new-member-role-input');
    
    const addMember = () => {
      const name = input.value.trim();
      const email = emailInput.value.trim();
      const role = roleInput.value.trim();
      
      if (!name) {
        EventBus.emit('toast:show', { type: 'error', message: 'Name is required' });
        return;
      }
      
      if (this.members.some(m => (m.name || '').toLowerCase() === (name || '').toLowerCase())) {
        EventBus.emit('toast:show', { type: 'info', message: 'Member already exists' });
        return;
      }

      this.members.push({ name, email, role });
      this._render();
      
      // Focus name input again for fast additions
      document.getElementById('new-member-input')?.focus();
    };
    
    addBtn?.addEventListener('click', addMember);
    // Allow enter key triggers on all fields
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') emailInput.focus();
    });
    emailInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') roleInput.focus();
    });
    roleInput?.addEventListener('keypress', (e) => {
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
        EventBus.emit('toast:show', { type: 'success', message: 'Team directory updated successfully!' });
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
