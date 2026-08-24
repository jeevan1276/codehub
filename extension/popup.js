// CodeHub - Popup Script

import { MESSAGE_TYPES, STORAGE_KEYS, QUEUE_STATUS } from './constants.js';
import { formatTimeAgo, getPlatformDisplayName } from './utils.js';

let currentQueue = [];
let rateLimitInfo = { remaining: 5000, reset: 0 };

// DOM Elements
const elements = {
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.querySelector('.status-indicator .text'),
  pendingCount: document.getElementById('pendingCount'),
  processingCount: document.getElementById('processingCount'),
  completedCount: document.getElementById('completedCount'),
  failedCount: document.getElementById('failedCount'),
  queueList: document.getElementById('queueList'),
  retryBtn: document.getElementById('retryBtn'),
  syncBtn: document.getElementById('syncBtn'),
  optionsBtn: document.getElementById('optionsBtn'),
  rateLimit: document.getElementById('rateLimit'),
  lastSync: document.getElementById('lastSync'),
  githubLink: document.getElementById('githubLink')
};

// Initialize popup
async function init() {
  await loadData();
  setupEventListeners();
  startPeriodicUpdate();
}

// Load data from background
async function loadData() {
  try {
    // Get queue
    const queueResponse = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_QUEUE });
    if (queueResponse?.queue) {
      currentQueue = queueResponse.queue;
      renderQueue();
      updateStats();
    }

    // Get config for status
    const configResponse = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_CONFIG });
    if (configResponse?.config) {
      updateConnectionStatus(configResponse.config);
    }

    // Get rate limit
    const rateLimitResponse = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_RATE_LIMIT });
    if (rateLimitResponse?.rateLimit) {
      rateLimitInfo = rateLimitResponse.rateLimit;
      updateRateLimit();
    }

    // Get last sync time
    const storage = await chrome.storage.local.get([STORAGE_KEYS.LAST_SYNC]);
    if (storage[STORAGE_KEYS.LAST_SYNC]) {
      updateLastSync(storage[STORAGE_KEYS.LAST_SYNC]);
    }
  } catch (e) {
    console.error('Failed to load popup data:', e);
    setStatus('error', 'Error');
  }
}

// Setup event listeners
function setupEventListeners() {
  elements.retryBtn.addEventListener('click', handleRetry);
  elements.syncBtn.addEventListener('click', handleSync);
  elements.optionsBtn.addEventListener('click', handleOptions);
  elements.githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/yourusername/codehub' });
  });

  // Listen for queue updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'QUEUE_UPDATED') {
      currentQueue = message.queue;
      renderQueue();
      updateStats();
    } else if (message.type === 'RATE_LIMIT_UPDATED') {
      rateLimitInfo = message.rateLimit;
      updateRateLimit();
    } else if (message.type === 'SYNC_COMPLETE') {
      setStatus('connected', 'Connected');
      updateLastSync(Date.now());
    } else if (message.type === 'SYNC_STARTED') {
      setStatus('syncing', 'Syncing...');
    } else if (message.type === 'SYNC_ERROR') {
      setStatus('error', 'Sync Failed');
    }
  });
}

// Start periodic update
function startPeriodicUpdate() {
  setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_QUEUE });
      if (response?.queue) {
        currentQueue = response.queue;
        renderQueue();
        updateStats();
      }
    } catch {}
  }, 5000);
}

// Update connection status
function updateConnectionStatus(config) {
  // Config now uses 'pat' and 'repo' (canonical keys from background.js)
  const hasToken = config.pat && config.pat !== '***' && config.pat.length > 0;
  const hasRepo = config.repo && config.repo.length > 0;

  if (hasToken && hasRepo) {
    setStatus('connected', 'Connected');
  } else if (hasToken) {
    setStatus('syncing', 'No Repo');
  } else {
    setStatus('error', 'Not Configured');
  }
}

function setStatus(status, text) {
  elements.statusIndicator.className = `status-indicator ${status}`;
  elements.statusText.textContent = text;
}

// Update stats
function updateStats() {
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };

  for (const item of currentQueue) {
    if (stats.hasOwnProperty(item.status)) {
      stats[item.status]++;
    }
  }

  elements.pendingCount.textContent = stats.pending;
  elements.processingCount.textContent = stats.processing;
  elements.completedCount.textContent = stats.completed;
  elements.failedCount.textContent = stats.failed;

  elements.pendingCount.className = 'stat-value pending';
  elements.processingCount.className = 'stat-value processing';
  elements.completedCount.className = 'stat-value completed';
  elements.failedCount.className = 'stat-value failed';

  // Enable/disable retry button
  elements.retryBtn.disabled = stats.failed === 0;
}

// Render queue list
function renderQueue() {
  if (currentQueue.length === 0) {
    elements.queueList.innerHTML = '<div class="empty-state">No submissions in queue</div>';
    return;
  }

  // Sort: processing first, then pending, then failed, then completed
  const statusOrder = { processing: 0, pending: 1, failed: 2, completed: 3 };
  const sortedQueue = [...currentQueue].sort((a, b) => {
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  });

  // Show only recent 20 items
  const displayQueue = sortedQueue.slice(0, 20);

  elements.queueList.innerHTML = displayQueue.map(item => renderQueueItem(item)).join('');
}

function renderQueueItem(item) {
  const statusIcons = {
    pending: '⏳',
    processing: '⟳',
    completed: '✓',
    failed: '✕'
  };

  // Queue items store submission details under item.submission
  const submission = item.submission || {};
  const problemName = submission.problemName || item.problemName || 'Unknown Problem';
  const platform = submission.platform || item.platform || '';
  const language = submission.language || item.language || '';

  const platformDisplay = getPlatformDisplayName(platform);
  const timeAgo = formatTimeAgo(item.createdAt || item.timestamp || Date.now());

  return `
    <div class="queue-item ${item.status}">
      <div class="queue-item-icon">${statusIcons[item.status] || '?'}</div>
      <div class="queue-item-content">
        <div class="queue-item-problem" title="${escapeHtml(problemName)}">${escapeHtml(problemName)}</div>
        <div class="queue-item-meta">
          <span class="queue-item-platform">${escapeHtml(platformDisplay)}</span>
          <span class="queue-item-language">${escapeHtml(language)}</span>
          <span>${timeAgo}</span>
        </div>
        ${item.error ? `<div class="queue-item-error">${escapeHtml(item.error)}</div>` : ''}
      </div>
    </div>
  `;
}

// Update rate limit display
function updateRateLimit() {
  const { remaining, reset } = rateLimitInfo;
  elements.rateLimit.textContent = `Rate limit: ${remaining}/5000`;

  elements.rateLimit.className = 'rate-limit';
  if (remaining < 100) {
    elements.rateLimit.classList.add('danger');
  } else if (remaining < 500) {
    elements.rateLimit.classList.add('warning');
  }
}

// Update last sync time
function updateLastSync(timestamp) {
  elements.lastSync.textContent = `Last sync: ${formatTimeAgo(timestamp)}`;
}


// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle retry failed
async function handleRetry() {
  elements.retryBtn.disabled = true;
  elements.retryBtn.textContent = 'Retrying...';

  try {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RETRY_PENDING });
    setStatus('syncing', 'Retrying...');
  } catch (e) {
    console.error('Retry failed:', e);
  } finally {
    setTimeout(() => {
      elements.retryBtn.disabled = false;
      elements.retryBtn.textContent = 'Retry Failed';
    }, 2000);
  }
}

// Handle manual sync
async function handleSync() {
  elements.syncBtn.disabled = true;
  elements.syncBtn.textContent = 'Syncing...';

  try {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.MANUAL_SYNC });
  } catch (e) {
    console.error('Sync failed:', e);
  } finally {
    setTimeout(() => {
      elements.syncBtn.disabled = false;
      elements.syncBtn.textContent = 'Sync Now';
    }, 2000);
  }
}

// Handle options click
function handleOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);