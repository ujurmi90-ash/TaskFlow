import { authService } from '../services/auth.js';
import { db } from '../services/database.js';
import { AuthScreen } from './AuthScreen.js';
import { Sidebar } from './Sidebar.js';
import { Dashboard } from './Dashboard.js';
import { DailyLog } from './DailyLog.js';
import { KanbanBoard } from './KanbanBoard.js';
import { ByPerson } from './ByPerson.js';
import { EmailView } from './EmailView.js';
import { TaskDetails } from './TaskDetails.js';
import { TaskModal } from './TaskModal.js';
import { ReplyModal } from './ReplyModal.js';
import { ImportModal } from './ImportModal.js';
import { TeamModal } from './TeamModal.js';
import { EmailDetailModal } from './EmailDetailModal.js';

export class App {
  constructor() {
    this.container = null;
    this.sidebar = new Sidebar();
    this.authScreen = new AuthScreen();
    this.views = {
      dashboard: new Dashboard(),
      dailylog: new DailyLog(),
      kanban: new KanbanBoard(),
      byperson: new ByPerson(),
      emails: new EmailView(),
      taskdetails: new TaskDetails(),
    };

    // Init modals
    this.taskModal = new TaskModal();
    this.taskModal.init();
    this.replyModal = new ReplyModal();
    this.replyModal.init();
    this.importModal = new ImportModal();
    this.importModal.init();
    this.teamModal = new TeamModal();
    this.teamModal.init();
    this.emailDetailModal = new EmailDetailModal();
    this.emailDetailModal.init();
  }

  render(container) {
    this.container = container;

    // Listen for auth and view changes
    EventBus.on('auth:changed', () => this._update());
    EventBus.on('view:changed', () => this._update());
    EventBus.on('tasks:updated', () => this._renderCurrentView());

    this._update();
  }

  async _update() {
    if (!AppState.isAuthenticated) {
      this.authScreen.render(this.container);
      return;
    }

    // Load tasks and team if needed
    if (AppState.tasks.length === 0) {
      try {
        const tasks = await db.getAllTasks();
        AppState.tasks = tasks;
      } catch (e) { console.error(e); }
    }
    
    if (!AppState.teamMembers) {
      try {
        AppState.teamMembers = await db.getTeamMembers();
      } catch (e) { console.error(e); }
    }

    this._renderLayout();
  }

  _renderLayout() {
    const viewTitles = {
      dashboard: 'Dashboard',
      dailylog: 'Daily Log',
      kanban: 'Kanban Board',
      byperson: 'By Person',
      emails: 'Emails',
      taskdetails: 'Task Details',
    };

    this.container.innerHTML = `
      <div class="app-layout" id="app-layout">
        <div id="sidebar-container"></div>
        <div class="app-main-wrapper">
          <header class="app-header">
            <button class="btn-icon btn-ghost" id="mobile-menu-btn" style="display:none">☰</button>
            <h1 class="header-title">${viewTitles[AppState.currentView] || 'Dashboard'}</h1>
          </header>
          <main class="app-main" id="view-container"></main>
        </div>
      </div>
    `;

    // Render sidebar
    this.sidebar.render(this.container.querySelector('#sidebar-container'));

    // Render current view
    this._renderCurrentView();

    // Mobile menu
    const menuBtn = this.container.querySelector('#mobile-menu-btn');
    if (window.innerWidth <= 768 && menuBtn) {
      menuBtn.style.display = 'flex';
      menuBtn.addEventListener('click', () => {
        const sidebar = this.container.querySelector('.sidebar');
        sidebar?.classList.toggle('mobile-open');
      });
    }
  }

  _renderCurrentView() {
    const viewContainer = this.container.querySelector('#view-container');
    if (!viewContainer) return;

    const view = this.views[AppState.currentView];
    if (view) {
      view.render(viewContainer);
    } else {
      this.views.dashboard.render(viewContainer);
    }

    // Update sidebar active state
    this.container.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === AppState.currentView);
    });

    // Update header title
    const viewTitles = {
      dashboard: 'Dashboard',
      dailylog: 'Daily Log',
      kanban: 'Kanban Board',
      byperson: 'By Person',
      emails: 'Emails',
      taskdetails: 'Task Details',
    };
    const header = this.container.querySelector('.header-title');
    if (header) header.textContent = viewTitles[AppState.currentView] || 'Dashboard';
  }
}
