import { gmailService } from '../services/gmail.js';

export class ReplyModal {
  constructor() {
    this.data = null;
    this.showingSignatureConfig = false;
  }

  init() {
    EventBus.on('task:reply', (data) => this._open(data));
  }

  _open(data) {
    this.data = data;
    this.showingSignatureConfig = false;
    
    const task = data.task || {};
    const signature = localStorage.getItem('taskflow_email_signature') || '';
    const baseBody = task.title ? gmailService.generateTaskUpdateReply(task) : `Hi,\n\nJust following up on this.\n\nBest regards`;
    const body = signature ? `${baseBody}\n\n--\n${signature}` : baseBody;

    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="reply-modal-overlay">
        <div class="modal" style="max-width:560px">
          <div class="modal-header">
            <h2 class="modal-title">Send Update</h2>
            <button class="modal-close" id="reply-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">To</label>
              <input class="form-input" id="reply-to" value="${this._escAttr(data.emailFrom || data.to || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Subject</label>
              <input class="form-input" id="reply-subject" value="Re: ${this._escAttr(data.emailSubject || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Message</label>
              <textarea class="form-textarea" id="reply-body" style="min-height:180px">${body}</textarea>
            </div>
            
            <!-- Email Signature Settings -->
            <div class="form-group" style="margin-top:4px;">
              <label class="form-label" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" id="edit-signature-toggle">
                <span>✍️ Email Signature</span>
                <span id="signature-toggle-icon" style="font-size:0.75rem; color:var(--text-secondary); font-family:var(--font-mono);">Configure ▼</span>
              </label>
              <div id="signature-config-container" style="display:none; margin-top:8px; background:var(--bg-card); border:1px solid var(--border-color); padding:var(--space-sm); border-radius:var(--radius-sm); flex-direction:column; gap:8px;">
                <textarea class="form-textarea" id="signature-input" style="min-height:60px; font-size:var(--text-xs);" placeholder="Regards,\nUmme Jamila\nProject Manager">${this._escAttr(signature)}</textarea>
                <button class="btn btn-primary btn-sm" id="save-signature-btn" style="width:fit-content; align-self:flex-end; font-size:var(--text-xs); padding:4px 10px; background:var(--accent-gradient); border:none;">Save Signature</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="reply-cancel">Cancel</button>
            <button class="btn btn-primary" id="reply-send">📤 Send Reply</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const root = document.getElementById('modal-root');

    root.querySelector('#reply-close')?.addEventListener('click', () => this._close());
    root.querySelector('#reply-cancel')?.addEventListener('click', () => this._close());
    root.querySelector('#reply-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'reply-modal-overlay') this._close();
    });

    // Toggle signature configuration container
    const signatureToggle = root.querySelector('#edit-signature-toggle');
    const signatureConfig = root.querySelector('#signature-config-container');
    const signatureToggleIcon = root.querySelector('#signature-toggle-icon');
    
    signatureToggle?.addEventListener('click', () => {
      this.showingSignatureConfig = !this.showingSignatureConfig;
      if (this.showingSignatureConfig) {
        signatureConfig.style.display = 'flex';
        signatureToggleIcon.textContent = 'Hide ▲';
      } else {
        signatureConfig.style.display = 'none';
        signatureToggleIcon.textContent = 'Configure ▼';
      }
    });

    // Save signature
    root.querySelector('#save-signature-btn')?.addEventListener('click', () => {
      const signatureVal = root.querySelector('#signature-input').value;
      localStorage.setItem('taskflow_email_signature', signatureVal);
      EventBus.emit('toast:show', { type: 'success', message: 'Signature saved! Will apply to future replies.' });
      
      // Close signature edit block
      this.showingSignatureConfig = false;
      signatureConfig.style.display = 'none';
      signatureToggleIcon.textContent = 'Configure ▼';
    });

    root.querySelector('#reply-send')?.addEventListener('click', async () => {
      const to = root.querySelector('#reply-to').value;
      const subject = root.querySelector('#reply-subject').value;
      const body = root.querySelector('#reply-body').value;

      if (!to || !body) {
        EventBus.emit('toast:show', { type: 'error', message: 'Please fill in To and Message fields' });
        return;
      }

      const btn = root.querySelector('#reply-send');
      btn.textContent = 'Sending...';
      btn.disabled = true;

      try {
        await gmailService.sendReply(
          this.data.threadId || this.data.emailId || '',
          to, subject, body
        );
        EventBus.emit('toast:show', { type: 'success', message: 'Reply sent successfully!' });
        this._close();
      } catch (err) {
        EventBus.emit('toast:show', { type: 'error', message: 'Failed to send: ' + err.message });
        btn.textContent = '📤 Send Reply';
        btn.disabled = false;
      }
    });
  }

  _close() {
    document.getElementById('modal-root').innerHTML = '';
  }

  _escAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}
