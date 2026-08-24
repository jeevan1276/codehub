// CodeHub - LeetCode Bridge Content Script (Isolated World)
// Communicates with main world script to bypass CSP restrictions

import { PLATFORMS, MESSAGE_TYPES } from './constants.js';

let mainWorldPort = null;
let isConnected = false;

// Connect to main world script
function connectToMainWorld() {
  // Create a custom event to signal main world script
  window.postMessage({ type: 'CODEHUB_CONNECT', source: 'content-script' }, '*');
}

// Listen for messages from main world
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'page-script') return;

  switch (event.data.type) {
    case 'CODEHUB_SUBMISSION_DATA':
      // Forward submission data to background
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SUBMISSION_DETECTED,
        submission: event.data.submission
      }).catch(() => {});
      break;

    case 'CODEHUB_READY':
      isConnected = true;
      console.log('CodeHub: Connected to LeetCode main world script');
      break;
  }
});

// Notify main world to check for submission
function requestSubmissionCheck() {
  window.postMessage({ type: 'CODEHUB_CHECK_SUBMISSION', source: 'content-script' }, '*');
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_SUBMISSION') {
    requestSubmissionCheck();
    sendResponse({ success: true });
  }
  return true;
});

// Initialize connection
connectToMainWorld();

// Also try connecting periodically in case main world loads later
const connectInterval = setInterval(() => {
  if (!isConnected) {
    connectToMainWorld();
  } else {
    clearInterval(connectInterval);
  }
}, 1000);

// Cleanup after 30 seconds
setTimeout(() => clearInterval(connectInterval), 30000);