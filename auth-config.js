// Authentication Configuration
// IMPORTANT: Replace these values with your actual OAuth credentials

const AUTH_CONFIG = {
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    // Get from: https://console.cloud.google.com
    // Create OAuth 2.0 Client ID (Web application)
  },
  microsoft: {
    clientId: 'YOUR_MICROSOFT_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: 'https://your-domain.com/callback',
    // Get from: https://portal.azure.com
    scopes: ['user.read', 'files.readwrite'],
  }
};

// Cloud Storage Configuration
const CLOUD_CONFIG = {
  oneDrive: {
    endpoint: 'https://graph.microsoft.com/v1.0',
    appFolderId: '/drive/root:/FileManagementData',
    dataFileName: 'files-data-sync.json'
  },
  googleDrive: {
    endpoint: 'https://www.googleapis.com/drive/v3',
    folderId: 'FILE_MANAGEMENT_FOLDER_ID',
    dataFileName: 'files-data-sync.json'
  }
};

// Auth state management
let authState = {
  isLoggedIn: false,
  user: null,
  provider: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

// Save auth state to localStorage
function saveAuthState() {
  localStorage.setItem('auth_state', JSON.stringify(authState));
}

// Load auth state from localStorage
function loadAuthState() {
  const stored = localStorage.getItem('auth_state');
  if (stored) {
    authState = JSON.parse(stored);
    if (authState.expiresAt && new Date() > new Date(authState.expiresAt)) {
      logout();
    }
  }
}

// Check if user is authenticated
function isAuthenticated() {
  return authState.isLoggedIn && authState.accessToken;
}

// Get current auth token
function getAuthToken() {
  return authState.accessToken;
}

// Get user info
function getUserInfo() {
  return authState.user;
}

// Logout function
function logout() {
  authState = {
    isLoggedIn: false,
    user: null,
    provider: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  };
  localStorage.removeItem('auth_state');
  stopPeriodicSync();
  updateAuthUI();
  showToast('Signed out successfully', 'success');
}

// Update UI based on auth state
function updateAuthUI() {
  const authContainer = document.getElementById('auth-container');
  if (!authContainer) return;

  if (isAuthenticated()) {
    const user = getUserInfo();
    authContainer.innerHTML = `
      <div class="flex items-center space-x-3">
        ${user.picture ? `<img src="${user.picture}" class="w-8 h-8 rounded-full"/>` : ''}
        <div class="flex flex-col">
          <span class="text-xs font-bold text-slate-700">${user.name}</span>
          <span class="text-[10px] text-slate-500">${user.email}</span>
        </div>
        <button onclick="logout()" class="ml-4 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200">
          Sign Out
        </button>
      </div>
    `;
  } else {
    authContainer.innerHTML = `
      <div class="flex flex-col space-y-2">
        <div id="google-signin-button"></div>
        <button onclick="handleMicrosoftSignInClick()" class="w-full bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 border-gray-300 transition-all flex items-center justify-center space-x-2">
          <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#00A4EF" d="M11.4 24H0V12.6h11.4V24z"/><path fill="#7FBA00" d="M24 24H12.6V12.6H24V24z"/><path fill="#00A4EF" d="M11.4 11.4H0V0h11.4v11.4z"/><path fill="#FFB900" d="M24 11.4H12.6V0H24v11.4z"/></svg>
          <span>Sign in with Microsoft</span>
        </button>
      </div>
    `;
    if (window.google) {
      renderGoogleSignInButton();
    }
  }
}
