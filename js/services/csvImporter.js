import { CONFIG, generateId, classifyLink, toISODate } from '../config.js';

export const csvImporter = {
  parseCSV(csvString) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    let row = [];

    for (let i = 0; i < csvString.length; i++) {
      const ch = csvString[i];
      const next = csvString[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
        row.push(current.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
        current = '';
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
    // Last row
    row.push(current.trim());
    if (row.some(cell => cell !== '')) rows.push(row);

    return rows;
  },

  processRows(rows) {
    if (rows.length === 0) return [];

    const tasks = [];
    let currentDateGroup = '';

    // Skip header row
    const datePattern = /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/;
    const startIdx = (rows[0][0] || '').toLowerCase() === 'task' ? 1 : 0;

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = (row[0] || '').trim();

      // Skip empty-ish rows
      if (!firstCell && !row[1] && !row[2]) continue;

      // Check for date group header
      if (datePattern.test(firstCell) && !row[2] && !row[4] && !row[5]) {
        currentDateGroup = this._parseDateGroup(firstCell);
        continue;
      }

      // Skip non-task rows (like "Pending Projects", "2026!!", etc.)
      if (!firstCell && !row[1]) continue;
      if (/^\d{4}!!?$/.test(firstCell)) continue;
      if (firstCell === 'Pending Projects') continue;

      // Parse task row
      // Columns: Task(0), File(1), Task type(2), Priority(3), Owner(4), Status(5), Start date(6), End date(7), File(8), File(9)
      const title = firstCell;
      if (!title) continue;

      const file1 = (row[1] || '').trim();
      const taskType = (row[2] || '').trim();
      const priority = this._mapPriority((row[3] || '').trim());
      const owners = this._parseOwners((row[4] || '').trim());
      const status = this._mapStatus((row[5] || '').trim());
      const startDate = this._parseDate((row[6] || '').trim());
      const endDate = this._parseDate((row[7] || '').trim());
      const file2 = (row[8] || '').trim();
      const file3 = (row[9] || '').trim();

      // Classify links
      const allLinks = [file1, file2, file3].filter(Boolean);
      let mailLink = '', mondayLink = '', docLink = '';

      for (const link of allLinks) {
        const type = classifyLink(link);
        if (type === 'mail' && !mailLink) mailLink = link;
        else if (type === 'monday' && !mondayLink) mondayLink = link;
        else if (!docLink) docLink = link;
      }

      // Auto-detect project
      const project = this._detectProject(title);

      tasks.push({
        id: generateId(),
        title,
        taskType: this._normalizeTaskType(taskType),
        priority,
        owners,
        status,
        project,
        subCategory: '',
        startDate,
        endDate,
        mailLink,
        mondayLink,
        docLink,
        notes: '',
        dateGroup: currentDateGroup || (startDate || new Date().toISOString().split('T')[0]),
        emailId: '',
        emailSubject: '',
        emailFrom: '',
        createdAt: new Date().toISOString()
      });
    }

    return tasks;
  },

  getPreview(tasks) {
    const byStatus = {};
    const byProject = {};
    const byOwner = {};

    tasks.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      if (t.project) byProject[t.project] = (byProject[t.project] || 0) + 1;
      (t.owners || []).forEach(o => {
        byOwner[o] = (byOwner[o] || 0) + 1;
      });
    });

    return {
      totalCount: tasks.length,
      byStatus,
      byProject,
      byOwner,
      sampleTasks: tasks.slice(0, 5)
    };
  },

  _parseDateGroup(str) {
    // Convert "19.08.2025" or "10-09-2025" to "2025-08-19"
    const cleaned = str.replace(/\s/g, '');
    const match = cleaned.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (match) {
      const [, d, m, y] = match;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return str;
  },

  _parseDate(str) {
    if (!str) return '';
    // Handle M/D/YYYY
    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, m, d, y] = match;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return toISODate(str);
  },

  _parseOwners(str) {
    if (!str) return [];
    return str
      .split(/\s*(?:&|and|,|n(?=\s))\s*/i)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        // Normalize common name variations
        const lower = s.toLowerCase();
        if (lower === 'ziya' || lower === 'ziya') return 'Ziya';
        if (lower === 'jacky') return 'Jacky';
        if (lower === 'ashik') return 'Ashik';
        if (lower === 'yousuf' || lower === 'youauf') return 'Yousuf';
        if (lower === 'rukon') return 'Rukon';
        if (lower === 'rukhsat') return 'Rukhsat';
        if (lower === 'urmi') return 'Urmi';
        if (lower === 'jack') return 'Jack';
        return s.charAt(0).toUpperCase() + s.slice(1);
      });
  },

  _mapStatus(str) {
    return CONFIG.STATUS_MAP[str] || CONFIG.STATUS_MAP[str.trim()] || 'To Do';
  },

  _mapPriority(str) {
    const lower = (str || '').toLowerCase();
    if (lower === 'today') return 'Today';
    if (lower === 'high') return 'High';
    if (lower === 'medium') return 'Medium';
    if (lower === 'low') return 'Low';
    return 'Medium';
  },

  _normalizeTaskType(str) {
    if (!str) return '';
    const found = CONFIG.TASK_TYPES.find(t => t.toLowerCase() === str.toLowerCase());
    if (found) return found;
    // Partial matches
    const lower = str.toLowerCase();
    if (lower.includes('design') && lower.includes('dev')) return 'Design';
    if (lower.includes('design')) return 'Design';
    if (lower.includes('dev')) return 'Development';
    if (lower.includes('market')) return 'Marketing';
    if (lower.includes('content')) return 'Content';
    if (lower.includes('video')) return 'Video';
    if (lower.includes('reel')) return 'Reels';
    if (lower.includes('crm')) return 'CRM';
    if (lower.includes('newsletter')) return 'Newsletter';
    if (lower.includes('social')) return 'Social Media';
    if (lower.includes('follow')) return 'Follow Up';
    if (lower.includes('project')) return 'Project Mgt';
    return str;
  },

  _detectProject(title) {
    const lower = title.toLowerCase();
    if (lower.includes('crewithme') || lower.includes('cre with me') || lower.includes('crewith')) return 'CREwithMe';
    if (lower.includes(' cr ') || lower.startsWith('cr ') || lower.includes('cr -') || lower.includes('cr site') || lower.includes('cr website') || lower.includes('cr blog') || lower.includes('cr headshot') || lower.includes('cr team') || lower.includes('cr loom') || lower.includes('cr map') || lower.includes('cr glass') || lower.includes('cr feedback') || lower.includes('cr stationery') || lower.includes('cr audio') || lower.includes('cr location') || lower.includes('cr social')) return 'CR';
    if (lower.includes('allies') || lower.includes('apm') || lower.includes('ally')) return 'Allies';
    if (lower.includes('brandnook') || lower.includes('bdnk')) return 'Brandnook';
    if (lower.includes('crm') || lower.includes('client portal')) return 'CRM';
    return '';
  }
};
