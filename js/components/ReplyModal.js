import { gmailService } from '../services/gmail.js';

export class ReplyModal {
  constructor() {
    this.data = null;
  }

  init() {
    EventBus.on('task:reply', (data) => this._open(data));
  }

  _open(data) {
    this.data = data;
    const task = data.task || {};
    const body = task.title ? gmailService.generateTaskUpdateReply(task) : `Hi,\n\nJust following up on this.\n\nBest regards`;

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
              <textarea class="form-textarea" id="reply-body" style="min-height:200px">${body}</textarea>
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
