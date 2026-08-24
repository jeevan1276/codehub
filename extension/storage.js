// CodeHub - Storage Abstraction Layer
// Provides typed, Promise-based access to chrome.storage with encryption for PAT

import { STORAGE_KEYS, DEFAULT_CONFIG, CURRENT_STORAGE_VERSION } from './constants.js';

class Storage {
  constructor() {
    this.local = chrome.storage.local;
    this.session = chrome.storage.session;
    this._queueMutex = Promise.resolve();
  }

  // Generic get/set with Promise wrapper
  async get(key, storage = 'local') {
    const store = storage === 'session' ? this.session : this.local;
    const result = await store.get(key);
    return result[key];
  }

  async set(key, value, storage = 'local') {
    const store = storage === 'session' ? this.session : this.local;
    await store.set({ [key]: value });
  }

  async remove(key, storage = 'local') {
    const store = storage === 'session' ? this.session : this.local;
    await store.remove(key);
  }

  // Config management
  async getConfig() {
    const config = await this.get(STORAGE_KEYS.CONFIG);
    return { ...DEFAULT_CONFIG, ...config };
  }

  async setConfig(partial) {
    const current = await this.getConfig();
    const updated = { ...current, ...partial };
    await this.set(STORAGE_KEYS.CONFIG, updated);
    return updated;
  }

  // Queue management (atomic read-modify-write)
  async getQueue() {
    const queue = await this.get(STORAGE_KEYS.QUEUE);
    return queue || [];
  }

  async updateQueue(fn) {
    const unlock = await new Promise(resolve => {
      const next = this._queueMutex.then(() => resolve);
      this._queueMutex = next;
    });

    try {
      const queue = await this.getQueue();
      const updated = fn(queue);
      await this.set(STORAGE_KEYS.QUEUE, updated);
      return updated;
    } finally {
      unlock();
    }
  }

  async addToQueue(item) {
    return this.updateQueue(queue => [...queue, item]);
  }

  async updateQueueItem(id, updates) {
    return this.updateQueue(queue =>
      queue.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  }

  async removeFromQueue(id) {
    return this.updateQueue(queue => queue.filter(item => item.id !== id));
  }

  async clearCompletedQueue() {
    return this.updateQueue(queue => queue.filter(item => item.status !== 'completed'));
  }

  // History management
  async getHistory(limit = 50) {
    const history = await this.get(STORAGE_KEYS.HISTORY);
    return (history || []).slice(-limit);
  }

  async addToHistory(entry) {
    const history = await this.get(STORAGE_KEYS.HISTORY) || [];
    history.push({ ...entry, timestamp: Date.now() });
    // Keep last 100 entries
    if (history.length > 100) history.shift();
    await this.set(STORAGE_KEYS.HISTORY, history);
  }

  async clearHistory() {
    await this.set(STORAGE_KEYS.HISTORY, []);
  }

  // PAT encryption using Web Crypto API (AES-GCM)
  async encryptPAT(pat) {
    if (!pat) return null;

    // Generate or retrieve salt
    let salt = await this.get(STORAGE_KEYS.PAT_SALT);
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16));
      await this.set(STORAGE_KEYS.PAT_SALT, Array.from(salt));
    } else {
      salt = new Uint8Array(salt);
    }

    // Derive key from a device-specific secret (using extension ID + fixed string)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(chrome.runtime.id + 'codehub-pat-key'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(pat);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // Store encrypted data + IV together
    const result = {
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    };

    await this.set(STORAGE_KEYS.PAT_ENCRYPTED, result);
    return result;
  }

  async decryptPAT() {
    const encrypted = await this.get(STORAGE_KEYS.PAT_ENCRYPTED);
    const salt = await this.get(STORAGE_KEYS.PAT_SALT);

    if (!encrypted || !salt) return null;

    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(chrome.runtime.id + 'codehub-pat-key'),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new Uint8Array(salt),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
        key,
        new Uint8Array(encrypted.data)
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('Failed to decrypt PAT:', e);
      // Clear corrupted data
      await this.remove(STORAGE_KEYS.PAT_ENCRYPTED);
      await this.remove(STORAGE_KEYS.PAT_SALT);
      return null;
    }
  }

  // Session storage for decrypted PAT (cleared on browser close)
  async setSessionPAT(pat) {
    await this.set(STORAGE_KEYS.PAT_SESSION, pat, 'session');
  }

  async getSessionPAT() {
    return this.get(STORAGE_KEYS.PAT_SESSION, 'session');
  }

  async clearSessionPAT() {
    await this.remove(STORAGE_KEYS.PAT_SESSION, 'session');
  }

  // Storage version for migrations
  async getStorageVersion() {
    const version = await this.get(STORAGE_KEYS.STORAGE_VERSION);
    return version || 0;
  }

  async setStorageVersion(version) {
    await this.set(STORAGE_KEYS.STORAGE_VERSION, version);
  }

  // Migration helper
  async migrateIfNeeded(migrations) {
    const currentVersion = await this.getStorageVersion();
    for (const [version, migration] of Object.entries(migrations)) {
      if (version > currentVersion) {
        await migration(this);
        await this.setStorageVersion(version);
      }
    }
  }
}

export const storage = new Storage();