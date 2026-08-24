# CodeHub

CodeHub is a Chrome and Edge browser extension that detects accepted competitive-programming submissions and syncs them to a GitHub repository.

> **Vibe coded project:** CodeHub was built as a vibe-coded project: an experiment shaped through fast iteration, practical ideas, and AI-assisted development. Review and test the code carefully before relying on it for important repositories or credentials. It was not built completely yet and in progress.

## Supported Platforms

- Codeforces
- LeetCode
- AtCoder

The extension watches supported submission pages, collects accepted solutions and submission metadata, and places them in an organized GitHub folder structure.

Example repository layout:

```text
codeforces/
└── 1900A-Cover-in-Water/
    ├── solution.cpp
    └── README.md

leetcode/
└── 0001-Two-Sum/
    ├── solution.py
    └── README.md

atcoder/
└── abc350-A-Past-ABCs/
    ├── solution.cpp
    └── README.md
```

## Features

- Detects accepted submissions on supported coding platforms
- Supports multiple solution languages for the same problem
- Syncs solution files and problem metadata to GitHub
- Stores pending submissions locally when a sync needs to be retried
- Provides a popup for status and manual sync controls
- Provides an options page for GitHub configuration
- Uses a Manifest V3 service worker for background processing

## Setup

1. Create or select a GitHub repository for your solutions.
2. Create a fine-grained GitHub personal access token with access to that repository and `Contents: Read and write` permission.
3. Install the extension in Chrome or Edge using the development instructions below.
4. Open the extension options and enter the token, repository owner, and repository name.
5. Submit a solution on Codeforces, LeetCode, or AtCoder and confirm that the accepted submission is synced.

Treat the personal access token like a password. Do not commit it, paste it into source files, or share it publicly.

## Development

Requirements:

- Node.js 18 or newer
- Chrome or Edge

From the `extension` directory, install dependencies:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Run ESLint:

```bash
npm run lint
```

Build a packaged extension:

```bash
npm run build
```

The build output is written to `extension/dist`, and the packaged artifact is written to `web-ext-artifacts`.

## Loading the Extension Locally

1. Run `npm run build` from `extension`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `extension/dist` directory.
6. Open the CodeHub options page and configure GitHub access.

After changing source files, rebuild the extension and reload it from the browser extensions page.

## Project Structure

| Path | Purpose |
| --- | --- |
| `extension/background.js` | Service worker, queue processing, notifications, and sync orchestration |
| `extension/github.js` | GitHub REST API integration |
| `extension/content-codeforces.js` | Codeforces submission detection |
| `extension/content-leetcode.js` | LeetCode page-level submission detection |
| `extension/content-atcoder.js` | AtCoder submission detection |
| `extension/popup.*` | Popup UI and status controls |
| `extension/options.*` | Configuration UI |
| `extension/storage.js` | Browser storage helpers |
| `extension/utils.js` | Shared parsing and formatting utilities |
| `extension/tests/` | Additional test fixtures and tests |

## Current Scope

CodeHub writes to an existing GitHub repository. It does not create repositories, and it currently targets Chromium-based browsers through Manifest V3. Website markup, APIs, browser extension behavior, and GitHub permissions can change, so integrations should be tested periodically.

## License

No license has been specified for this project yet.
