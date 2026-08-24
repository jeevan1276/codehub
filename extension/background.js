// CodeHub - Background Service Worker
// Main orchestrator handling messages, queue processing, alarms, and webNavigation

import { storage } from './storage.js';
import { github } from './github.js';
import {
  PLATFORMS,
  MESSAGE_TYPES,
  ALARM_NAMES,
  QUEUE_STATUS,
  GITHUB_API
} from './constants.js';
import { generateId, sleep } from './utils.js';

// Initialize GitHub client with stored credentials
async function initGitHubClient() {
  const config = await storage.getConfig();
  if (config.pat && config.repo) {
    github.setCredentials(config.pat, config.repo, config.branch || 'main');
  }
}

// Process the push queue
async function processQueue() {
  if (!navigator.onLine) {
    console.log('Offline. Queue will be processed when online.');
    return;
  }

  const queue = await storage.getQueue();
  const pendingItems = queue.filter(item =>
    item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.RETRYING
  );

  if (pendingItems.length === 0) return;

  for (const item of pendingItems) {
    try {
      await storage.updateQueueItem(item.id, { status: QUEUE_STATUS.RETRYING, lastAttempt: Date.now() });

      const result = await github.pushSubmission(item.submission);

      if (result.skipped) {
        await storage.updateQueueItem(item.id, { status: QUEUE_STATUS.COMPLETED });
      } else {
        await storage.updateQueueItem(item.id, { status: QUEUE_STATUS.COMPLETED });
        await storage.addToHistory({
          type: 'sync',
          platform: item.submission.platform,
          problemName: item.submission.problemName,
          status: 'success',
          details: result
        });
        
        const config = await storage.getConfig();
        if (config.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.svg',
            title: 'CodeHub Sync Successful',
            message: `Successfully synced ${item.submission.problemName} (${item.submission.language})`
          });
        }
      }

      // Notify popup of queue update
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.QUEUE_UPDATED }).catch(() => {});

    } catch (error) {
      console.error(`Failed to push submission ${item.id}:`, error);

      const isRateLimited = error.message.startsWith('RATE_LIMITED:');
      const isConflict = error.message === 'CONFLICT';
      const isAuthError = error.message === 'INVALID_PAT';

      if (isAuthError) {
        // Mark all pending as failed
        await storage.updateQueue(queue =>
          queue.map(i => i.status === QUEUE_STATUS.PENDING || i.status === QUEUE_STATUS.RETRYING
            ? { ...i, status: QUEUE_STATUS.FAILED, error: 'Invalid PAT' }
            : i
          )
        );
        break;
      }

      if (isConflict) {
        // Retry with fresh SHA - re-fetch and retry
        await storage.updateQueueItem(item.id, {
          status: QUEUE_STATUS.RETRYING,
          retryCount: (item.retryCount || 0) + 1,
          error: 'SHA conflict, retrying...'
        });
        continue; // Will retry in next cycle
      }

      const retryCount = (item.retryCount || 0) + 1;
      const maxRetries = GITHUB_API.RATE_LIMIT.MAX_RETRIES;

      if (retryCount >= maxRetries) {
        await storage.updateQueueItem(item.id, {
          status: QUEUE_STATUS.FAILED,
          error: error.message,
          retryCount
        });
        await storage.addToHistory({
          type: 'sync',
          platform: item.submission.platform,
          problemName: item.submission.problemName,
          status: 'failed',
          error: error.message
        });

        const config = await storage.getConfig();
        if (config.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.svg',
            title: 'CodeHub Sync Failed',
            message: `Failed to sync ${item.submission.problemName}: ${error.message}`
          });
        }
      } else {
        // Exponential backoff
        const backoff = Math.min(
          1000 * Math.pow(2, retryCount - 1) + Math.random() * 1000,
          GITHUB_API.RATE_LIMIT.MAX_BACKOFF_MS
        );

        await storage.updateQueueItem(item.id, {
          status: QUEUE_STATUS.RETRYING,
          retryCount,
          nextRetry: Date.now() + backoff,
          error: error.message
        });

        // Schedule retry alarm
        chrome.alarms.create(ALARM_NAMES.RETRY_PENDING, {
          delayInMinutes: Math.ceil(backoff / 60000)
        });
      }
    }
  }
}

// Handle submission detected from content script
async function handleSubmissionDetected(message) {
  const config = await storage.getConfig();

  if (!config.autoSync) {
    // Add to queue but don't process immediately
    await storage.addToQueue({
      id: generateId(),
      submission: message.submission,
      status: QUEUE_STATUS.PENDING,
      createdAt: Date.now()
    });
    return;
  }

  if (!config.pat || !config.repo) {
    // No credentials configured, queue for later
    await storage.addToQueue({
      id: generateId(),
      submission: message.submission,
      status: QUEUE_STATUS.PENDING,
      createdAt: Date.now(),
      error: 'No GitHub credentials configured'
    });
    return;
  }

  // Check if platform is enabled
  if (!config.enabledPlatforms[message.submission.platform]) {
    return;
  }

  // Add to queue and process
  await storage.addToQueue({
    id: generateId(),
    submission: message.submission,
    status: QUEUE_STATUS.PENDING,
    createdAt: Date.now()
  });

  await processQueue();
}

// Handle manual sync request
async function handleManualSync() {
  await processQueue();
}

// Handle retry pending items
async function handleRetryPending() {
  const queue = await storage.getQueue();
  const failedItems = queue.filter(item => item.status === QUEUE_STATUS.FAILED);

  for (const item of failedItems) {
    await storage.updateQueueItem(item.id, { status: QUEUE_STATUS.PENDING, error: null });
  }

  await processQueue();
}

// Handle config updated
async function handleConfigUpdated(message) {
  const config = await storage.getConfig();
  github.setCredentials(config.pat, config.repo, config.branch || 'main');

  // If autoSync enabled and there are pending items, process them
  if (config.autoSync) {
    await processQueue();
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.SUBMISSION_DETECTED:
          await handleSubmissionDetected(message);
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.GET_STATUS:
          const queue = await storage.getQueue();
          const config = await storage.getConfig();
          const history = await storage.getHistory(10);
          sendResponse({
            queue,
            config: { ...config, pat: config.pat ? '***' : '' },
            history,
            rateLimit: { remaining: github.rateLimitRemaining, reset: github.rateLimitReset }
          });
          break;

        case MESSAGE_TYPES.GET_QUEUE:
          const queueData = await storage.getQueue();
          sendResponse({ queue: queueData });
          break;
          
        case MESSAGE_TYPES.GET_RATE_LIMIT:
          sendResponse({ rateLimit: { remaining: github.rateLimitRemaining, reset: github.rateLimitReset } });
          break;

        case MESSAGE_TYPES.GET_CONFIG:
          const cfg = await storage.getConfig();
          sendResponse({ ...cfg, pat: cfg.pat ? '***' : '' });
          break;

        case MESSAGE_TYPES.RETRY_PENDING:
          await handleRetryPending();
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.MANUAL_SYNC:
          await handleManualSync();
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.CONFIG_UPDATED:
          await handleConfigUpdated(message);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// Alarm listener for periodic retry
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAMES.RETRY_PENDING) {
    await processQueue();
  } else if (alarm.name === ALARM_NAMES.PERIODIC_SYNC) {
    const config = await storage.getConfig();
    if (config.autoSync) {
      await processQueue();
    }
    await storage.clearCompletedQueue();
  }
});

// WebNavigation listener for LeetCode SPA navigation
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only main frame

  const url = details.url;
  if (url.includes('leetcode.com/problems/')) {
    // Notify content script to re-detect submission
    chrome.tabs.sendMessage(details.tabId, { type: 'CHECK_SUBMISSION' }).catch(() => {});
  }
}, { url: [{ hostContains: 'leetcode.com' }] });

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default config
    await storage.setConfig({});
    // Create periodic sync alarm (every 30 minutes)
    chrome.alarms.create(ALARM_NAMES.PERIODIC_SYNC, { periodInMinutes: 30 });
  } else if (details.reason === 'update') {
    // Handle migrations if needed
    await storage.migrateIfNeeded({});
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(initGitHubClient);
initGitHubClient();

// Handle commands (keyboard shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'manual-sync') {
    await handleManualSync();
  }
});

// Online listener
self.addEventListener('online', async () => {
  await processQueue();
});