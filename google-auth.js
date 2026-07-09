// Google Sign-In Integration using Google Identity Services
// Reference: https://developers.google.com/identity/gsi/web

let googleClientId = AUTH_CONFIG.google.clientId;

// Initialize Google Sign-In
function initGoogleSignIn() {
  if (!googleClientId || googleClientId.includes('YOUR_GOOGLE')) {
    console.warn('Google Client ID not configured. Please set AUTH_CONFIG.google.clientId');
    return;
  }

  // Load Google Identity Services library
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);

  script.onload = () => {
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleSignIn,
      auto_select: false,
      itp_support: true
    });
  };
}

// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
  try {
    const token = response.credential;
    
    // Decode JWT token to get user info
    const userInfo = parseJwt(token);
    
    // Store auth state
    authState = {
      isLoggedIn: true,
      user: {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture
      },
      provider: 'google',
      accessToken: token,
      refreshToken: null,
      expiresAt: new Date(userInfo.exp * 1000).toISOString()
    };
    
    saveAuthState();
    updateAuthUI();
    
    // Start sync
    startPeriodicSync();
    syncDataWithCloud();
    
    showToast(`Welcome ${userInfo.name}! Your data will auto-sync.`, 'success');
  } catch (error) {
    console.error('Google sign-in error:', error);
    showToast('Sign-in failed. Please try again.', 'error');
  }
}

// Render Google Sign-In button
function renderGoogleSignInButton() {
  const container = document.getElementById('google-signin-button');
  if (!container || !window.google) return;
  
  try {
    google.accounts.id.renderButton(
      container,
      {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        logo_alignment: 'left',
        width: '100%'
      }
    );
  } catch (error) {
    console.error('Google button render error:', error);
  }
}

// Google Sign-Out
async function googleSignOut() {
  google.accounts.id.disableAutoSelect();
  logout();
}

// Parse JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('JWT parse error:', error);
    return null;
  }
}

// Refresh Google token
async function refreshGoogleToken() {
  if (!isAuthenticated() || authState.provider !== 'google') {
    return false;
  }

  // Google tokens from GSI are short-lived
  // Client-side libraries don't support refresh for GSI
  // Users will need to sign in again when token expires
  console.log('Token expired. User needs to sign in again.');
  logout();
  return false;
}

// Get Google Drive access token for file operations
async function getGoogleAccessToken() {
  // Note: GSI doesn't provide access tokens for APIs
  // For Drive operations, you need to use Google API Client Library
  // This would require additional setup with OAuth 2.0 code flow
  console.warn('Google API access requires additional OAuth setup');
  return null;
}
