import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome.storage API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  },
  session: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  }
};

global.chrome = {
  storage: mockStorage,
  runtime: {
    getManifest: vi.fn(() => ({ version: '1.0.0' })),
    id: 'test-extension-id'
  }
};

// Mock crypto.subtle for encryption tests
const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    deriveKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    exportKey: vi.fn(),
    generateKey: vi.fn()
  },
  getRandomValues: vi.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

// Use Object.defineProperty to mock crypto since it's read-only in Node.js
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
  configurable: true
});

describe('utils.js', () => {
  let utils;

  beforeEach(async () => {
    vi.resetModules();
    utils = await import('../utils.js');
  });

  describe('slugify', () => {
    it('should convert text to lowercase and replace spaces with hyphens', () => {
      expect(utils.slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(utils.slugify('Hello@#$%World!')).toBe('helloworld');
    });

    it('should handle multiple spaces', () => {
      expect(utils.slugify('Hello   World')).toBe('hello-world');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(utils.slugify('  Hello World  ')).toBe('hello-world');
    });

    it('should handle empty string', () => {
      expect(utils.slugify('')).toBe('');
    });

    it('should handle unicode characters', () => {
      expect(utils.slugify('Héllo Wörld')).toBe('hllo-wrld');
    });
  });

  describe('getFileExtension', () => {
    it('should return correct extension for common languages', () => {
      expect(utils.getFileExtension('python')).toBe('py');
      expect(utils.getFileExtension('javascript')).toBe('js');
      expect(utils.getFileExtension('cpp')).toBe('cpp');
      expect(utils.getFileExtension('java')).toBe('java');
      expect(utils.getFileExtension('rust')).toBe('rs');
      expect(utils.getFileExtension('go')).toBe('go');
    });

    it('should be case insensitive', () => {
      expect(utils.getFileExtension('PYTHON')).toBe('py');
      expect(utils.getFileExtension('JavaScript')).toBe('js');
    });

    it('should return default for unknown languages', () => {
      expect(utils.getFileExtension('unknown')).toBe('txt');
    });
  });

  describe('generateReadme', () => {
    it('should generate a valid markdown readme', () => {
      const readme = utils.generateReadme({
        platform: 'leetcode',
        problemId: 'two-sum',
        problemTitle: 'Two Sum',
        problemUrl: 'https://leetcode.com/problems/two-sum/',
        language: 'python',
        code: 'def twoSum(self, nums, target):\n    pass',
        runtime: '45 ms',
        memory: '14.2 MB',
        timestamp: '2024-01-15T10:30:00Z'
      });

      expect(readme).toContain('# Two Sum');
      expect(readme).toContain('leetcode');
      expect(readme).toContain('two-sum');
      expect(readme).toContain('python');
      expect(readme).toContain('45 ms');
      expect(readme).toContain('14.2 MB');
      expect(readme).toContain('def twoSum');
    });

    it('should handle missing optional fields', () => {
      const readme = utils.generateReadme({
        platform: 'codeforces',
        problemId: '123A',
        problemTitle: 'Test Problem',
        problemUrl: 'https://codeforces.com/problemset/problem/123/A',
        language: 'cpp',
        code: 'int main() {}'
      });

      expect(readme).toContain('# Test Problem');
      expect(readme).toContain('codeforces');
    });
  });

  describe('parseReadmeTable', () => {
    it('should parse a valid readme table', () => {
      const readme = `# Test Problem

| Property | Value |
|----------|-------|
| Platform | leetcode |
| Problem ID | two-sum |
| Language | python |
| Status | Accepted |
| Runtime | 45 ms |
| Memory | 14.2 MB |
| Synced | 2024-01-15T10:30:00Z |`;

      const parsed = utils.parseReadmeTable(readme);
      expect(parsed.platform).toBe('leetcode');
      expect(parsed.problemId).toBe('two-sum');
      expect(parsed.language).toBe('python');
      expect(parsed.status).toBe('Accepted');
      expect(parsed.runtime).toBe('45 ms');
      expect(parsed.memory).toBe('14.2 MB');
    });

    it('should return null for invalid readme', () => {
      expect(utils.parseReadmeTable('invalid')).toBeNull();
      expect(utils.parseReadmeTable('')).toBeNull();
    });
  });

  describe('base64Encode', () => {
    it('should encode ASCII strings', () => {
      expect(utils.base64Encode('hello')).toBe('aGVsbG8=');
    });

    it('should encode UTF-8 strings', () => {
      expect(utils.base64Encode('héllo')).toBe('aMO2bGxv');
    });

    it('should handle empty string', () => {
      expect(utils.base64Encode('')).toBe('');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay function execution', () => {
      const fn = vi.fn();
      const debounced = utils.debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only call once for multiple rapid calls', () => {
      const fn = vi.fn();
      const debounced = utils.debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = vi.fn();
      const debounced = utils.debounce(fn, 100);

      debounced('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = utils.generateId();
      const id2 = utils.generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = utils.generateId();
      expect(id).toMatch(/^[a-z0-9]{16}$/);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(utils.formatBytes(0)).toBe('0 Bytes');
      expect(utils.formatBytes(1024)).toBe('1 KB');
      expect(utils.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(utils.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(utils.formatBytes(1536)).toBe('1.5 KB');
    });
  });
});

describe('storage.js', () => {
  let storage;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockStorage.local.get.mockResolvedValue({});
    mockStorage.local.set.mockResolvedValue(undefined);
    mockStorage.local.remove.mockResolvedValue(undefined);
    mockStorage.session.get.mockResolvedValue({});
    mockStorage.session.set.mockResolvedValue(undefined);
    
    // Mock crypto for encryption
    mockCrypto.subtle.importKey.mockResolvedValue({});
    mockCrypto.subtle.deriveKey.mockResolvedValue({});
    mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode('test-token').buffer);
    mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
    
    storage = await import('../storage.js');
  });

  describe('Storage class', () => {
    let storageInstance;

    beforeEach(() => {
      storageInstance = new storage.Storage();
    });

    describe('get/set', () => {
      it('should get and set values', async () => {
        mockStorage.local.get.mockResolvedValue({ testKey: 'testValue' });
        
        await storageInstance.set('testKey', 'testValue');
        expect(mockStorage.local.set).toHaveBeenCalledWith({ testKey: 'testValue' });
        
        const value = await storageInstance.get('testKey');
        expect(mockStorage.local.get).toHaveBeenCalledWith('testKey');
      });

      it('should return default value when key not found', async () => {
        mockStorage.local.get.mockResolvedValue({});
        const value = await storageInstance.get('nonexistent', 'default');
        expect(value).toBe('default');
      });

      it('should remove keys', async () => {
        await storageInstance.remove('testKey');
        expect(mockStorage.local.remove).toHaveBeenCalledWith('testKey');
      });
    });

    describe('config operations', () => {
      it('should get config with defaults', async () => {
        mockStorage.local.get.mockResolvedValue({});
        const config = await storageInstance.getConfig();
        
        expect(config).toHaveProperty('githubToken');
        expect(config).toHaveProperty('githubRepo');
        expect(config).toHaveProperty('autoSync');
        expect(config.autoSync).toBe(true);
      });

      it('should merge stored config with defaults', async () => {
        mockStorage.local.get.mockResolvedValue({
          config: { githubRepo: 'test/repo', autoSync: false }
        });
        
        const config = await storageInstance.getConfig();
        expect(config.githubRepo).toBe('test/repo');
        expect(config.autoSync).toBe(false);
        expect(config).toHaveProperty('githubToken');
      });

      it('should set config', async () => {
        await storageInstance.setConfig({ githubRepo: 'new/repo' });
        expect(mockStorage.local.set).toHaveBeenCalled();
      });
    });

    describe('queue operations', () => {
      it('should get empty queue by default', async () => {
        mockStorage.local.get.mockResolvedValue({});
        const queue = await storageInstance.getQueue();
        expect(queue).toEqual([]);
      });

      it('should add items to queue', async () => {
        mockStorage.local.get.mockResolvedValue({ queue: [] });
        
        const item = { id: '1', platform: 'leetcode', problemId: 'two-sum' };
        await storageInstance.addToQueue(item);
        
        expect(mockStorage.local.set).toHaveBeenCalled();
        const setCall = mockStorage.local.set.mock.calls[0][0];
        expect(setCall.queue).toHaveLength(1);
        expect(setCall.queue[0]).toMatchObject(item);
      });

      it('should update queue items', async () => {
        const existingQueue = [{ id: '1', status: 'pending', attempts: 0 }];
        mockStorage.local.get.mockResolvedValue({ queue: existingQueue });
        
        await storageInstance.updateQueueItem('1', { status: 'completed' });
        
        expect(mockStorage.local.set).toHaveBeenCalled();
        const setCall = mockStorage.local.set.mock.calls[0][0];
        expect(setCall.queue[0].status).toBe('completed');
      });

      it('should remove items from queue', async () => {
        const existingQueue = [{ id: '1' }, { id: '2' }];
        mockStorage.local.get.mockResolvedValue({ queue: existingQueue });
        
        await storageInstance.removeFromQueue('1');
        
        expect(mockStorage.local.set).toHaveBeenCalled();
        const setCall = mockStorage.local.set.mock.calls[0][0];
        expect(setCall.queue).toHaveLength(1);
        expect(setCall.queue[0].id).toBe('2');
      });
    });

    describe('PAT encryption', () => {
      it('should encrypt and decrypt PAT', async () => {
        const token = 'ghp_test123456789';
        
        const encrypted = await storageInstance.encryptPAT(token);
        expect(encrypted).toBeDefined();
        expect(typeof encrypted).toBe('string');
        
        mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode(token).buffer);
        const decrypted = await storageInstance.decryptPAT(encrypted);
        expect(decrypted).toBe(token);
      });

      it('should handle session PAT', async () => {
        const token = 'ghp_test123456789';
        mockStorage.session.get.mockResolvedValue({ sessionPat: 'encrypted-token' });
        
        await storageInstance.setSessionPAT(token);
        expect(mockStorage.session.set).toHaveBeenCalled();
        
        mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode(token).buffer);
        const retrieved = await storageInstance.getSessionPAT();
        expect(retrieved).toBe(token);
      });
    });
  });
});

describe('github.js', () => {
  let github;
  let mockFetch;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    github = await import('../github.js');
  });

  describe('GitHubClient', () => {
    let client;

    beforeEach(() => {
      client = new github.GitHubClient('test-token');
    });

    describe('validateToken', () => {
      it('should return true for valid token', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ login: 'testuser' })
        });

        const result = await client.validateToken();
        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/user',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token'
            })
          })
        );
      });

      it('should return false for invalid token', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401
        });

        const result = await client.validateToken();
        expect(result).toBe(false);
      });
    });

    describe('listRepos', () => {
      it('should fetch and return repositories', async () => {
        const mockRepos = [
          { full_name: 'user/repo1', private: false },
          { full_name: 'user/repo2', private: true }
        ];

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockRepos)
        });

        const repos = await client.listRepos();
        expect(repos).toEqual(mockRepos);
      });

      it('should handle pagination', async () => {
        const mockRepos1 = [{ full_name: 'user/repo1' }];
        const mockRepos2 = [{ full_name: 'user/repo2' }];

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockRepos1),
            headers: new Map([['link', '<https://api.github.com/user/repos?page=2>; rel="next"']])
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockRepos2),
            headers: new Map()
          });

        const repos = await client.listRepos();
        expect(repos).toHaveLength(2);
      });
    });

    describe('getFile', () => {
      it('should fetch file content and SHA', async () => {
        const mockFile = {
          content: 'base64content',
          sha: 'abc123'
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockFile)
        });

        const result = await client.getFile('owner/repo', 'path/file.py', 'main');
        expect(result).toEqual({ content: 'base64content', sha: 'abc123' });
      });

      it('should return null for 404', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404
        });

        const result = await client.getFile('owner/repo', 'path/file.py', 'main');
        expect(result).toBeNull();
      });
    });

    describe('createOrUpdateFile', () => {
      it('should create new file', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ content: { sha: 'newsha' } })
        });

        const result = await client.createOrUpdateFile(
          'owner/repo',
          'path/file.py',
          'content',
          'commit message',
          'main'
        );

        expect(result).toEqual({ sha: 'newsha' });
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/owner/repo/contents/path/file.py',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('content')
          })
        );
      });

      it('should update existing file with SHA', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ content: { sha: 'updatedsha' } })
        });

        const result = await client.createOrUpdateFile(
          'owner/repo',
          'path/file.py',
          'content',
          'commit message',
          'main',
          'oldsha'
        );

        expect(result).toEqual({ sha: 'updatedsha' });
        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.sha).toBe('oldsha');
      });
    });

    describe('pushSubmission', () => {
      it('should push submission with solution and readme', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ content: { sha: 'solsha' } })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ content: { sha: 'readmesha' } })
          });

        const submission = {
          platform: 'leetcode',
          problemId: 'two-sum',
          problemTitle: 'Two Sum',
          problemUrl: 'https://leetcode.com/problems/two-sum/',
          language: 'python',
          code: 'def twoSum(): pass',
          runtime: '45 ms',
          memory: '14.2 MB',
          timestamp: '2024-01-15T10:30:00Z'
        };

        const result = await client.pushSubmission('owner/repo', submission, 'main', 'solutions');
        
        expect(result).toHaveProperty('solution');
        expect(result).toHaveProperty('readme');
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('rate limiting', () => {
      it('should respect rate limit headers', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ login: 'testuser' }),
          headers: new Map([
            ['x-ratelimit-remaining', '100'],
            ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 3600)]
          ])
        });

        await client.validateToken();
        
        // Check that rate limit info was stored
        expect(client.rateLimitRemaining).toBe(100);
      });

      it('should retry on rate limit exceeded', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 403,
            headers: new Map([
              ['x-ratelimit-remaining', '0'],
              ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 1)]
            ])
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ login: 'testuser' })
          });

        // This should retry after waiting
        const result = await client.validateToken();
        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });
});