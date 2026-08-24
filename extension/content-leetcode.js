// CodeHub - LeetCode Main World Content Script
// Runs in page context to access LeetCode's internal React state and bypass CSP

(function() {
  'use strict';

  let lastSubmissionKey = '';
  let checkInterval = null;

  // Send message to isolated world (bridge)
  function sendToBridge(type, data) {
    window.postMessage({ type, source: 'page-script', ...data }, '*');
  }

  // Extract submission data from LeetCode's internal state
  function extractSubmissionData() {
    try {
      // Method 1: Try to access LeetCode's React fiber/state
      // LeetCode stores submission data in various places

      // Check for submission result in the page
      const submissionResult = getSubmissionResult();
      if (!submissionResult) return null;

      // Check if accepted
      if (submissionResult.status !== 'Accepted' && submissionResult.status !== 'AC') {
        return null;
      }

      // Get problem info
      const problemInfo = getProblemInfo();
      if (!problemInfo) return null;

      // Get code from editor or submission
      const code = getSubmissionCode(submissionResult);
      if (!code) return null;

      // Get language
      const language = getLanguage(submissionResult);

      // Create unique key to avoid duplicates
      const submissionKey = `${problemInfo.id}-${language}-${code.length}-${submissionResult.timestamp || Date.now()}`;
      if (submissionKey === lastSubmissionKey) return null;
      lastSubmissionKey = submissionKey;

      return {
        platform: 'leetcode',
        problemId: problemInfo.id,
        problemName: problemInfo.title,
        language,
        code,
        runtime: submissionResult.runtime || '',
        memory: submissionResult.memory || '',
        url: window.location.href,
        difficulty: problemInfo.difficulty || '',
        tags: problemInfo.tags || [],
        timestamp: submissionResult.timestamp || Date.now()
      };
    } catch (e) {
      console.error('LeetCode extraction error:', e);
      return null;
    }
  }

  // Get submission result from various possible locations
  function getSubmissionResult() {
    // Try to find submission data in window.__NEXT_DATA__ (Next.js)
    if (window.__NEXT_DATA__?.props?.pageProps?.submissionResult) {
      return window.__NEXT_DATA__.props.pageProps.submissionResult;
    }

    // Try to find in React DevTools fiber (not reliable in production)
    // Try to find in localStorage/sessionStorage
    try {
      const stored = sessionStorage.getItem('submissionResult') || localStorage.getItem('submissionResult');
      if (stored) return JSON.parse(stored);
    } catch {}

    // Try to find in the DOM - look for submission status elements
    const statusElements = document.querySelectorAll('[data-cy="submission-result"], .submission-result, [class*="status-accepted"], [class*="status-ac"]');
    for (const el of statusElements) {
      const text = el.textContent.toLowerCase();
      if (text.includes('accepted') || text === 'ac') {
        // Found accepted submission, now find details
        return parseSubmissionFromDOM();
      }
    }

    // Check for "Accepted" text in page
    const bodyText = document.body.innerText;
    if (bodyText.includes('Accepted') || bodyText.includes('Your solution has been accepted')) {
      return parseSubmissionFromDOM();
    }

    return null;
  }

  // Parse submission details from DOM
  function parseSubmissionFromDOM() {
    // Try to find runtime and memory
    let runtime = '', memory = '';
    const statElements = document.querySelectorAll('[data-cy*="runtime"], [data-cy*="memory"], .runtime, .memory, [class*="runtime"], [class*="memory"]');
    for (const el of statElements) {
      const text = el.textContent.trim();
      if ((text.includes('ms') || text.includes('s')) && !runtime) runtime = text;
      if ((text.includes('MB') || text.includes('KB')) && !memory) memory = text;
    }

    // Try to find in tables
    if (!runtime || !memory) {
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const label = cells[0].textContent.toLowerCase();
            const value = cells[1].textContent.trim();
            if (label.includes('runtime') && !runtime) runtime = value;
            if (label.includes('memory') && !memory) memory = value;
          }
        }
      }
    }

    return {
      status: 'Accepted',
      runtime,
      memory,
      timestamp: Date.now()
    };
  }

  // Get problem info from page
  function getProblemInfo() {
    // Try Next.js data
    if (window.__NEXT_DATA__?.props?.pageProps?.problem) {
      const p = window.__NEXT_DATA__.props.pageProps.problem;
      return {
        id: p.questionId || p.id || '',
        title: p.title || p.questionTitle || '',
        difficulty: p.difficulty || '',
        tags: p.topicTags?.map(t => t.name) || []
      };
    }

    // Try to get from URL
    const urlMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    const problemSlug = urlMatch ? urlMatch[1] : '';

    // Try to get title from page
    const titleElement = document.querySelector('[data-cy="question-title"], .question-title, h1[class*="title"], .css-101rr4k');
    const title = titleElement?.textContent?.trim() || problemSlug;

    // Try to get difficulty
    let difficulty = '';
    const diffElement = document.querySelector('[data-cy="question-difficulty"], .difficulty, [class*="difficulty"]');
    if (diffElement) {
      const text = diffElement.textContent.toLowerCase();
      if (text.includes('easy')) difficulty = 'Easy';
      else if (text.includes('medium')) difficulty = 'Medium';
      else if (text.includes('hard')) difficulty = 'Hard';
    }

    // Try to get tags
    const tags = [];
    const tagElements = document.querySelectorAll('[data-cy="topic-tag"], .topic-tag, [class*="tag"]');
    for (const el of tagElements) {
      const tag = el.textContent.trim();
      if (tag && !tags.includes(tag)) tags.push(tag);
    }

    return {
      id: problemSlug,
      title,
      difficulty,
      tags
    };
  }

  // Get submission code
  function getSubmissionCode(submissionResult) {
    // Try to get from submission result
    if (submissionResult.code) return submissionResult.code;

    // Try to get from editor (Monaco/CodeMirror)
    const editorElement = document.querySelector('.monaco-editor, .CodeMirror, [class*="editor"]');
    if (editorElement) {
      // Monaco
      if (editorElement._codehubCode) return editorElement._codehubCode;
      // CodeMirror
      if (editorElement.CodeMirror) return editorElement.CodeMirror.getValue();
    }

    // Try to find code in DOM (submission details page)
    const codeElements = document.querySelectorAll('pre code, .code-block, [class*="source-code"], [class*="submission-code"]');
    for (const el of codeElements) {
      const code = el.textContent.trim();
      if (code.length > 50) return code; // Likely actual code
    }

    // Try to get from LeetCode's submission detail API data in page
    const scripts = document.querySelectorAll('script[type="application/json"], script[id*="__NEXT_DATA__"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.submissionCode) return data.submissionCode;
        if (data.props?.pageProps?.submissionCode) return data.props.pageProps.submissionCode;
      } catch {}
    }

    return null;
  }

  // Get language from submission
  function getLanguage(submissionResult) {
    if (submissionResult.lang || submissionResult.language) {
      return submissionResult.lang || submissionResult.language;
    }

    // Try to find in DOM
    const langElements = document.querySelectorAll('[data-cy="language"], .language, [class*="language"]');
    for (const el of langElements) {
      const text = el.textContent.trim();
      if (text) return text;
    }

    return 'Unknown';
  }

  // Check for submission and send to bridge
  function checkSubmission() {
    const submission = extractSubmissionData();
    if (submission) {
      sendToBridge('CODEHUB_SUBMISSION_DATA', { submission });
    }
  }

  // Listen for messages from bridge
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'content-script') return;

    switch (event.data.type) {
      case 'CODEHUB_CONNECT':
        sendToBridge('CODEHUB_READY', {});
        break;
      case 'CODEHUB_CHECK_SUBMISSION':
        checkSubmission();
        break;
    }
  });

  // Periodic check for submission (LeetCode is SPA)
  function startPeriodicCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkSubmission, 2000);
  }

  // Stop periodic check
  function stopPeriodicCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = null;
  }

  // Initialize
  function init() {
    // Signal ready
    sendToBridge('CODEHUB_READY', {});

    // Initial check
    checkSubmission();

    // Start periodic check
    startPeriodicCheck();

    // Listen for navigation (LeetCode is SPA)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        lastSubmissionKey = ''; // Reset for new page
        setTimeout(checkSubmission, 1000);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    // Also listen for popstate
    window.addEventListener('popstate', () => {
      lastSubmissionKey = '';
      setTimeout(checkSubmission, 1000);
    });
  }

  // Start when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();