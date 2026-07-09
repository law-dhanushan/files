// Microsoft Sign-In Integration using MSAL.js

let msalInstance = null;
let msalConfig = {
  auth: {
    clientId: AUTH_CONFIG.microsoft.clientId,
    authority: AUTH_CONFIG.microsoft.authority,
    redirectUri: AUTH_CONFIG.microsoft.redirectUri,
    postLogoutRedirectUri: '/'
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true
  },
  system: {
    allowNativeBrowserCaching: true
  }
};

async function initMicrosoftSignIn() {
  if (!AUTH_CONFIG.microsoft.clientId || AUTH_CONFIG.microsoft.clientId.includes('YOUR_MICROSOFT')) {
    console.warn('Microsoft Client ID not configured. Please set AUTH_CONFIG.microsoft.clientId');
    return;
  }

  try {
    const script = document.createElement('script');
    script.src = 'https://alcdn.msauth.net/browser/2.30.0/js/msal-browser.min.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = async () => {
      const { PublicClientApplication } = window.msal;
      msalInstance = new PublicClientApplication(msalConfig);
      await msalInstance.initialize();

      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        handleMicrosoftSignIn(accounts[0]);
      }
    };
  } catch (error) {
    console.error('MSAL initialization error:', error);
  }
}

async function handleMicrosoftSignInClick() {
  if (!msalInstance) {
    showToast('Microsoft authentication not initialized', 'error');
    return;
  }

  try {
    const loginResponse = await msalInstance.loginPopup({
      scopes: ['user.read', 'files.readwrite']
    });
    handleMicrosoftSignIn(loginResponse.account);
  } catch (error) {
    console.error('Microsoft sign-in error:', error);
    showToast('Microsoft sign-in failed. Please try again.', 'error');
  }
}

async function handleMicrosoftSignIn(account) {
  try {
    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes: ['user.read', 'files.readwrite'],
      account: account
    }).catch(async () => {
      return msalInstance.acquireTokenPopup({
        scopes: ['user.read', 'files.readwrite'],
        account: account
      });
    });

    const userProfile = await fetchMicrosoftUserProfile(tokenResponse.accessToken);

    authState = {
      isLoggedIn: true,
      user: {
        id: account.localAccountId,
        name: account.name,
        email: account.username,
        picture: null
      },
      provider: 'microsoft',
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken || null,
      expiresAt: new Date(Date.now() + (tokenResponse.expiresIn * 1000)).toISOString()
    };

    saveAuthState();
    updateAuthUI();
    startPeriodicSync();
    syncDataWithCloud();
    showToast(`Welcome ${account.name}! Your data will auto-sync.`, 'success');
  } catch (error) {
    console.error('Microsoft sign-in handle error:', error);
    showToast('Failed to complete sign-in', 'error');
  }
}

async function fetchMicrosoftUserProfile(accessToken) {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (response.ok) return await response.json();
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
  }
  return null;
}

async function microsoftSignOut() {
  if (!msalInstance) return;
  try {
    await msalInstance.logout();
    logout();
  } catch (error) {
    console.error('Microsoft sign-out error:', error);
    logout();
  }
}
