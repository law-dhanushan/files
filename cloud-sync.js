// Cloud Synchronization Module

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
let syncTimer = null;
let isSyncing = false;

function initCloudSync() {
  loadAuthState();
  if (isAuthenticated()) {
    startPeriodicSync();
    syncDataWithCloud();
  }
}

function startPeriodicSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    if (isAuthenticated() && !isSyncing) {
      syncDataWithCloud();
    }
  }, SYNC_INTERVAL);
}

function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function syncDataWithCloud() {
  if (!isAuthenticated() || isSyncing) return;
  isSyncing = true;
  try {
    if (authState.provider === 'microsoft') {
      await syncWithMicrosoft();
    } else if (authState.provider === 'google') {
      await syncWithGoogle();
    }
    updateSyncStatus('success');
  } catch (error) {
    console.error('Cloud sync error:', error);
    updateSyncStatus('error', error.message);
  } finally {
    isSyncing = false;
  }
}

async function syncWithMicrosoft() {
  const token = authState.accessToken;
  const dataToSync = {
    files: files,
    lastSyncTime: new Date().toISOString(),
    userId: authState.user.id
  };

  // Upload data
  const uploadResponse = await fetch(
    `${CLOUD_CONFIG.oneDrive.endpoint}/me/drive/root:/${CLOUD_CONFIG.oneDrive.dataFileName}:/content`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataToSync)
    }
  );

  if (!uploadResponse.ok) {
    throw new Error(`Microsoft Graph error: ${uploadResponse.statusText}`);
  }

  // Download latest data
  const downloadResponse = await fetch(
    `${CLOUD_CONFIG.oneDrive.endpoint}/me/drive/root:/${CLOUD_CONFIG.oneDrive.dataFileName}:/content`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (downloadResponse.ok) {
    const cloudData = await downloadResponse.json();
    mergeCloudData(cloudData);
  }
  console.log('✓ Data synced with Microsoft OneDrive');
}

async function syncWithGoogle() {
  const token = authState.accessToken;
  const dataToSync = {
    files: files,
    lastSyncTime: new Date().toISOString(),
    userId: authState.user.id
  };

  // Check if file exists
  const searchResponse = await fetch(
    `${CLOUD_CONFIG.googleDrive.endpoint}/files?q=name='${CLOUD_CONFIG.googleDrive.dataFileName}' and trashed=false&spaces=drive&pageSize=1`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const searchData = await searchResponse.json();
  let fileId = searchData.files?.[0]?.id;

  if (fileId) {
    await fetch(
      `${CLOUD_CONFIG.googleDrive.endpoint}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSync)
      }
    );
  } else {
    const metadata = { name: CLOUD_CONFIG.googleDrive.dataFileName, mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(dataToSync)], { type: 'application/json' }));

    const createResponse = await fetch(
      `${CLOUD_CONFIG.googleDrive.endpoint}/files?uploadType=multipart&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      }
    );
    const result = await createResponse.json();
    fileId = result.id;
  }

  console.log('✓ Data synced with Google Drive');
}

function mergeCloudData(cloudData) {
  if (!cloudData || !cloudData.files || !Array.isArray(cloudData.files)) return;

  const cloudFiles = cloudData.files;
  const localMap = new Map(files.map(f => [f.id, f]));

  cloudFiles.forEach(cloudFile => {
    const localFile = localMap.get(cloudFile.id);
    if (!localFile) {
      files.push(cloudFile);
    } else {
      const cloudTime = new Date(cloudFile.updatedAt || cloudFile.createdAt);
      const localTime = new Date(localFile.updatedAt || localFile.createdAt);
      if (cloudTime > localTime) {
        Object.assign(localFile, cloudFile);
      }
    }
  });

  localStorage.setItem('docusync_files', JSON.stringify(files));
  renderDashboard();
}

function updateSyncStatus(status, message = '') {
  const statusEl = document.getElementById('sync-status');
  if (!statusEl) return;

  if (status === 'syncing') {
    statusEl.innerHTML = '<span class="text-xs text-blue-500">⟳ Syncing...</span>';
  } else if (status === 'success') {
    statusEl.innerHTML = '<span class="text-xs text-green-500">✓ Synced</span>';
    setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 3000);
  } else if (status === 'error') {
    statusEl.innerHTML = `<span class="text-xs text-red-500">✗ ${message}</span>`;
    setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 5000);
  }
}

async function manualSync() {
  if (!isAuthenticated()) {
    showToast('Please sign in first to sync data', 'error');
    return;
  }
  updateSyncStatus('syncing');
  await syncDataWithCloud();
}

async function requestBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-data');
      console.log('Background sync registered');
    } catch (error) {
      console.log('Background sync not supported:', error);
    }
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.type === 'SYNC_DATA') {
      syncDataWithCloud();
    }
  });
}
