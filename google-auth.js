// Google Sign-In Integration using Google Identity Services

let googleClientId = AUTH_CONFIG.google.clientId;

function initGoogleSignIn() {
  if (!googleClientId || googleClientId.includes('YOUR_GOOGLE')) {
    console.warn('Google Client ID not configured. Please set AUTH_CONFIG.google.clientId');
    return;
  }

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
    renderGoogleSignInButton();
  };
}

async function handleGoogleSignIn(response) {
  try {
    const token = response.credential;
    const userInfo = parseJwt(token);

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
    startPeriodicSync();
    syncDataWithCloud();
    showToast(`Welcome ${userInfo.name}! Your data will auto-sync.`, 'success');
  } catch (error) {
    console.error('Google sign-in error:', error);
    showToast('Sign-in failed. Please try again.', 'error');
  }
}

function renderGoogleSignInButton() {
  const container = document.getElementById('google-signin-button');
  if (!container || !window.google) return;
  try {
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      width: '100%'
    });
  } catch (error) {
    console.error('Google button render error:', error);
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('JWT parse error:', error);
    return null;
  }
}
