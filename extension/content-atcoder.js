// CodeHub - AtCoder Content Script
// Runs in isolated world, detects accepted submissions on AtCoder pages

import { PLATFORMS, MESSAGE_TYPES } from './constants.js';
import { generateId } from './utils.js';

let lastProcessedUrl = '';
let submissionObserver = null;

// Extract submission data from AtCoder submission page
function extractSubmissionData() {
  try {
    // Check if this is a submission page
    const pathMatch = window.location.pathname.match(/\/submissions\/(\d+)/);
    if (!pathMatch) return null;

    const submissionId = pathMatch[1];

    // Check verdict - look for "AC" (Accepted)
    const verdictElement = document.querySelector('.label-success, .text-success, [class*="label-success"], [class*="text-success"]');
    // :contains() is not a valid CSS selector - use DOM traversal instead
    const allTds = Array.from(document.querySelectorAll('td'));
    const verdictTd = allTds.find(td => {
      const text = td.textContent.trim();
      return text === 'AC' || text === 'Accepted';
    });
    const verdictText = verdictTd?.textContent?.trim();

    // AtCoder uses "AC" for accepted
    const isAccepted = verdictElement ||
      (verdictText && (verdictText === 'AC' || verdictText.includes('Accepted')));

    // Also check in the submission table
    if (!isAccepted) {
      const rows = document.querySelectorAll('table tbody tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) { // AtCoder submission table has 7+ columns
          const status = cells[6].textContent.trim(); // Status column
          if (status === 'AC') {
            return extractFromRow(row, submissionId);
          }
        }
      }
      return null;
    }

    return extractFromPage(submissionId);
  } catch (e) {
    console.error('AtCoder extraction error:', e);
    return null;
  }
}

// Extract from submission detail page
function extractFromPage(submissionId) {
  // Problem info
  const problemLink = document.querySelector('a[href*="/tasks/"]');
  const problemName = problemLink?.textContent?.trim() || 'Unknown Problem';
  const problemUrl = problemLink?.href || '';

  let problemId = '';
  const problemIdMatch = problemUrl.match(/\/tasks\/([^\/]+)/);
  if (problemIdMatch) {
    problemId = problemIdMatch[1];
  }

  // Language
  let language = '';
  const langElements = document.querySelectorAll('td, th, .language');
  for (const el of langElements) {
    const text = el.textContent.trim();
    if (text.match(/^(C\+\+|Java|Python|PyPy|C#|Go|Rust|JavaScript|TypeScript|Kotlin|Swift|Ruby|PHP|Scala|D|Haskell|OCaml|F#|VB\.NET|Perl|Lua|Bash|SQL|HTML|CSS)/i)) {
      language = text;
      break;
    }
  }

  // Code
  const codeElement = document.querySelector('#submission-code, .submission-code, pre[class*="code"], .linenums');
  let code = codeElement?.textContent?.trim() || '';

  // Runtime and memory
  let runtime = '', memory = '';
  const statElements = document.querySelectorAll('td, th');
  for (const el of statElements) {
    const text = el.textContent.trim();
    if (text.includes('ms') && !runtime) runtime = text;
    if ((text.includes('KB') || text.includes('MB')) && !memory) memory = text;
  }

  // Try table rows
  if (!runtime || !memory) {
    const rows = document.querySelectorAll('table tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        const label = cells[0].textContent.toLowerCase();
        const value = cells[1].textContent.trim();
        if (label.includes('time') && !runtime) runtime = value;
        if (label.includes('memory') && !memory) memory = value;
      }
    }
  }

  return {
    platform: PLATFORMS.ATCODER,
    submissionId,
    problemId: problemId || `ATC-${submissionId}`,
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
}

// Extract from submission table row
function extractFromRow(row, submissionId) {
  const cells = row.querySelectorAll('td');
  if (cells.length < 7) return null;

  // AtCoder submission table columns:
  // 0: #, 1: User, 2: Problem, 3: Language, 4: Time, 5: Memory, 6: Status, 7: Code link
  const problemCell = cells[2];
  const problemLink = problemCell.querySelector('a');
  const problemName = problemLink?.textContent?.trim() || problemCell.textContent.trim();
  const problemUrl = problemLink?.href || '';

  let problemId = '';
  const problemIdMatch = problemUrl.match(/\/tasks\/([^\/]+)/);
  if (problemIdMatch) {
    problemId = problemIdMatch[1];
  }

  const language = cells[3].textContent.trim();
  const runtime = cells[4].textContent.trim();
  const memory = cells[5].textContent.trim();

  // Code is not directly available in table, need to fetch from detail page
  // For now, we'll queue and fetch later, or user can click to view
  const codeLink = cells[7]?.querySelector('a')?.href || '';

  return {
    platform: PLATFORMS.ATCODER,
    submissionId,
    problemId: problemId || `ATC-${submissionId}`,
    problemName,
    language,
    code: '', // Will be fetched from detail page if needed
    runtime,
    memory,
    url: codeLink || window.location.href,
    difficulty: '',
    tags: [],
    timestamp: Date.now()
  };
}

// Send submission to background
async function sendSubmission(submission) {
  if (!submission || (!submission.code && !submission.url.includes('/submissions/'))) return;

  // Avoid duplicate submissions
  const submissionKey = `${submission.platform}-${submission.problemId}-${submission.language}-${submission.code.length || submission.submissionId}`;
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

// Observe for dynamic content
function setupObserver() {
  if (submissionObserver) submissionObserver.disconnect();

  submissionObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches?.('.label-success, .text-success, #submission-code, .submission-code') ||
                node.querySelector?.('.label-success, .text-success, #submission-code, .submission-code')) {
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
  checkSubmission();
  setupObserver();

  // Check on hash change
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