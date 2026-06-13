import { authService } from './auth.js';

class GmailService {
  _headers() {
    return { Authorization: `Bearer ${authService.getToken()}` };
  }

  async _fetch(url, options = {}) {
    const headers = { ...this._headers(), ...options.headers };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      authService.signOut();
      throw new Error('Session expired. Please sign in again.');
    }
    if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
    return res;
  }

  async fetchMessages(query = '', maxResults = 20, pageToken = null, labelId = null) {
    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    if (labelId) url += `&labelIds=${encodeURIComponent(labelId)}`;

    const res = await this._fetch(url);
    const data = await res.json();

    if (!data.messages) return { messages: [], nextPageToken: null };

    const messages = await Promise.all(
      data.messages.map(m => this.fetchMessage(m.id))
    );

    return { messages, nextPageToken: data.nextPageToken || null };
  }

  async fetchLabels() {
    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';
    const res = await this._fetch(url);
    const data = await res.json();
    return data.labels || [];
  }

  async fetchMessage(id) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
    const res = await this._fetch(url);
    return this.parseEmail(await res.json());
  }

  parseEmail(message) {
    const headers = message.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: message.id,
      threadId: message.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
      snippet: message.snippet || '',
      labelIds: message.labelIds || [],
      body: this._decodeBody(message.payload)
    };
  }

  _decodeBody(payload) {
    if (!payload) return '';
    if (payload.body?.data) return this._base64Decode(payload.body.data);
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) return this._base64Decode(part.body.data);
      }
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) return this._base64Decode(part.body.data);
      }
      for (const part of payload.parts) {
        const result = this._decodeBody(part);
        if (result) return result;
      }
    }
    return '';
  }

  _base64Decode(data) {
    try {
      return decodeURIComponent(
        atob(data.replace(/-/g, '+').replace(/_/g, '/'))
          .split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
    } catch {
      try { return atob(data.replace(/-/g, '+').replace(/_/g, '/')); }
      catch { return ''; }
    }
  }

  async markAsRead(id) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`;
    const res = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
    });
    return await res.json();
  }

  async sendEmail(to, subject, body) {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
    const res = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encodedEmail })
    });

    return await res.json();
  }

  async sendReply(threadId, to, subject, body) {
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    const email = [
      `To: ${to}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${threadId}`,
      `References: ${threadId}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
    const res = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encodedEmail, threadId })
    });

    return await res.json();
  }

  generateTaskUpdateReply(task) {
    const owners = Array.isArray(task.owners) ? task.owners.join(', ') : (task.owners || 'Unassigned');
    return `Hi,\n\nHere's an update on the following task:\n\nTask: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority || 'Medium'}\nAssigned to: ${owners}\nProject: ${task.project || 'N/A'}${task.subCategory ? ' — ' + task.subCategory : ''}${task.startDate ? '\nStart Date: ' + task.startDate : ''}${task.endDate ? '\nEnd Date: ' + task.endDate : ''}${task.notes ? '\n\nNotes: ' + task.notes : ''}\n\nPlease let me know if you have any questions.\n\nBest regards`;
  }
}

export const gmailService = new GmailService();
