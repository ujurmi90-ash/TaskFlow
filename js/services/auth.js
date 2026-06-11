import { CONFIG } from '../config.js';

class AuthService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.userProfile = null;
    this.listeners = [];
    this.gapiInited = false;
    this.gisInited = false;
    this._restoreSession();
  }

  async init() {
    await this._loadGapi();
    await this._loadGis();
  }

  _restoreSession() {
    try {
      const token = localStorage.getItem('taskflow_access_token');
      const expiresAtStr = localStorage.getItem('taskflow_token_expires_at');
      const profileStr = localStorage.getItem('taskflow_user_profile');

      if (token && expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        // Ensure token has at least 5 minutes remaining
        if (Date.now() < expiresAt - 5 * 60 * 1000) {
          this.accessToken = token;
          if (profileStr) {
            this.userProfile = JSON.parse(profileStr);
          }
        } else {
          this._clearSession();
        }
      }
    } catch (e) {
      console.warn('Failed to restore auth session from localStorage:', e);
      this._clearSession();
    }
  }

  _clearSession() {
    this.accessToken = null;
    this.userProfile = null;
    localStorage.removeItem('taskflow_access_token');
    localStorage.removeItem('taskflow_token_expires_at');
    localStorage.removeItem('taskflow_user_profile');
  }

  _loadGapi() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.gapi) {
          gapi.load('client', async () => {
            await gapi.client.init({});
            this.gapiInited = true;
            resolve();
          });
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  _loadGis() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.google?.accounts?.oauth2) {
          this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            scope: CONFIG.GMAIL_SCOPES,
            callback: (response) => {
              if (response.error) {
                console.error('Auth error:', response);
                return;
              }
              this.accessToken = response.access_token;
              
              // Persist access token and expiration
              try {
                const expiresIn = response.expires_in || 3600;
                const expiresAt = Date.now() + expiresIn * 1000;
                localStorage.setItem('taskflow_access_token', this.accessToken);
                localStorage.setItem('taskflow_token_expires_at', expiresAt);
              } catch (e) {
                console.warn('Failed to save auth token to localStorage:', e);
              }

              this._fetchUserProfile();
            },
          });
          this.gisInited = true;
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  async _fetchUserProfile() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (!res.ok) {
        throw new Error(`Profile fetch returned status ${res.status}`);
      }
      this.userProfile = await res.json();
      
      try {
        localStorage.setItem('taskflow_user_profile', JSON.stringify(this.userProfile));
      } catch (e) {
        console.warn('Failed to save user profile to localStorage:', e);
      }

      this._notifyListeners();
    } catch (e) {
      console.error('Failed to fetch profile:', e);
      this._notifyListeners();
    }
  }

  signIn() {
    if (this.tokenClient) {
      if (this.accessToken) {
        this.tokenClient.requestAccessToken({ prompt: '' });
      } else {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      }
    }
  }

  switchAccount() {
    if (this.tokenClient) {
      // Force the account selector to appear
      this.tokenClient.requestAccessToken({ prompt: 'select_account' });
    }
  }

  signOut() {
    if (this.accessToken) {
      try {
        google.accounts.oauth2.revoke(this.accessToken);
      } catch (e) {
        console.warn('Failed to revoke Google token:', e);
      }
    }
    this._clearSession();
    this._notifyListeners();
  }

  getToken() { return this.accessToken; }
  isSignedIn() { return !!this.accessToken; }
  getUserProfile() { return this.userProfile; }

  onAuthChange(callback) {
    this.listeners.push(callback);
    // Notify immediately with the current authentication status
    callback(this.isSignedIn(), this.userProfile);
    return () => { this.listeners = this.listeners.filter(l => l !== callback); };
  }

  _notifyListeners() {
    this.listeners.forEach(cb => cb(this.isSignedIn(), this.userProfile));
  }
}

export const authService = new AuthService();
