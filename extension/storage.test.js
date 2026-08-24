import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome.storage API
const mockStorage = {
  local: {},
  session: {}
};

const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            if (mockStorage.local[key] !== undefined) {
              result[key] = mockStorage.local[key];
            }
          });
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach(key => {
            if (mockStorage.local[key] !== undefined) {
              result[key] = mockStorage.local[key];
            } else {
              result[key] = keys[key];
            }
          });
        } else if (keys === null || keys === undefined) {
          Object.assign(result, mockStorage.local);
        } else {
          if (mockStorage.local[keys] !== undefined) {
            result[keys] = mockStorage.local[keys];
          }
        }
        callback(result);
      }),
      set: vi.fn((items, callback) => {
        Object.assign(mockStorage.local, items);
        if (callback) callback();
      }),
      remove: vi.fn((keys, callback) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach(key => delete mockStorage.local[key]);
        if (callback) callback();
      }),
      clear: vi.fn((callback) => {
        mockStorage.local = {};
        if (callback) callback();
      })
    },
    session: {
      get: vi.fn((keys, callback) => {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            if (mockStorage.session[key] !== undefined) {
              result[key] = mockStorage.session[key];
            }
          });
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach(key => {
            if (mockStorage.session[key] !== undefined) {
              result[key] = mockStorage.session[key];
            } else {
              result[key] = keys[key];
            }
          });
        } else if (keys === null || keys === undefined) {
          Object.assign(result, mockStorage.session);
        } else {
          if (mockStorage.session[keys] !== undefined) {
            result[keys] = mockStorage.session[keys];
          }
        }
        callback(result);
      }),
      set: vi.fn((items, callback) => {
        Object.assign(mockStorage.session, items);
        if (callback) callback();
      }),
      remove: vi.fn((keys, callback) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach(key => delete mockStorage.session[key]);
        if (callback) callback();
      }),
      clear: vi.fn((callback) => {
        mockStorage.session = {};
        if (callback) callback();
      })
    }
  },
  runtime: {
    id: 'test-extension-id',
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() }
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() }
  },
  webNavigation: {
    onCompleted: { addListener: vi.fn() },
    onHistoryStateUpdated: { addListener: vi.fn() }
  }
};

global.chrome = mockChrome;

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

// Use Object.defineProperty to mock global.crypto (read-only in Node.js)
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
  configurable: true
});

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(str) {
    return new Uint8Array(Buffer.from(str, 'utf8'));
  }
};

global.TextDecoder = class TextDecoder {
  decode(uint8array) {
    return Buffer.from(uint8array).toString('utf8');
  }
};

// Mock btoa/atob
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

describe('storage', () => {
  let storage;
  
  beforeEach(async () => {
    vi.resetModules();
    mockStorage.local = {};
    mockStorage.session = {};
    vi.clearAllMocks();
    
    // Import the module after mocks are set up
    const module = await import('./storage.js');
    storage = module.storage;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('basic operations', () => {
    it('should get and set values', async () => {
      await storage.set('testKey', 'testValue');
      const value = await storage.get('testKey');
      expect(value).toBe('testValue');
    });

    it('should return default value for missing keys', async () => {
      const value = await storage.get('missingKey', 'defaultValue');
      expect(value).toBe('defaultValue');
    });

    it('should remove values', async () => {
      await storage.set('testKey', 'testValue');
      await storage.remove('testKey');
      const value = await storage.get('testKey', 'defaultValue');
      expect(value).toBe('defaultValue');
    });

    it('should get multiple values at once', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      const result = await storage.get(['key1', 'key2']);
      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
    });
  });

  describe('config operations', () => {
    it('should get default config when none stored', async () => {
      const config = await storage.getConfig();
      expect(config).toEqual(expect.objectContaining({
        autoSync: true,
        syncPlatforms: expect.objectContaining({
          codeforces: true,
          leetcode: true,
          atcoder: true
        })
      }));
    });

    it('should merge stored config with defaults', async () => {
      await storage.set('codehub_config', { autoSync: false, customField: 'test' });
      const config = await storage.getConfig();
      expect(config.autoSync).toBe(false);
      expect(config.customField).toBe('test');
      expect(config.syncPlatforms.codeforces).toBe(true); // default preserved
    });

    it('should set config', async () => {
      await storage.setConfig({ autoSync: false, githubRepo: 'user/repo' });
      const config = await storage.getConfig();
      expect(config.autoSync).toBe(false);
      expect(config.githubRepo).toBe('user/repo');
    });
  });

  describe('queue operations', () => {
    it('should initialize empty queue', async () => {
      const queue = await storage.getQueue();
      expect(queue).toEqual([]);
    });

    it('should add items to queue', async () => {
      const item = { id: '1', platform: 'leetcode', problemId: '1' };
      await storage.addToQueue(item);
      const queue = await storage.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject(item);
    });

    it('should update queue items', async () => {
      const item = { id: '1', platform: 'leetcode', problemId: '1', status: 'pending' };
      await storage.addToQueue(item);
      await storage.updateQueueItem('1', { status: 'completed' });
      const queue = await storage.getQueue();
      expect(queue[0].status).toBe('completed');
    });

    it('should remove items from queue', async () => {
      await storage.addToQueue({ id: '1', platform: 'leetcode', problemId: '1' });
      await storage.addToQueue({ id: '2', platform: 'codeforces', problemId: '2' });
      await storage.removeFromQueue('1');
      const queue = await storage.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('2');
    });

    it('should replace entire queue', async () => {
      await storage.addToQueue({ id: '1', platform: 'leetcode', problemId: '1' });
      await storage.updateQueue([
        { id: '2', platform: 'codeforces', problemId: '2' },
        { id: '3', platform: 'atcoder', problemId: '3' }
      ]);
      const queue = await storage.getQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe('2');
      expect(queue[1].id).toBe('3');
    });
  });

  describe('PAT encryption', () => {
    it('should encrypt and decrypt PAT', async () => {
      const pat = 'ghp_test12345678901234567890123456789012';
      
      // Mock crypto operations
      const mockKey = { type: 'secret' };
      const mockDerivedKey = { type: 'derived' };
      const mockEncrypted = new ArrayBuffer(32);
      const mockDecrypted = new TextEncoder().encode(pat);
      
      mockCrypto.subtle.importKey.mockResolvedValue(mockKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue(mockDerivedKey);
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);
      mockCrypto.subtle.decrypt.mockResolvedValue(mockDecrypted);
      mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      
      const encrypted = await storage.encryptPAT(pat);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      
      const decrypted = await storage.decryptPAT(encrypted);
      expect(decrypted).toBe(pat);
    });

    it('should handle empty PAT', async () => {
      const encrypted = await storage.encryptPAT('');
      expect(encrypted).toBe('');
      
      const decrypted = await storage.decryptPAT('');
      expect(decrypted).toBe('');
    });

    it('should store and retrieve PAT in session storage', async () => {
      const pat = 'ghp_test12345678901234567890123456789012';
      
      const mockKey = { type: 'secret' };
      const mockDerivedKey = { type: 'derived' };
      const mockEncrypted = new ArrayBuffer(32);
      const mockDecrypted = new TextEncoder().encode(pat);
      
      mockCrypto.subtle.importKey.mockResolvedValue(mockKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue(mockDerivedKey);
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);
      mockCrypto.subtle.decrypt.mockResolvedValue(mockDecrypted);
      mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      
      await storage.setSessionPAT(pat);
      const retrieved = await storage.getSessionPAT();
      expect(retrieved).toBe(pat);
    });

    it('should clear session PAT', async () => {
      await storage.clearSessionPAT();
      const pat = await storage.getSessionPAT();
      expect(pat).toBeNull();
    });
  });

  describe('history operations', () => {
    it('should add to history', async () => {
      const submission = { id: '1', platform: 'leetcode', problemName: 'Two Sum' };
      await storage.addToHistory(submission);
      const history = await storage.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject(submission);
    });

    it('should limit history size', async () => {
      for (let i = 0; i < 105; i++) {
        await storage.addToHistory({ id: String(i), platform: 'leetcode', problemName: `Problem ${i}` });
      }
      const history = await storage.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should clear history', async () => {
      await storage.addToHistory({ id: '1', platform: 'leetcode', problemName: 'Two Sum' });
      await storage.clearHistory();
      const history = await storage.getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('rate limit operations', () => {
    it('should get and set rate limit info', async () => {
      const rateLimit = { remaining: 4999, reset: Date.now() + 3600000, limit: 5000 };
      await storage.setRateLimit(rateLimit);
      const retrieved = await storage.getRateLimit();
      expect(retrieved).toEqual(rateLimit);
    });
  });

  describe('last sync operations', () => {
    it('should get and set last sync time', async () => {
      const time = Date.now();
      await storage.setLastSync(time);
      const retrieved = await storage.getLastSync();
      expect(retrieved).toBe(time);
    });

    it('should return null for missing last sync', async () => {
      const retrieved = await storage.getLastSync();
      expect(retrieved).toBeNull();
    });
  });

  describe('migration', () => {
    it('should migrate old storage format', async () => {
      // Simulate old format
      mockStorage.local.codehub_pat = 'old_pat';
      mockStorage.local.codehub_repo = 'user/repo';
      mockStorage.local.codehub_queue = [{ id: '1', platform: 'leetcode' }];
      
      await storage.migrate();
      
      const config = await storage.getConfig();
      expect(config.githubToken).toBe('old_pat');
      expect(config.githubRepo).toBe('user/repo');
      
      const queue = await storage.getQueue();
      expect(queue).toHaveLength(1);
    });
  });
});