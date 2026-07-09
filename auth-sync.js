// ============================================================
// AUTHENTICATION & CLOUD SYNC MODULE
// Supports Google Sign-In and Microsoft Sign-In
// Syncs data to cloud automatically
// ============================================================

class AuthSyncManager {
  constructor() {
    this.googleClientId = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // Add your Google Client ID
    this.microsoftClientId = 'YOUR_MICROSOFT_CLIENT_ID'; // Add your Microsoft Client ID
    this.currentUser = JSON.parse(localStorage.getItem('app_current_user')) || null;
    this.syncEnabled = localStorage.getItem('app_sync_enabled') === 'true';
    this.lastSyncTime = localStorage.getItem('app_last_sync_time') || null;
    this.syncInProgress = false;
  }

  // ============================================================
  // GOOGLE SIGN-IN
  // ============================================================
  async initializeGoogleSignIn() {
    return new Promise((resolve) => {
      // Load Google Identity Services library
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: (response) => this.handleGoogleSignIn(response),
            auto_select: false,
            itp_support: true
          });
          resolve(true);
        }
      };
      document.head.appendChild(script);
    });
  }

  handleGoogleSignIn(response) {
    if (response.credential) {
      // Decode JWT token
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map((c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );

      const userData = JSON.parse(jsonPayload);
      this.setCurrentUser({
        id: userData.sub,
        name: userData.name,
        email: userData.email,
        picture: userData.picture,
        provider: 'google',
        accessToken: response.credential
      });

      showToast(`Welcome ${userData.name}!`, 'success');
      this.startAutoSync();
    }
  }

  // ============================================================
  // MICROSOFT SIGN-IN
  // ============================================================
  async initializeMicrosoftSignIn() {
    return new Promise((resolve) => {
      // Load Microsoft Authentication Library
      const script = document.createElement('script');
      script.src = 'https://alcdn.msftauth.net/lib/1.4.17/js/msal.min.js';
      script.async = true;
      script.onload = () => {
        if (window.msal) {
          const msalConfig = {
            auth: {
              clientId: this.microsoftClientId,
              authority: 'https://login.microsoftonline.com/common',
              redirectUri: window.location.origin + '/files/'
            },
            cache: {
              cacheLocation: 'localStorage',
              storeAuthStateInCookie: false
            }
          };

          this.msalInstance = new msal.PublicClientApplication(msalConfig);
          this.msalInstance.handleRedirectPromise();
          resolve(true);
        }
      };
      document.head.appendChild(script);
    });
  }

  async handleMicrosoftSignIn() {
    try {
      const loginResponse = await this.msalInstance.loginPopup({
        scopes: ['User.Read', 'offline_access']
      });

      if (loginResponse && loginResponse.accessToken) {
        // Get user profile
        const accountInfo = this.msalInstance.getActiveAccount();
        
        this.setCurrentUser({
          id: accountInfo.homeAccountId,
          name: accountInfo.name,
          email: accountInfo.username,
          provider: 'microsoft',
          accessToken: loginResponse.accessToken,
          refreshToken: loginResponse.refreshToken
        });

        showToast(`Welcome ${accountInfo.name}!`, 'success');
        this.startAutoSync();
      }
    } catch (error) {
      console.error('Microsoft sign-in error:', error);
      showToast('Microsoft sign-in failed', 'error');
    }
  }

  // ============================================================
  // USER MANAGEMENT
  // ============================================================
  setCurrentUser(userData) {
    this.currentUser = userData;
    localStorage.setItem('app_current_user', JSON.stringify(userData));
    this.updateUIWithUser();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isUserLoggedIn() {
    return this.currentUser !== null;
  }

  async logout() {
    const provider = this.currentUser?.provider;

    if (provider === 'google') {
      google.accounts.id.revoke(this.currentUser.email, () => {
        console.log('Google sign-out successful');
      });
    } else if (provider === 'microsoft' && this.msalInstance) {
      this.msalInstance.logout();
    }

    this.currentUser = null;
    localStorage.removeItem('app_current_user');
    localStorage.setItem('app_sync_enabled', 'false');
    this.syncEnabled = false;
    this.updateUIWithUser();
    showToast('Signed out successfully', 'success');
  }

  // ============================================================
  // CLOUD SYNC FUNCTIONS
  // ============================================================
  async startAutoSync() {
    this.syncEnabled = true;
    localStorage.setItem('app_sync_enabled', 'true');

    // Initial sync
    await this.syncDataToCloud();

    // Auto-sync every 5 minutes
    setInterval(() => {
      if (this.syncEnabled && this.isUserLoggedIn()) {
        this.syncDataToCloud();
      }
    }, 5 * 60 * 1000);

    // Sync on before unload
    window.addEventListener('beforeunload', () => {
      if (this.syncEnabled) {
        this.syncDataToCloud();
      }
    });
  }

  async syncDataToCloud() {
    if (!this.currentUser || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      const syncPayload = {
        userId: this.currentUser.id,
        email: this.currentUser.email,
        provider: this.currentUser.provider,
        files: files,
        timestamp: new Date().toISOString(),
        appVersion: '2.0'
      };

      // Send to backend (replace with your actual backend URL)
      const response = await fetch('https://your-backend-api.com/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentUser.accessToken}`
        },
        body: JSON.stringify(syncPayload)
      }).catch(() => {
        // Offline - data will sync when back online
        console.log('Sync failed (offline mode) - will retry when connected');
        return null;
      });

      if (response && response.ok) {
        const result = await response.json();
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem('app_last_sync_time', this.lastSyncTime);
        console.log('Data synced successfully to cloud');
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async pullDataFromCloud() {
    if (!this.currentUser) {
      return;
    }

    try {
      const response = await fetch(
        `https://your-backend-api.com/api/sync?userId=${this.currentUser.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.currentUser.accessToken}`
          }
        }
      ).catch(() => {
        console.log('Pull failed (offline mode)');
        return null;
      });

      if (response && response.ok) {
        const result = await response.json();
        if (result.files && Array.isArray(result.files)) {
          // Merge cloud data with local data
          files = this.mergeDataSets(files, result.files);
          localStorage.setItem('docusync_files', JSON.stringify(files));
          switchTab(activeTab);
          showToast('Data pulled from cloud successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Pull error:', error);
    }
  }

  mergeDataSets(localFiles, cloudFiles) {
    const merged = [...localFiles];
    
    cloudFiles.forEach(cloudFile => {
      const existingIndex = merged.findIndex(f => f.id === cloudFile.id);
      
      if (existingIndex === -1) {
        // New file from cloud
        merged.push(cloudFile);
      } else {
        // Update if cloud version is newer
        if (new Date(cloudFile.updatedAt) > new Date(merged[existingIndex].updatedAt)) {
          merged[existingIndex] = cloudFile;
        }
      }
    });

    return merged;
  }

  // ============================================================
  // UI UPDATES
  // ============================================================
  updateUIWithUser() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    if (this.currentUser) {
      authContainer.innerHTML = `
        <div class="flex items-center gap-3">
          <img src="${this.currentUser.picture || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2712%22 r=%2710%22 fill=%22%23cbd5e1%22/></svg>'}" 
               alt="${this.currentUser.name}" 
               class="w-8 h-8 rounded-full border border-slate-300" />
          <div class="hidden sm:block text-xs">
            <p class="font-bold text-slate-900">${escapeHtml(this.currentUser.name)}</p>
            <p class="text-slate-500 text-[10px]">${escapeHtml(this.currentUser.provider)}</p>
          </div>
          <button onclick="authSyncManager.logout()" 
                  class="ml-2 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold">
            Sign Out
          </button>
        </div>
      `;
    } else {
      authContainer.innerHTML = `
        <div class="flex gap-2">
          <button onclick="authSyncManager.initializeGoogleSignIn().then(() => authSyncManager.renderGoogleButton())"
                  class="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg text-xs font-bold border border-slate-300">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button onclick="authSyncManager.initializeMicrosoftSignIn().then(() => authSyncManager.handleMicrosoftSignIn())"
                  class="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg text-xs font-bold border border-slate-300">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
            </svg>
            Microsoft
          </button>
        </div>
      `;
    }
  }

  renderGoogleButton() {
    const container = document.getElementById('google-signin-button');
    if (container && window.google) {
      google.accounts.id.renderButton(container, {
        type: 'standard',
        size: 'large',
        text: 'signin_with'
      });
    }
  }
}

// Initialize Auth Manager
let authSyncManager = new AuthSyncManager();

// Function to check sync status
function getSyncStatus() {
  if (!authSyncManager.isUserLoggedIn()) {
    return 'Not signed in';
  }
  if (authSyncManager.syncInProgress) {
    return 'Syncing...';
  }
  if (authSyncManager.lastSyncTime) {
    return `Synced: ${new Date(authSyncManager.lastSyncTime).toLocaleTimeString()}`;
  }
  return 'Ready to sync';
}

// Manual sync trigger
async function triggerManualSync() {
  if (!authSyncManager.isUserLoggedIn()) {
    showToast('Please sign in first', 'error');
    return;
  }
  showToast('Syncing data...', 'success');
  await authSyncManager.syncDataToCloud();
  showToast('Sync complete!', 'success');
}

// Manual pull from cloud
async function triggerCloudPull() {
  if (!authSyncManager.isUserLoggedIn()) {
    showToast('Please sign in first', 'error');
    return;
  }
  showToast('Pulling data from cloud...', 'success');
  await authSyncManager.pullDataFromCloud();
}
