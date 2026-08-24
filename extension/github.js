// CodeHub - GitHub API Integration
// Handles all GitHub REST API interactions with rate limiting and retry logic

import { GITHUB_API, QUEUE_STATUS } from './constants.js';
import { base64Encode, base64Decode, sleep, getFileExtension, generateReadme, parseReadmeTable, slugify } from './utils.js';

class GitHubClient {
  constructor() {
    this.pat = null;
    this.repo = null;
    this.owner = null;
    this.rateLimitRemaining = 5000;
    this.rateLimitReset = 0;
    this.queue = [];
    this.processing = false;
  }

  setCredentials(pat, repo, branch = 'main') {
    this.pat = pat;
    this.repo = repo;
    this.branch = branch;
    // Parse owner/repo from "owner/repo" format
    const parts = repo.split('/');
    if (parts.length === 2) {
      this.owner = parts[0];
      this.repo = parts[1];
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.pat}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API.API_VERSION,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    const url = `${GITHUB_API.BASE_URL}${endpoint}`;

    // Check rate limit before making request
    await this.checkRateLimit();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    // Update rate limit info from headers
    this.updateRateLimit(response.headers);

    // Handle rate limiting
    if (response.status === 403 || response.status === 429) {
      const resetTime = this.rateLimitReset * 1000;
      const waitTime = Math.max(resetTime - Date.now(), 1000);
      throw new Error(`RATE_LIMITED:${waitTime}`);
    }

    // Handle auth errors
    if (response.status === 401) {
      throw new Error('INVALID_PAT');
    }

    // Handle not found
    if (response.status === 404) {
      throw new Error('NOT_FOUND');
    }

    // Handle conflict (SHA mismatch)
    if (response.status === 409) {
      throw new Error('CONFLICT');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`GITHUB_ERROR:${response.status}:${error.message || 'Unknown error'}`);
    }

    return response.json();
  }

  updateRateLimit(headers) {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (remaining !== null) this.rateLimitRemaining = parseInt(remaining, 10);
    if (reset !== null) this.rateLimitReset = parseInt(reset, 10);
  }

  async checkRateLimit() {
    if (this.rateLimitRemaining < GITHUB_API.RATE_LIMIT.THRESHOLD_PAUSE) {
      const resetTime = this.rateLimitReset * 1000;
      const waitTime = Math.max(resetTime - Date.now(), 1000);
      console.log(`Rate limit low (${this.rateLimitRemaining}), waiting ${waitTime}ms`);
      await sleep(waitTime);
    } else if (this.rateLimitRemaining < GITHUB_API.RATE_LIMIT.THRESHOLD_WARN) {
      console.warn(`Rate limit warning: ${this.rateLimitRemaining} requests remaining`);
    }
  }

  // Validate PAT by calling /user endpoint
  async validateToken() {
    try {
      const user = await this.request('/user');
      return { valid: true, user };
    } catch (e) {
      if (e.message === 'INVALID_PAT') {
        return { valid: false, error: 'Invalid Personal Access Token' };
      }
      return { valid: false, error: e.message };
    }
  }

  // List user repositories for dropdown
  async listRepos() {
    const repos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const data = await this.request(`/user/repos?per_page=${perPage}&page=${page}&sort=updated`);
      if (!data.length) break;
      repos.push(...data.map(r => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        description: r.description,
        updatedAt: r.updated_at
      })));
      if (data.length < perPage) break;
      page++;
    }

    return repos;
  }

  // Get file content and SHA
  async getFile(path) {
    try {
      const data = await this.request(`/repos/${this.owner}/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`);
      return {
        sha: data.sha,
        content: data.content ? base64Decode(data.content) : '',
        size: data.size
      };
    } catch (e) {
      if (e.message === 'NOT_FOUND') {
        return null;
      }
      throw e;
    }
  }

  // Create or update a file
  async createOrUpdateFile(path, content, message, sha = null) {
    const body = {
      message,
      content: base64Encode(content),
      branch: this.branch
    };

    if (sha) {
      body.sha = sha;
    }

    const data = await this.request(`/repos/${this.owner}/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    return {
      sha: data.content.sha,
      commit: data.commit.sha,
      htmlUrl: data.content.html_url
    };
  }

  // Push a submission to GitHub
  async pushSubmission(submission) {
    const { platform, problemId, problemName, code, language, runtime, memory, url, contestId, difficulty, tags } = submission;

    // Generate file paths
    let slugStr = problemId;
    if (platform === 'codeforces' && problemName) {
      slugStr = `${problemId}-${problemName}`;
    }
    const slug = slugify(slugStr);
    const ext = getFileExtension(language);
    const solutionPath = `${platform}/${slug}/solution${ext}`;
    const readmePath = `${platform}/${slug}/README.md`;

    const commitMessage = this.generateCommitMessage(submission);

    // Check if solution file exists and if content changed
    const existingFile = await this.getFile(solutionPath);
    if (existingFile && existingFile.content === code) {
      console.log(`Solution unchanged, skipping: ${solutionPath}`);
      return { skipped: true, path: solutionPath };
    }

    // Push solution file
    await this.createOrUpdateFile(solutionPath, code, commitMessage, existingFile?.sha);

    // Generate/update README
    const existingReadme = await this.getFile(readmePath);
    const readmeContent = generateReadme(submission, existingReadme?.content);
    await this.createOrUpdateFile(readmePath, readmeContent, commitMessage, existingReadme?.sha);

    return { pushed: true, solutionPath, readmePath };
  }


  generateCommitMessage(submission) {
    const template = submission.commitMessageTemplate || '✅ [{platform}] {problemName} ({language})';
    return template
      .replace('{platform}', submission.platform)
      .replace('{problemName}', submission.problemName)
      .replace('{language}', submission.language)
      .replace('{difficulty}', submission.difficulty || '')
      .replace('{contestId}', submission.contestId || '');
  }
}

export const github = new GitHubClient();