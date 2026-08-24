// CodeHub - Options Script

import { STORAGE_KEYS, DEFAULT_CONFIG, PLATFORMS } from './constants.js';
import { debounce } from './utils.js';

// DOM Elements
const elements = {
  // GitHub config
  githubToken: document.getElementById('githubToken'),
  githubRepo: document.getElementById('githubRepo'),
  githubBranch: document.getElementById('githubBranch'),
  basePath: document.getElementById('basePath'),
  toggleToken: document.getElementById('toggleToken'),
  testConnection: document.getElementById('testConnection'),
  tokenValidation: document.getElementById('tokenValidation'),
  repoValidation: document.getElementById('repoValidation'),
  connectionResult: document.getElementById('connectionResult'),

  // Sync preferences
  autoSync: document.getElementById('autoSync'),
  createReadme: document.getElementById('createReadme'),
  includeFailed: document.getElementById('includeFailed'),
  syncInterval: document.getElementById('syncInterval'),

  // Platform settings
  enableCodeforces: document.getElementById('enableCodeforces'),
  enableLeetcode: document.getElementById('enableLeetcode'),
  enableAtcoder: document.getElementById('enableAtcoder'),

  // Advanced
  debugMode: document.getElementById('debugMode'),
  exportData: document.getElementById('exportData'),
  importData: document.getElementById('importData'),
  importFile: document.getElementById('importFile'),
  clearData: document.getElementById('clearData'),

  // Save
  saveBtn: document.getElementById('saveBtn'),
  saveStatus: document.getElementById('saveStatus')
};

let currentConfig = { ...DEFAULT_CONFIG };
let isSaving = false;

// Initialize options page
async function init() {
  await loadConfig();
  setupEventListeners();
  updateUI();
}

// Load config from storage
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
    if (result[STORAGE_KEYS.CONFIG]) {
      currentConfig = { ...DEFAULT_CONFIG, ...result[STORAGE_KEYS.CONFIG] };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Token visibility toggle
  elements.toggleToken.addEventListener('click', toggleTokenVisibility);

  // Test connection
  elements.testConnection.addEventListener('click', testConnection);

  // Input validation
  elements.githubToken.addEventListener('input', validateToken);
  elements.githubRepo.addEventListener('input', validateRepo);

  // Save button
  elements.saveBtn.addEventListener('click', saveConfig);

  // Data management
  elements.exportData.addEventListener('click', exportData);
  elements.importData.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', importData);
  elements.clearData.addEventListener('click', clearData);

  // Auto-save on change (debounced)
  const configInputs = [
    elements.githubToken, elements.githubRepo, elements.githubBranch,
    elements.basePath, elements.autoSync, elements.createReadme,
    elements.includeFailed, elements.syncInterval,
    elements.enableCodeforces, elements.enableLeetcode, elements.enableAtcoder,
    elements.debugMode
  ];

  configInputs.forEach(input => {
    input.addEventListener('change', debounce(autoSave, 500));
    input.addEventListener('input', debounce(autoSave, 500));
  });
}

// Update UI from config
function updateUI() {
  elements.githubToken.value = currentConfig.pat || '';
  elements.githubRepo.value = currentConfig.repo || '';
  elements.githubBranch.value = currentConfig.branch || 'main';
  elements.basePath.value = currentConfig.basePath || 'solutions';

  elements.autoSync.checked = currentConfig.autoSync !== false;
  elements.createReadme.checked = currentConfig.createReadme !== false;
  elements.includeFailed.checked = currentConfig.includeFailed === true;
  elements.syncInterval.value = currentConfig.syncInterval || 5;

  elements.enableCodeforces.checked = currentConfig.enabledPlatforms?.codeforces !== false;
  elements.enableLeetcode.checked = currentConfig.enabledPlatforms?.leetcode !== false;
  elements.enableAtcoder.checked = currentConfig.enabledPlatforms?.atcoder !== false;

  elements.debugMode.checked = currentConfig.debugMode === true;

  validateToken();
  validateRepo();
}

// Toggle token visibility
function toggleTokenVisibility() {
  const isPassword = elements.githubToken.type === 'password';
  elements.githubToken.type = isPassword ? 'text' : 'password';

  const eyeIcon = elements.toggleToken.querySelector('.icon-eye');
  const eyeOffIcon = elements.toggleToken.querySelector('.icon-eye-off');

  eyeIcon.classList.toggle('hidden', isPassword);
  eyeOffIcon.classList.toggle('hidden', !isPassword);
}

// Validate token format
function validateToken() {
  const token = elements.githubToken.value.trim();
  const validation = elements.tokenValidation;

  if (!token) {
    validation.textContent = '';
    validation.className = 'validation-message';
    elements.githubToken.classList.remove('error', 'valid');
    return false;
  }

  if (token.startsWith('ghp_') && token.length >= 36) {
    validation.textContent = '✓ Valid token format';
    validation.className = 'validation-message success';
    elements.githubToken.classList.add('valid');
    elements.githubToken.classList.remove('error');
    return true;
  } else if (token.startsWith('github_pat_') && token.length >= 80) {
    validation.textContent = '✓ Valid fine-grained token format';
    validation.className = 'validation-message success';
    elements.githubToken.classList.add('valid');
    elements.githubToken.classList.remove('error');
    return true;
  } else {
    validation.textContent = '✗ Invalid token format (should start with ghp_ or github_pat_)';
    validation.className = 'validation-message error';
    elements.githubToken.classList.add('error');
    elements.githubToken.classList.remove('valid');
    return false;
  }
}

// Validate repo format
function validateRepo() {
  const repo = elements.githubRepo.value.trim();
  const validation = elements.repoValidation;

  if (!repo) {
    validation.textContent = '';
    validation.className = 'validation-message';
    elements.githubRepo.classList.remove('error', 'valid');
    return false;
  }

  const repoRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
  if (repoRegex.test(repo)) {
    validation.textContent = '✓ Valid repository format';
    validation.className = 'validation-message success';
    elements.githubRepo.classList.add('valid');
    elements.githubRepo.classList.remove('error');
    return true;
  } else {
    validation.textContent = '✗ Invalid format (use owner/repo)';
    validation.className = 'validation-message error';
    elements.githubRepo.classList.add('error');
    elements.githubRepo.classList.remove('valid');
    return false;
  }
}

// Test GitHub connection
async function testConnection() {
  const token = elements.githubToken.value.trim();
  const repo = elements.githubRepo.value.trim();

  if (!validateToken() || !validateRepo()) {
    showConnectionResult('Please fix validation errors first', 'error');
    return;
  }

  elements.testConnection.disabled = true;
  elements.testConnection.textContent = 'Testing...';
  showConnectionResult('Testing connection...', 'info');

  try {
    // Test token validity
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CodeHub-Extension'
      }
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        throw new Error('Invalid token - check your PAT');
      } else if (userResponse.status === 403) {
        throw new Error('Token lacks required scopes (need repo scope)');
      }
      throw new Error(`GitHub API error: ${userResponse.status}`);
    }

    const user = await userResponse.json();

    // Test repo access
    const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CodeHub-Extension'
      }
    });

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        throw new Error('Repository not found or no access');
      } else if (repoResponse.status === 403) {
        throw new Error('No permission to access this repository');
      }
      throw new Error(`Repository access error: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();

    showConnectionResult(
      `✓ Connected as @${user.login} - Repository: ${repoData.full_name} (${repoData.private ? 'Private' : 'Public'})`,
      'success'
    );
  } catch (error) {
    showConnectionResult(`✗ ${error.message}`, 'error');
  } finally {
    elements.testConnection.disabled = false;
    elements.testConnection.textContent = 'Test Connection';
  }
}

function showConnectionResult(message, type) {
  elements.connectionResult.textContent = message;
  elements.connectionResult.className = `validation-message ${type}`;
}

// Save configuration
async function saveConfig() {
  if (isSaving) return;

  const tokenValid = validateToken();
  const repoValid = validateRepo();

  // Only require token/repo if auto-sync is enabled
  if (elements.autoSync.checked && (!tokenValid || !repoValid)) {
    showSaveStatus('Please configure GitHub token and repository', 'error');
    return;
  }

  isSaving = true;
  showSaveStatus('Saving...', 'saving');

  try {
    // Build config object using the canonical keys expected by background.js
    const config = {
      pat: elements.githubToken.value.trim(),
      repo: elements.githubRepo.value.trim(),
      branch: elements.githubBranch.value.trim() || 'main',
      basePath: elements.basePath.value.trim() || 'solutions',
      autoSync: elements.autoSync.checked,
      createReadme: elements.createReadme.checked,
      includeFailed: elements.includeFailed.checked,
      syncInterval: Math.max(1, Math.min(60, parseInt(elements.syncInterval.value) || 5)),
      enabledPlatforms: {
        codeforces: elements.enableCodeforces.checked,
        leetcode: elements.enableLeetcode.checked,
        atcoder: elements.enableAtcoder.checked
      },
      notifications: currentConfig.notifications !== false,
      debugMode: elements.debugMode.checked
    };

    // Save to storage
    await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
    currentConfig = config;

    // Notify background script
    await chrome.runtime.sendMessage({
      type: 'CONFIG_UPDATED',
      config: config
    });

    showSaveStatus('✓ Settings saved', 'saved');

    // Clear status after 2 seconds
    setTimeout(() => {
      showSaveStatus('', '');
    }, 2000);
  } catch (error) {
    console.error('Save failed:', error);
    showSaveStatus('✗ Save failed', 'error');
  } finally {
    isSaving = false;
  }
}

// Auto-save (debounced)
async function autoSave() {
  if (isSaving) return;

  try {
    const config = {
      ...currentConfig,
      githubToken: elements.githubToken.value.trim(),
      githubRepo: elements.githubRepo.value.trim(),
      githubBranch: elements.githubBranch.value.trim() || 'main',
      basePath: elements.basePath.value.trim() || 'solutions',
      autoSync: elements.autoSync.checked,
      createReadme: elements.createReadme.checked,
      includeFailed: elements.includeFailed.checked,
      syncInterval: Math.max(1, Math.min(60, parseInt(elements.syncInterval.value) || 5)),
      enabledPlatforms: {
        codeforces: elements.enableCodeforces.checked,
        leetcode: elements.enableLeetcode.checked,
        atcoder: elements.enableAtcoder.checked
      },
      debugMode: elements.debugMode.checked
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
    currentConfig = config;

    // Notify background
    await chrome.runtime.sendMessage({
      type: 'CONFIG_UPDATED',
      config: config
    });
  } catch (e) {
    console.error('Auto-save failed:', e);
  }
}

function showSaveStatus(message, type) {
  elements.saveStatus.textContent = message;
  elements.saveStatus.className = `save-status ${type}`;
}

// Export data
async function exportData() {
  try {
    const data = await chrome.storage.local.get(null);
    const exportData = {
      version: 1,
      timestamp: Date.now(),
      data: data
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `codehub-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showSaveStatus('✓ Data exported', 'saved');
    setTimeout(() => showSaveStatus('', ''), 2000);
  } catch (e) {
    console.error('Export failed:', e);
    showSaveStatus('✗ Export failed', 'error');
  }
}

// Import data
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    if (!importData.data) {
      throw new Error('Invalid backup file format');
    }

    // Confirm with user
    if (!confirm('This will overwrite all current settings and queue data. Continue?')) {
      return;
    }

    // Clear current storage
    await chrome.storage.local.clear();

    // Import data
    const items = Object.entries(importData.data);
    await chrome.storage.local.set(Object.fromEntries(items));

    showSaveStatus('✓ Data imported - reload page to see changes', 'saved');

    // Reload config
    await loadConfig();
    updateUI();
  } catch (e) {
    console.error('Import failed:', e);
    showSaveStatus(`✗ Import failed: ${e.message}`, 'error');
  } finally {
    elements.importFile.value = '';
  }
}

// Clear all data
async function clearData() {
  if (!confirm('This will delete ALL settings, queue, and history. This cannot be undone. Continue?')) {
    return;
  }

  if (!confirm('Are you absolutely sure?')) {
    return;
  }

  try {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();

    currentConfig = { ...DEFAULT_CONFIG };
    updateUI();

    showSaveStatus('✓ All data cleared', 'saved');
    setTimeout(() => showSaveStatus('', ''), 2000);
  } catch (e) {
    console.error('Clear failed:', e);
    showSaveStatus('✗ Clear failed', 'error');
  }
}


// Initialize
document.addEventListener('DOMContentLoaded', init);