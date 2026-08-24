// CodeHub - Codeforces Content Script
// Runs in isolated world, detects accepted submissions on Codeforces pages

import { PLATFORMS, MESSAGE_TYPES } from './constants.js';
import { generateId } from './utils.js';

let lastProcessedUrl = '';
let submissionObserver = null;

// Extract submission data from Codeforces submission page
function extractSubmissionData() {
  try {
    // Check if this is a submission page
    const pathMatch = window.location.pathname.match(/(?:contest|problemset|gym|group\/[^\/]+\/contest)\/(\d+)\/submission\/(\d+)/);
    if (!pathMatch) return null;

    const contestId = pathMatch[1];
    const submissionId = pathMatch[2];

    // Check verdict - look for "Accepted" or "OK"
    const verdictElement = document.querySelector('.verdict-accepted, .verdict-ok, [class*="verdict-accepted"], [class*="verdict-ok"]');
    const verdictText = document.querySelector('.verdict')?.textContent?.trim().toLowerCase();

    const isAccepted = verdictElement ||
      (verdictText && (verdictText.includes('accepted') || verdictText === 'ok' || verdictText === 'accepted'));

    if (!isAccepted) return null;

    // Extract problem info
    const problemLink = document.querySelector('a[href*="/problem/"]');
    const problemName = problemLink?.textContent?.trim() || 'Unknown Problem';
    const problemUrl = problemLink?.href || '';

    // Extract problem ID from URL or page
    let problemId = '';
    const problemIdMatch = problemUrl.match(/\/problem\/([A-Z]\d*)/);
    if (problemIdMatch) {
      problemId = problemIdMatch[1];
    } else {
      // Try to get from page title or other elements
      const titleMatch = document.title.match(/([A-Z]\d*)/);
      if (titleMatch) problemId = titleMatch[1];
    }

    // Extract language
    const languageElement = document.querySelector('.program-source .lang, [class*="language"], .submission-language');
    let language = languageElement?.textContent?.trim() || '';

    // Try to find language in the submission info table
    if (!language) {
      const rows = document.querySelectorAll('table tr, .submission-info tr');
      for (const row of rows) {
        const th = row.querySelector('th, td:first-child');
        const td = row.querySelector('td:last-child, td:nth-child(2)');
        if (th && th.textContent.toLowerCase().includes('language')) {
          language = td?.textContent?.trim() || '';
          break;
        }
      }
    }

    // Extract code
    const codeElement = document.querySelector('#program-source-text, .program-source, pre[class*="source"], .source-code');
    let code = codeElement?.textContent?.trim() || '';

    // If code not found, try to get from the submission source link
    if (!code) {
      const sourceLink = document.querySelector('a[href*="submission"]');
      if (sourceLink) {
        // Code might be loaded via AJAX, we'll need to fetch it
      }
    }

    // Extract runtime and memory
    let runtime = '', memory = '';
    const statsElements = document.querySelectorAll('.verdict-time, .verdict-memory, [class*="time"], [class*="memory"]');
    for (const el of statsElements) {
      const text = el.textContent.trim();
      if (text.includes('ms') && !runtime) runtime = text;
      if ((text.includes('KB') || text.includes('MB')) && !memory) memory = text;
    }

    // Try to find in table
    if (!runtime || !memory) {
      const rows = document.querySelectorAll('table tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const label = cells[0].textContent.toLowerCase();
          const value = cells[1].textContent.trim();
          if (label.includes('time') && !runtime) runtime = value;
          if (label.includes('memory') && !memory) memory = value;
        }
      }
    }

    // Extract difficulty and tags (not directly available on submission page)
    // We'll leave these for the user to fill in or fetch from problem page

    return {
      platform: PLATFORMS.CODEFORCES,
      contestId,
      submissionId,
      problemId: problemId || `CF-${contestId}-${submissionId}`,
      problemName,
      language,
      code,
      runtime,
      memory,
      url: window.location.href,
      difficulty: '',
      tags: [],
      timestamp: Date.now()
    };
  } catch (e) {
    console.error('Codeforces extraction error:', e);
    return null;
  }
}

// Send submission to background
async function sendSubmission(submission) {
  if (!submission || !submission.code) return;

  // Avoid duplicate submissions
  const submissionKey = `${submission.platform}-${submission.problemId}-${submission.language}-${submission.code.length}`;
  if (submissionKey === lastProcessedUrl) return;
  lastProcessedUrl = submissionKey;

  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.SUBMISSION_DETECTED,
    submission
  }).catch(() => {});
}

// Check for submission on page load
function checkSubmission() {
  const submission = extractSubmissionData();
  if (submission) {
    sendSubmission(submission);
  }
}

// Observe for dynamic content (Codeforces loads some content via AJAX)
function setupObserver() {
  if (submissionObserver) submissionObserver.disconnect();

  submissionObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if submission content was added
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches?.('#program-source-text, .program-source, .verdict-accepted, .verdict-ok') ||
                node.querySelector?.('#program-source-text, .program-source, .verdict-accepted, .verdict-ok')) {
              setTimeout(checkSubmission, 500);
              return;
            }
          }
        }
      }
    }
  });

  submissionObserver.observe(document.body, { childList: true, subtree: true });
}

// Initialize
function init() {
  // Check immediately
  checkSubmission();

  // Setup observer for dynamic content
  setupObserver();

  // Also check on hash change (some CF pages use hash navigation)
  window.addEventListener('hashchange', () => {
    setTimeout(checkSubmission, 500);
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_SUBMISSION') {
    checkSubmission();
    sendResponse({ success: true });
  }
  return true;
});

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}