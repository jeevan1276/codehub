// CodeHub - Shared Utilities

import { LANGUAGE_EXTENSIONS } from './constants.js';

/**
 * Convert a string to a filesystem-safe slug
 */
export function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphen
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Get file extension for a language
 */
export function getFileExtension(language) {
  if (!language) return '.txt';

  // Direct match
  if (LANGUAGE_EXTENSIONS[language]) {
    return LANGUAGE_EXTENSIONS[language];
  }

  // Case-insensitive match
  const lowerLang = language.toLowerCase();
  for (const [key, ext] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (key.toLowerCase() === lowerLang) {
      return ext;
    }
  }

  // Partial match for common patterns
  if (lowerLang.includes('c++') || lowerLang.includes('cpp')) return '.cpp';
  if (lowerLang.includes('c#') || lowerLang.includes('csharp')) return '.cs';
  if (lowerLang.includes('python') || lowerLang.includes('py')) return '.py';
  if (lowerLang.includes('java')) return '.java';
  if (lowerLang.includes('javascript') || lowerLang.includes('node')) return '.js';
  if (lowerLang.includes('typescript') || lowerLang.includes('ts')) return '.ts';
  if (lowerLang.includes('go') || lowerLang.includes('golang')) return '.go';
  if (lowerLang.includes('rust')) return '.rs';
  if (lowerLang.includes('kotlin')) return '.kt';
  if (lowerLang.includes('swift')) return '.swift';
  if (lowerLang.includes('ruby')) return '.rb';
  if (lowerLang.includes('php')) return '.php';
  if (lowerLang.includes('scala')) return '.scala';
  if (lowerLang.includes('dart')) return '.dart';
  if (lowerLang.includes('bash') || lowerLang.includes('shell')) return '.sh';

  return '.txt';
}

/**
 * Generate or update a README.md for a problem folder
 */
export function generateReadme(submission, existingReadme = null) {
  const { platform, problemName, problemId, difficulty, tags, url, language, runtime, memory, date } = submission;

  const platformDisplay = platform.charAt(0).toUpperCase() + platform.slice(1);
  const problemLink = url || `https://${platform}.com/problems/${problemId}`;

  // Parse existing solutions table if README exists
  let solutions = [];
  if (existingReadme) {
    solutions = parseReadmeTable(existingReadme);
  }

  // Check if this language already exists
  const existingIndex = solutions.findIndex(s => s.language.toLowerCase() === language.toLowerCase());
  const newSolution = {
    number: existingIndex >= 0 ? solutions[existingIndex].number : solutions.length + 1,
    language,
    runtime: runtime || 'N/A',
    memory: memory || 'N/A',
    date: date || new Date().toISOString().split('T')[0]
  };

  if (existingIndex >= 0) {
    solutions[existingIndex] = newSolution;
  } else {
    solutions.push(newSolution);
  }

  // Sort by number
  solutions.sort((a, b) => a.number - b.number);

  // Build solutions table
  const solutionsTable = solutions.map(s =>
    `| ${s.number} | ${s.language} | ${s.runtime} | ${s.memory} | ${s.date} |`
  ).join('\n');

  const readme = `# ${problemName}

| Platform | Difficulty | Tags |
|----------|------------|------|
| ${platformDisplay} | ${difficulty || 'N/A'} | ${tags?.join(', ') || 'N/A'} |

[Problem Link](${problemLink})

## Solutions

| # | Language | Runtime | Memory | Date |
|---|----------|---------|--------|------|
${solutionsTable}
`;

  return readme.replace(/\r\n/g, '\n');
}

/**
 * Parse the solutions table from an existing README
 */
export function parseReadmeTable(markdown) {
  const solutions = [];
  const lines = markdown.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (line.includes('| # | Language |')) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith('|')) {
      // Skip header separator line
      if (line.includes('---')) continue;

      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 5) {
        const num = parseInt(cells[0], 10);
        if (!isNaN(num)) {
          solutions.push({
            number: num,
            language: cells[1],
            runtime: cells[2],
            memory: cells[3],
            date: cells[4]
          });
        }
      }
    } else if (inTable && !line.startsWith('|')) {
      break;
    }
  }

  return solutions;
}

/**
 * UTF-8 safe Base64 encoding
 */
export function base64Encode(str) {
  // Handle Unicode properly
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * UTF-8 safe Base64 decoding
 */
export function base64Decode(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Format timestamp consistently
 */
export function formatTimestamp(date = new Date()) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

/**
 * Debounce function to prevent duplicate submissions
 */
export function debounce(fn, ms) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Generate a unique ID for queue items
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform) {
  const names = {
    codeforces: 'Codeforces',
    leetcode: 'LeetCode',
    atcoder: 'AtCoder'
  };
  return names[platform] || platform;
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sleep utility for delays
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format time ago
 */
export function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}