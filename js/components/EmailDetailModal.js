import { getInitials, hashColor } from '../config.js';

export class EmailDetailModal {
  constructor() {
    this.data = null;
  }

  init() {
    EventBus.on('email:open', (data) => this._open(data));
  }

  _open(data) {
    this.data = data;
    const root = document.getElementById('modal-root');
    
    root.innerHTML = `
      <div class="modal-overlay" id="email-modal-overlay">
        <div class="modal animate-scaleIn" style="max-width:800px; width:92%; height:90vh; max-height:850px;">
          <div class="modal-header">
            <h2 class="modal-title">Read Email</h2>
            <button class="modal-close" id="email-modal-close" title="Close">✕</button>
          </div>
          <div class="modal-body" style="padding:var(--space-lg); overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:var(--space-md);">
            <!-- Email Meta Headers -->
            <div class="email-detail-meta" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color); padding-bottom:var(--space-md);">
              <div style="display:flex; gap:var(--space-md); align-items:center; min-width:0;">
                <div class="avatar" style="background:${hashColor(this._extractName(data.from))}; width:44px; height:44px; font-size:var(--text-base);">
                  ${getInitials(this._extractName(data.from))}
                </div>
                <div style="min-width:0;">
                  <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                    ${this._esc(this._extractName(data.from))}
                  </div>
                  <div style="font-size:0.8rem; color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                    From: ${this._esc(data.from)}
                  </div>
                  <div style="font-size:0.8rem; color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-top:2px;">
                    To: ${this._esc(data.to)}
                  </div>
                </div>
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); font-family:var(--font-mono); white-space:nowrap; flex-shrink:0; text-align:right;">
                ${this._esc(data.date)}
              </div>
            </div>

            <!-- Subject line -->
            <div>
              <h3 style="margin:var(--space-xs) 0; font-size:1.3rem; font-weight:700; color:var(--text-primary); line-height:1.4;">
                ${this._esc(data.subject || '(no subject)')}
              </h3>
            </div>

            <div style="flex:1; display:flex; min-height:300px; border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden;">
              <iframe id="email-body-iframe" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" style="width:100%; height:100%; border:none; background:#12122a;"></iframe>
            </div>
          </div>
          
          <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
            <button class="btn btn-secondary" id="email-modal-cancel">Close</button>
            <div style="display:flex; gap:var(--space-xs);">
              <button class="btn btn-secondary" id="email-modal-reply">↩ Reply</button>
              <button class="btn btn-primary" id="email-modal-create-task">+ Create Task</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._injectBody();
    this._bindEvents();
  }

  _injectBody() {
    const iframe = document.getElementById('email-body-iframe');
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();

      const bodyContent = this.data.body || this.data.snippet || '(No body content available)';
      const isHtml = /<[a-z][\s\S]*>/i.test(bodyContent);

      let contentToInject = '';
      if (isHtml) {
        const themeStyles = `
          <style>
            /* Force TaskFlow Dark Theme inside Email Iframe */
            body, html {
              background-color: #12122a !important;
              color: #f0f0f5 !important;
              font-family: 'Roboto Condensed', 'Inter', -apple-system, sans-serif !important;
            }
            body *, html * {
              color: #f0f0f5 !important;
            }
            body table, body tr, body td, body div, body tbody, body p, body span, body section, body header, body ul, body li {
              background-color: #12122a !important;
              border-color: rgba(255, 255, 255, 0.08) !important;
            }
            a {
              color: #06b6d4 !important;
              text-decoration: underline !important;
            }
            /* Custom styled scrollbars inside iframe */
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
          </style>
        `;
        contentToInject = themeStyles + bodyContent;
      } else {
        contentToInject = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: 'Roboto Condensed', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                font-size: 14px;
                line-height: 1.6;
                color: #f0f0f5;
                margin: 20px;
                white-space: pre-wrap;
                word-break: break-word;
                background-color: #12122a;
              }
              a {
                color: #06b6d4;
              }
              ::-webkit-scrollbar { width: 6px; height: 6px; }
              ::-webkit-scrollbar-track { background: transparent; }
              ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
              ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            </style>
          </head>
          <body>${this._esc(bodyContent)}</body>
          </html>
        `;
      }

      doc.write(contentToInject);
      doc.close();
    } catch (e) {
      console.error('Failed to write email content to iframe:', e);
    }
  }

  _bindEvents() {
    const root = document.getElementById('modal-root');

    root.querySelector('#email-modal-close')?.addEventListener('click', () => this._close());
    root.querySelector('#email-modal-cancel')?.addEventListener('click', () => this._close());
    
    root.querySelector('#email-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'email-modal-overlay') this._close();
    });

    root.querySelector('#email-modal-reply')?.addEventListener('click', () => {
      const email = this.data;
      this._close();
      // Wait for modal to clear before opening reply modal to avoid overlap issues
      setTimeout(() => {
        EventBus.emit('task:reply', {
          emailId: email.id,
          threadId: email.threadId,
          emailFrom: email.from,
          emailSubject: email.subject,
          to: email.from
        });
      }, 50);
    });

    root.querySelector('#email-modal-create-task')?.addEventListener('click', () => {
      const email = this.data;
      this._close();
      // Wait for modal to clear before opening task creation modal to avoid overlap issues
      setTimeout(() => {
        EventBus.emit('task:create', {
          title: email.subject,
          mailLink: `https://mail.google.com/mail/u/0/#inbox/${email.id}`,
          emailId: email.id,
          emailSubject: email.subject,
          emailFrom: email.from,
          dateGroup: new Date().toISOString().split('T')[0]
        });
      }, 50);
    });
  }

  _close() {
    document.getElementById('modal-root').innerHTML = '';
  }

  _extractName(from) {
    if (!from) return 'Unknown';
    const match = from.match(/^"?([^"<]+)"?\s*<?/);
    return match ? match[1].trim() : from.split('@')[0];
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
