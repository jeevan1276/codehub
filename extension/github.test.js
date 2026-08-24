import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock TextEncoder/TextDecoder (used by base64Encode/base64Decode in utils.js)
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Minimal btoa/atob polyfill (Node provides these natively)
global.btoa = global.btoa || ((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = global.atob || ((str) => Buffer.from(str, 'base64').toString('binary'));

// Mock chrome runtime
global.chrome = {
  runtime: {
    lastError: null,
    id: 'test-extension-id'
  }
};

// Helper to make a mock Response with header.get() support
function mockResponse({ ok, status, headers = {}, body }) {
  const headerMap = new Map(Object.entries(headers));
  return {
    ok,
    status,
    headers: { get: (key) => headerMap.get(key.toLowerCase()) ?? null },
    json: async () => body
  };
}

describe('github', () => {
  let github;
  let client;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch.mockReset();
    global.chrome.runtime.lastError = null;

    const module = await import('./github.js');
    github = module.github;
    // Reset client state for each test by creating a fresh client via the exported singleton
    client = github;
    client.pat = null;
    client.repo = null;
    client.owner = null;
    client.branch = 'main';
    client.rateLimitRemaining = 5000;
    client.rateLimitReset = 0;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('setCredentials', () => {
    it('should set PAT, repo, owner and branch', () => {
      client.setCredentials('test-token', 'owner/repo', 'main');
      expect(client.pat).toBe('test-token');
      expect(client.repo).toBe('repo');
      expect(client.owner).toBe('owner');
      expect(client.branch).toBe('main');
    });

    it('should handle repo without owner', () => {
      client.setCredentials('test-token', 'justrepo');
      expect(client.pat).toBe('test-token');
      expect(client.repo).toBe('justrepo');
      expect(client.owner).toBeNull();
    });

    it('should default branch to main', () => {
      client.setCredentials('test-token', 'owner/repo');
      expect(client.branch).toBe('main');
    });
  });

  describe('request', () => {
    it('should make authenticated requests with correct headers', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { data: 'test' }
      }));

      const result = await client.request('/user');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            // The actual header value in github.js is 'application/vnd.github+json'
            Accept: 'application/vnd.github+json'
          })
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should handle rate limit response headers', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true,
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
        },
        body: { data: 'test' }
      }));

      await client.request('/user');
      expect(client.rateLimitRemaining).toBe(4999);
    });

    it('should throw RATE_LIMITED error on 403', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: false,
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1)
        },
        body: { message: 'Rate limit exceeded' }
      }));

      await expect(client.request('/user')).rejects.toThrow(/RATE_LIMITED/);
    });

    it('should throw INVALID_PAT on 401', async () => {
      client.setCredentials('invalid-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: false,
        status: 401,
        headers: { 'content-type': 'application/json' },
        body: { message: 'Bad credentials' }
      }));

      await expect(client.request('/user')).rejects.toThrow('INVALID_PAT');
    });

    it('should throw NOT_FOUND on 404', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: false,
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: { message: 'Not Found' }
      }));

      await expect(client.request('/user')).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      client.setCredentials('valid-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { login: 'testuser' }
      }));

      const result = await client.validateToken();
      expect(result.valid).toBe(true);
      expect(result.user).toEqual({ login: 'testuser' });
    });

    it('should return false for invalid token', async () => {
      client.setCredentials('invalid-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: false,
        status: 401,
        headers: { 'content-type': 'application/json' },
        body: { message: 'Bad credentials' }
      }));

      const result = await client.validateToken();
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Personal Access Token');
    });
  });

  describe('listRepos', () => {
    it('should list and paginate user repositories', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: [
          { name: 'repo1', full_name: 'user/repo1', private: false, description: 'desc1', updated_at: '2024-01-01T00:00:00Z' },
          { name: 'repo2', full_name: 'user/repo2', private: true, description: 'desc2', updated_at: '2024-01-02T00:00:00Z' }
        ]
      }));

      const repos = await client.listRepos();
      expect(repos).toHaveLength(2);
      expect(repos[0].name).toBe('repo1');
      expect(repos[1].private).toBe(true);
    });
  });

  describe('getFile', () => {
    it('should get file content and SHA (UTF-8 safe)', async () => {
      client.setCredentials('test-token', 'owner/repo');

      // Use Buffer for test-side encoding (same bytes the API returns)
      const content = Buffer.from('console.log("hello");').toString('base64');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { content, sha: 'abc123', path: 'test.js' }
      }));

      const result = await client.getFile('test.js');
      expect(result.content).toBe('console.log("hello");');
      expect(result.sha).toBe('abc123');
    });

    it('should return null for missing file', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: false,
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: { message: 'Not Found' }
      }));

      const result = await client.getFile('missing.js');
      expect(result).toBeNull();
    });

    it('should encode path segments separately (not encode slashes)', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true, status: 200,
        headers: { 'content-type': 'application/json' },
        body: { content: '', sha: 'sha1' }
      }));

      await client.getFile('leetcode/0001-two-sum/solution.py');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/contents/leetcode/0001-two-sum/solution.py',
        expect.anything()
      );
    });
  });

  describe('createOrUpdateFile', () => {
    it('should create new file and use configured branch', async () => {
      client.setCredentials('test-token', 'owner/repo', 'develop');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true,
        status: 201,
        headers: { 'content-type': 'application/json' },
        body: { content: { sha: 'new-sha', html_url: 'https://github.com/owner/repo/blob/develop/new.js' }, commit: { sha: 'commit-sha' } }
      }));

      const result = await client.createOrUpdateFile('new.js', 'console.log("new");', 'Add new file');
      expect(result.sha).toBe('new-sha');
      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.branch).toBe('develop');
    });

    it('should include sha when updating existing file', async () => {
      client.setCredentials('test-token', 'owner/repo');

      global.fetch.mockResolvedValue(mockResponse({
        ok: true,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { content: { sha: 'updated-sha', html_url: '' }, commit: { sha: 'commit-sha' } }
      }));

      await client.createOrUpdateFile('existing.js', 'content', 'Update', 'old-sha');
      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.sha).toBe('old-sha');
    });
  });

  describe('pushSubmission', () => {
    it('should push solution file and README', async () => {
      client.setCredentials('test-token', 'owner/repo');

      // 1. getFile(solutionPath) -> 404
      // 2. getFile(readmePath) -> 404
      // 3. createOrUpdateFile(solutionPath) -> success
      // Wait, let's check the actual order in github.js
      // pushSubmission does: getFile(solutionPath), createOrUpdateFile(solutionPath), getFile(readmePath), createOrUpdateFile(readmePath)
      global.fetch
        .mockResolvedValueOnce(mockResponse({ ok: false, status: 404, body: { message: 'Not Found' } })) // getFile(solution)
        .mockResolvedValueOnce(mockResponse({ ok: true, status: 201, body: { content: { sha: 'code-sha', html_url: '' }, commit: { sha: 'c1' } } })) // createOrUpdateFile(solution)
        .mockResolvedValueOnce(mockResponse({ ok: false, status: 404, body: { message: 'Not Found' } })) // getFile(readme)
        .mockResolvedValueOnce(mockResponse({ ok: true, status: 201, body: { content: { sha: 'readme-sha', html_url: '' }, commit: { sha: 'c2' } } })); // createOrUpdateFile(readme)

      const submission = {
        platform: 'leetcode',
        problemId: '1',
        problemName: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum/',
        language: 'python',
        code: 'def twoSum(self, nums, target):\n    pass',
        runtime: '45 ms',
        memory: '14.2 MB',
        difficulty: 'Easy',
        tags: ['array', 'hash-table']
      };

      const result = await client.pushSubmission(submission);
      expect(result.pushed).toBe(true);
      expect(result.solutionPath).toContain('leetcode/');
      expect(result.readmePath).toContain('leetcode/');
    });

    it('should skip if solution content unchanged', async () => {
      client.setCredentials('test-token', 'owner/repo');

      const existingCode = 'def twoSum(self, nums, target):\n    pass';
      const content = Buffer.from(existingCode).toString('base64');

      global.fetch.mockResolvedValueOnce(mockResponse({
        ok: true, status: 200,
        body: { content, sha: 'existing-sha', path: 'leetcode/1/solution.py' }
      }));

      const submission = {
        platform: 'leetcode',
        problemId: '1',
        problemName: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum/',
        language: 'python',
        code: existingCode
      };

      const result = await client.pushSubmission(submission);
      expect(result.skipped).toBe(true);
    });
  });

  describe('generateCommitMessage', () => {
    it('should format commit message from template', () => {
      client.setCredentials('test-token', 'owner/repo');
      const submission = {
        platform: 'leetcode',
        problemName: 'Two Sum',
        language: 'python',
        difficulty: 'Easy',
        contestId: undefined,
        commitMessageTemplate: '✅ [{platform}] {problemName} ({language})'
      };
      const msg = client.generateCommitMessage(submission);
      expect(msg).toBe('✅ [leetcode] Two Sum (python)');
    });
  });
});