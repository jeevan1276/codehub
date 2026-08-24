// CodeHub - Constants
// Centralized configuration constants for the extension

export const PLATFORMS = {
  CODEFORCES: 'codeforces',
  LEETCODE: 'leetcode',
  ATCODER: 'atcoder'
};

export const PLATFORM_URL_PATTERNS = {
  [PLATFORMS.CODEFORCES]: [
    'https://codeforces.com/contest/*/submission/*',
    'https://codeforces.com/problemset/submission/*/*',
    'https://codeforces.com/gym/*/submission/*',
    'https://codeforces.com/group/*/contest/*/submission/*'
  ],
  [PLATFORMS.LEETCODE]: [
    'https://leetcode.com/problems/*'
  ],
  [PLATFORMS.ATCODER]: [
    'https://atcoder.jp/contests/*/submissions/*'
  ]
};

export const PLATFORM_DISPLAY_NAMES = {
  [PLATFORMS.CODEFORCES]: 'Codeforces',
  [PLATFORMS.LEETCODE]: 'LeetCode',
  [PLATFORMS.ATCODER]: 'AtCoder'
};

export const PLATFORM_ICONS = {
  [PLATFORMS.CODEFORCES]: 'icons/codeforces.svg',
  [PLATFORMS.LEETCODE]: 'icons/leetcode.svg',
  [PLATFORMS.ATCODER]: 'icons/atcoder.svg'
};

export const LANGUAGE_EXTENSIONS = {
  // Codeforces languages
  'GNU C++17': '.cpp',
  'GNU C++20': '.cpp',
  'GNU C++14': '.cpp',
  'GNU C11': '.c',
  'GNU C++11': '.cpp',
  'MS C++ 2017': '.cpp',
  'MS C++': '.cpp',
  'Python 3': '.py',
  'Python 2': '.py',
  'PyPy 3': '.py',
  'PyPy 2': '.py',
  'Java 8': '.java',
  'Java 11': '.java',
  'Java 17': '.java',
  'Java 21': '.java',
  'C#': '.cs',
  'C# 10': '.cs',
  'C# 8': '.cs',
  'JavaScript': '.js',
  'Node.js': '.js',
  'TypeScript': '.ts',
  'Go': '.go',
  'Rust': '.rs',
  'Kotlin': '.kt',
  'Swift': '.swift',
  'Ruby': '.rb',
  'PHP': '.php',
  'Scala': '.scala',
  'D': '.d',
  'Haskell': '.hs',
  'OCaml': '.ml',
  'F#': '.fs',
  'Perl': '.pl',
  'Pascal': '.pas',
  'Delphi': '.pas',

  // LeetCode languages (normalized)
  'cpp': '.cpp',
  'c': '.c',
  'python': '.py',
  'python3': '.py',
  'java': '.java',
  'csharp': '.cs',
  'javascript': '.js',
  'typescript': '.ts',
  'go': '.go',
  'rust': '.rs',
  'kotlin': '.kt',
  'swift': '.swift',
  'ruby': '.rb',
  'php': '.php',
  'scala': '.scala',
  'dart': '.dart',
  'elixir': '.ex',
  'erlang': '.erl',
  'racket': '.rkt',
  'bash': '.sh',

  // AtCoder languages
  'C++ (GCC 9.2.1)': '.cpp',
  'C++ (GCC 11.2.0)': '.cpp',
  'C++ (GCC 12.2.0)': '.cpp',
  'C (GCC 9.2.1)': '.c',
  'C (GCC 11.2.0)': '.c',
  'C (GCC 12.2.0)': '.c',
  'Python 3.8.2': '.py',
  'Python 3.10.4': '.py',
  'Python 3.11.4': '.py',
  'Java 11.0.15': '.java',
  'Java 17.0.3': '.java',
  'Java 21.0.1': '.java',
  'C# (Mono 6.12.0)': '.cs',
  'C# (.NET 6.0)': '.cs',
  'JavaScript (Node.js 16.13.2)': '.js',
  'JavaScript (Node.js 18.15.0)': '.js',
  'TypeScript 4.9.5': '.ts',
  'Go 1.19': '.go',
  'Go 1.21': '.go',
  'Rust 1.68': '.rs',
  'Rust 1.72': '.rs',
  'Kotlin 1.7.20': '.kt',
  'Kotlin 1.9.20': '.kt',
  'Swift 5.7': '.swift',
  'Ruby 3.1.2': '.rb',
  'PHP 8.1.13': '.php',
  'Scala 2.13.10': '.scala',
  'Scala 3.2.2': '.scala',
  'Perl 5.36.0': '.pl',
  'PyPy 3.10-v7.3.11': '.py',
  'PyPy 3.10-v7.3.12': '.py'
};

export const STORAGE_KEYS = {
  QUEUE: 'codehub_queue',
  CONFIG: 'codehub_config',
  HISTORY: 'codehub_history',
  PAT_ENCRYPTED: 'codehub_pat',
  PAT_SESSION: 'codehub_pat_session',
  LAST_SYNC: 'codehub_last_sync',
  VERSION: 'codehub_version',
  STORAGE_VERSION: 'codehub_storage_version'
};

export const DEFAULT_CONFIG = {
  pat: '',
  repo: '',
  autoSync: true,
  enabledPlatforms: {
    [PLATFORMS.CODEFORCES]: true,
    [PLATFORMS.LEETCODE]: true,
    [PLATFORMS.ATCODER]: true
  },
  commitMessageTemplate: '✅ [{platform}] {problemName} ({language})',
  notifications: true,
  debugMode: false
};

export const GITHUB_API = {
  BASE_URL: 'https://api.github.com',
  API_VERSION: '2022-11-28',
  RATE_LIMIT: {
    THRESHOLD_WARN: 100,
    THRESHOLD_PAUSE: 10,
    MAX_RETRIES: 3,
    MAX_BACKOFF_MS: 60000
  }
};

export const QUEUE_STATUS = {
  PENDING: 'pending',
  RETRYING: 'retrying',
  FAILED: 'failed',
  COMPLETED: 'completed'
};

export const MESSAGE_TYPES = {
  SUBMISSION_DETECTED: 'SUBMISSION_DETECTED',
  GET_STATUS: 'GET_STATUS',
  GET_QUEUE: 'GET_QUEUE',
  GET_RATE_LIMIT: 'GET_RATE_LIMIT',
  GET_CONFIG: 'GET_CONFIG',
  MANUAL_SYNC: 'MANUAL_SYNC',
  RETRY_PENDING: 'RETRY_PENDING',
  CONFIG_UPDATED: 'CONFIG_UPDATED',
  QUEUE_UPDATED: 'QUEUE_UPDATED'
};

export const ALARM_NAMES = {
  RETRY_PENDING: 'codehub_retry_pending',
  PERIODIC_SYNC: 'codehub_periodic_sync'
};

export const CURRENT_STORAGE_VERSION = 1;