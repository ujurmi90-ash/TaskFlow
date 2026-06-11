import { csvImporter } from '../services/csvImporter.js';
import { db } from '../services/database.js';

export class ImportModal {
  constructor() {
    this.parsedTasks = null;
    this.preview = null;
    this.importing = false;
  }

  init() {
    EventBus.on('import:open', () => this._open());
  }

  _open() {
    this.parsedTasks = null;
    this.preview = null;
    this.importing = false;
    this._render();
  }

  _render() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="import-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">📥 Import CSV</h2>
            <button class="modal-close" id="import-close">✕</button>
          </div>
          <div class="modal-body">
            ${this.preview ? this._renderPreview() : this._renderDropZone()}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="import-cancel">${this.preview ? 'Back' : 'Cancel'}</button>
            ${this.preview ? `<button class="btn btn-primary" id="import-confirm" ${this.importing ? 'disabled' : ''}>${this.importing ? 'Importing...' : `Import ${this.preview.totalCount} Tasks`}</button>` : ''}
          </div>
        </div>
      </div>
    `;
    this._bindEvents();
  }

  _renderDropZone() {
    return `
      <div class="drop-zone" id="drop-zone">
        <div class="drop-icon">📂</div>
        <div class="drop-text">Drag & drop your CSV file here</div>
        <div class="drop-hint">or click to browse</div>
        <input type="file" id="file-input" accept=".csv,.txt" style="display:none" />
      </div>
      <div class="mt-md text-center">
        <p class="text-xs text-muted">Supports your existing spreadsheet format:<br/>Task, File, Task type, Priority, Owner, Status, Start date, End date, File, File</p>
      </div>
    `;
  }

  _renderPreview() {
    const p = this.preview;
    return `
      <div class="import-preview animate-fadeIn">
        <div class="import-stats">
          <div class="import-stat">
            <div class="import-stat-value text-gradient">${p.totalCount}</div>
            <div class="import-stat-label">Total Tasks</div>
          </div>
          <div class="import-stat">
            <div class="import-stat-value" style="color:var(--status-completed)">${p.byStatus['Completed'] || 0}</div>
            <div class="import-stat-label">Completed</div>
          </div>
          <div class="import-stat">
            <div class="import-stat-value" style="color:var(--status-progress)">${(p.byStatus['In Progress'] || 0) + (p.byStatus['Waiting'] || 0)}</div>
            <div class="import-stat-label">Active</div>
          </div>
        </div>

        <div class="card mb-md">
          <div class="card-header"><h3 class="card-title text-sm">Status Breakdown</h3></div>
          <div class="flex-col gap-xs">
            ${Object.entries(p.byStatus).filter(([,v]) => v > 0).map(([k, v]) => `
              <div class="flex-between text-sm"><span>${k}</span><span class="font-mono text-muted">${v}</span></div>
            `).join('')}
          </div>
        </div>

        ${Object.keys(p.byProject).length > 0 ? `
          <div class="card mb-md">
            <div class="card-header"><h3 class="card-title text-sm">Projects Detected</h3></div>
            <div class="flex-col gap-xs">
              ${Object.entries(p.byProject).sort((a,b) => b[1]-a[1]).map(([k, v]) => `
                <div class="flex-between text-sm"><span class="text-accent">${k}</span><span class="font-mono text-muted">${v}</span></div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="card">
          <div class="card-header"><h3 class="card-title text-sm">Sample Tasks</h3></div>
          <div class="flex-col gap-xs">
            ${p.sampleTasks.map(t => `
              <div class="text-sm p-sm" style="background:var(--bg-glass);border-radius:var(--radius-sm);">
                <span class="font-medium">${this._esc(t.title)}</span>
                <span class="text-xs text-muted ml-auto"> — ${t.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const root = document.getElementById('modal-root');

    // Close
    root.querySelector('#import-close')?.addEventListener('click', () => this._close());
    root.querySelector('#import-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'import-overlay') this._close();
    });

    // Cancel / Back
    root.querySelector('#import-cancel')?.addEventListener('click', () => {
      if (this.preview) {
        this.preview = null;
        this.parsedTasks = null;
        this._render();
      } else {
        this._close();
      }
    });

    // Drop zone
    const dropZone = root.querySelector('#drop-zone');
    const fileInput = root.querySelector('#file-input');

    if (dropZone) {
      dropZone.addEventListener('click', () => fileInput?.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        const file = e.dataTransfer.files[0];
        if (file) this._processFile(file);
      });
    }

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._processFile(file);
    });

    // Import confirm
    root.querySelector('#import-confirm')?.addEventListener('click', () => this._doImport());
  }

  _processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = csvImporter.parseCSV(text);
        this.parsedTasks = csvImporter.processRows(rows);
        this.preview = csvImporter.getPreview(this.parsedTasks);
        this._render();
      } catch (err) {
        EventBus.emit('toast:show', { type: 'error', message: 'Failed to parse CSV: ' + err.message });
      }
    };
    reader.readAsText(file);
  }

  async _doImport() {
    if (!this.parsedTasks || this.importing) return;
    this.importing = true;
    this._render();

    try {
      const count = await db.importTasks(this.parsedTasks);
      const tasks = await db.getAllTasks();
      AppState.tasks = tasks;
      EventBus.emit('tasks:updated');
      EventBus.emit('toast:show', { type: 'success', message: `Successfully imported ${count} tasks!` });
      this._close();
    } catch (err) {
      EventBus.emit('toast:show', { type: 'error', message: 'Import failed: ' + err.message });
      this.importing = false;
      this._render();
    }
  }

  _close() {
    document.getElementById('modal-root').innerHTML = '';
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}
