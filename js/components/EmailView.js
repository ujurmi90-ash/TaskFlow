import { gmailService } from '../services/gmail.js';
import { authService } from '../services/auth.js';
import { getInitials, hashColor } from '../config.js';

export class EmailView {
  constructor() {
    this.emails = [];
    this.loading = false;
    this.nextPageToken = null;
    this.query = '';
    this.sortBy = 'date-desc';
  }

  render(container) {
    if (!authService.isSignedIn()) {
      container.innerHTML = `
        <div class="empty-state animate-fadeIn">
          <div class="empty-icon">📧</div>
          <div class="empty-title">Sign in to access Gmail</div>
          <div class="empty-desc">Connect your Google account to browse emails and create tasks from them.</div>
        </div>
      `;
      return;
    }

    const importantList = this._getImportantList();
    
    // Sort base list by date descending (LIFO)
    let displayEmails = [...this.emails].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });

    if (this.sortBy === 'important-only') {
      displayEmails = displayEmails.filter(e => importantList.includes(e.id));
    } else if (this.sortBy === 'important-first') {
      displayEmails.sort((a, b) => {
        const aImp = importantList.includes(a.id) ? 1 : 0;
        const bImp = importantList.includes(b.id) ? 1 : 0;
        if (aImp !== bImp) return bImp - aImp;
        
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
      });
    }

    container.innerHTML = `
      <div class="animate-fadeIn">
        <div class="flex flex-wrap gap-md items-center mb-lg">
          <div class="search-bar" style="max-width:100%; flex:1;">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Search emails (Gmail syntax supported)..." id="email-search" value="${this.query}"/>
            <button class="btn btn-primary btn-sm" id="email-search-btn">Search</button>
          </div>
          <div class="flex items-center gap-xs">
            <span class="text-xs text-muted font-mono">SORT:</span>
            <select class="form-select" id="email-sort-select" style="width:auto; height:38px; font-size:var(--text-xs); border-radius:var(--radius-md); padding-right: 32px;">
              <option value="date-desc" ${this.sortBy === 'date-desc' ? 'selected' : ''}>Newest First</option>
              <option value="important-first" ${this.sortBy === 'important-first' ? 'selected' : ''}>Important First</option>
              <option value="important-only" ${this.sortBy === 'important-only' ? 'selected' : ''}>Important Only</option>
            </select>
          </div>
        </div>
        <div id="email-list" class="email-list">
          ${this.loading && this.emails.length === 0 ? this._renderSkeleton() : ''}
          ${displayEmails.map(e => this._renderEmailCard(e, importantList.includes(e.id))).join('')}
          ${!this.loading && displayEmails.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📬</div>
              <div class="empty-title">No emails loaded</div>
              <div class="empty-desc">Click search or press Enter to load your inbox.</div>
            </div>
          ` : ''}
        </div>
        ${this.loading ? '<div class="text-center p-lg text-muted">Loading...</div>' : ''}
        ${this.nextPageToken && !this.loading ? `
          <div class="text-center p-lg">
            <button class="btn btn-secondary" id="load-more-btn">Load More</button>
          </div>
        ` : ''}
      </div>
    `;

    this._bindEvents(container);

    // Auto-load on first render
    if (this.emails.length === 0 && !this.loading) {
      this._fetchEmails(container);
    }
  }

  _renderEmailCard(e, isImportant) {
    const fromName = this._extractName(e.from);
    const dateStr = this._formatEmailDate(e.date);
    return `
      <div class="email-card" data-email-id="${e.id}">
        <div class="email-important-toggle" data-email-id="${e.id}" style="cursor:pointer; font-size:1.2rem; user-select:none; margin-right:4px; display:flex; align-items:center;" title="${isImportant ? 'Mark Unimportant' : 'Mark Important'}">
          ${isImportant ? '⭐' : '☆'}
        </div>
        <div class="sender-avatar" style="background:${hashColor(fromName)}">${getInitials(fromName)}</div>
        <div class="email-content">
          <div class="email-subject">${this._esc(e.subject || '(no subject)')}</div>
          <div class="email-from">${this._esc(fromName)}</div>
          <div class="email-snippet">${this._esc(e.snippet)}</div>
        </div>
        <div class="email-date">${dateStr}</div>
        <div class="email-actions">
          <button class="btn btn-primary btn-sm create-task-btn" data-email-id="${e.id}" title="Create Task">+ Task</button>
          <button class="btn btn-secondary btn-sm reply-btn" data-email-id="${e.id}" title="Reply">↩ Reply</button>
        </div>
      </div>
    `;
  }

  _renderSkeleton() {
    return Array.from({ length: 5 }, () => `
      <div class="email-card">
        <div class="skeleton" style="width:42px;height:42px;border-radius:50%;flex-shrink:0"></div>
        <div class="email-content">
          <div class="skeleton skeleton-text" style="width:60%"></div>
          <div class="skeleton skeleton-text" style="width:30%"></div>
          <div class="skeleton skeleton-text" style="width:80%"></div>
        </div>
      </div>
    `).join('');
  }

  async _fetchEmails(container) {
    this.loading = true;
    this.render(container);

    try {
      const result = await gmailService.fetchMessages(this.query, 15, this.nextPageToken);
      this.emails = [...this.emails, ...result.messages];
      this.nextPageToken = result.nextPageToken;
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      EventBus.emit('toast:show', { type: 'error', message: 'Failed to load emails: ' + err.message });
    }

    this.loading = false;
    this.render(container);
  }

  _bindEvents(container) {
    // Search
    const searchInput = container.querySelector('#email-search');
    const searchBtn = container.querySelector('#email-search-btn');

    const doSearch = () => {
      this.query = searchInput.value;
      this.emails = [];
      this.nextPageToken = null;
      this._fetchEmails(container);
    };

    searchBtn?.addEventListener('click', doSearch);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    // Load more
    container.querySelector('#load-more-btn')?.addEventListener('click', () => {
      this._fetchEmails(container);
    });

    // Star toggle event
    container.querySelectorAll('.email-important-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const emailId = toggle.dataset.emailId;
        this._toggleImportant(emailId);
        this.render(container);
      });
    });

    // Sort select change
    container.querySelector('#email-sort-select')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.render(container);
    });

    // Create task from email
    container.querySelectorAll('.create-task-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = this.emails.find(em => em.id === btn.dataset.emailId);
        if (email) {
          EventBus.emit('task:create', {
            title: email.subject,
            mailLink: `https://mail.google.com/mail/u/0/#inbox/${email.id}`,
            emailId: email.id,
            emailSubject: email.subject,
            emailFrom: email.from,
            dateGroup: new Date().toISOString().split('T')[0]
          });
        }
      });
    });

    // Reply
    container.querySelectorAll('.reply-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = this.emails.find(em => em.id === btn.dataset.emailId);
        if (email) {
          EventBus.emit('task:reply', {
            emailId: email.id,
            threadId: email.threadId,
            emailFrom: email.from,
            emailSubject: email.subject,
            to: email.from
          });
        }
      });
    });

    // Click card to open full email details
    container.querySelectorAll('.email-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.email-actions') || e.target.closest('.email-important-toggle')) return;
        const email = this.emails.find(em => em.id === card.dataset.emailId);
        if (email) {
          EventBus.emit('email:open', email);
        }
      });
    });
  }

  _extractName(from) {
    if (!from) return 'Unknown';
    const match = from.match(/^"?([^"<]+)"?\s*<?/);
    return match ? match[1].trim() : from.split('@')[0];
  }

  _formatEmailDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      if (diff < 86400000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short' });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

  _getImportantList() {
    try {
      const val = localStorage.getItem('taskflow_important_emails');
      return val ? JSON.parse(val) : [];
    } catch { return []; }
  }

  _toggleImportant(emailId) {
    const list = this._getImportantList();
    const index = list.indexOf(emailId);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(emailId);
    }
    localStorage.setItem('taskflow_important_emails', JSON.stringify(list));
  }
}
