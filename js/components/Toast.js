export class Toast {
  init() {
    let container = document.getElementById('toast-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-root';
      document.body.appendChild(container);
    }
    container.className = 'toast-container';

    EventBus.on('toast:show', ({ type, message }) => this.show(type, message));
  }

  show(type = 'info', message = '') {
    const container = document.getElementById('toast-root');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slideInUp`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    toast.addEventListener('click', () => this._dismiss(toast));

    container.appendChild(toast);

    // Max 3 toasts
    while (container.children.length > 3) {
      this._dismiss(container.firstChild);
    }

    setTimeout(() => this._dismiss(toast), 4000);
  }

  _dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }
}
