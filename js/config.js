// TaskFlow Configuration
export const CONFIG = {
  GOOGLE_CLIENT_ID: '895102103410-ljsjojvnl08bh822oeq7j1v6divh9hk6.apps.googleusercontent.com',
  GMAIL_SCOPES: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.appdata',

  STATUSES: ['To Do', 'In Progress', 'Waiting', 'Approved', 'Blocked', 'Completed'],
  PRIORITIES: ['Today', 'High', 'Medium', 'Low'],
  TASK_TYPES: ['Design', 'Development', 'Marketing', 'Content', 'Video', 'Reels', 'CRM', 'Newsletter', 'Project Mgt', 'Social Media', 'Follow Up'],
  TEAM_MEMBERS: ['Ziya', 'Jacky', 'Ashik', 'Yousuf', 'Rukon', 'Rukhsat', 'Urmi', 'Jack'],
  DEFAULT_PROJECTS: ['CR', 'Allies', 'Brandnook', 'CREwithMe', 'CRM'],
  DEFAULT_SUB_CATEGORIES: ['Website', 'Social Media', 'Design and Development'],

  STATUS_COLORS: {
    'To Do': '#f59e0b',
    'In Progress': '#3b82f6',
    'Waiting': '#8b5cf6',
    'Approved': '#14b8a6',
    'Blocked': '#ef4444',
    'Completed': '#22c55e'
  },

  PRIORITY_COLORS: {
    'Today': '#ef4444',
    'High': '#f97316',
    'Medium': '#eab308',
    'Low': '#6b7280'
  },

  STATUS_MAP: {
    'Completed': 'Completed',
    'In progress': 'In Progress',
    'In Progress': 'In Progress',
    'Waiting for feedback': 'Waiting',
    'Waiting for approval': 'Waiting',
    'Feedback sent': 'Waiting',
    'Not started': 'To Do',
    'Approved': 'Approved',
    'Design Done': 'Approved',
    'Blocked': 'Blocked',
    '': 'To Do'
  },

  LINK_PATTERNS: {
    mail: /mail\.google\.com/i,
    monday: /monday\.com/i,
    doc: /docs\.google\.com|sheets\.google\.com|drawings\.google\.com|drive\.google\.com|dropbox\.com|loom\.com|fireflies\.ai|presentation/i
  }
};

export function getStatusColor(status) {
  return CONFIG.STATUS_COLORS[status] || '#6b7280';
}

export function getPriorityColor(priority) {
  return CONFIG.PRIORITY_COLORS[priority] || '#6b7280';
}

export function classifyLink(url) {
  if (!url) return null;
  if (CONFIG.LINK_PATTERNS.mail.test(url)) return 'mail';
  if (CONFIG.LINK_PATTERNS.monday.test(url)) return 'monday';
  if (CONFIG.LINK_PATTERNS.doc.test(url)) return 'doc';
  return 'doc';
}

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

export function toISODate(dateStr) {
  if (!dateStr) return '';
  // Handle M/D/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Handle D.M.YYYY
  const dotParts = dateStr.split('.');
  if (dotParts.length === 3) {
    const [d, m, y] = dotParts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr;
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}
