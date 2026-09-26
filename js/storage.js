/**
 * storage.js - IndexedDB & LocalStorage persistent storage manager
 * 咱的台語 - Lán ê Tâi-gí
 */

class StorageManager {
  constructor() {
    this.dbName = 'LanTaigiDB';
    this.dbVersion = 2;
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Bookmarks store
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bmStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
          bmStore.createIndex('hz', 'hz', { unique: false });
          bmStore.createIndex('time', 'time', { unique: false });
        }

        // History store
        if (!db.objectStoreNames.contains('history')) {
          const histStore = db.createObjectStore('history', { keyPath: 'id' });
          histStore.createIndex('time', 'time', { unique: false });
        }

        // Offline audio blobs (from user imported zip package)
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs', { keyPath: 'id' });
        }

        // Quiz error notebook
        if (!db.objectStoreNames.contains('quiz_errors')) {
          const errStore = db.createObjectStore('quiz_errors', { keyPath: 'id' });
          errStore.createIndex('time', 'time', { unique: false });
        }

        // Study stats
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'key' });
        }

        // SM-2 Spaced Repetition Items store
        if (!db.objectStoreNames.contains('srs_items')) {
          const srsStore = db.createObjectStore('srs_items', { keyPath: 'id' });
          srsStore.createIndex('nextReviewDate', 'nextReviewDate', { unique: false });
          srsStore.createIndex('repetitions', 'repetitions', { unique: false });
        }

        // Level Map Progress store
        if (!db.objectStoreNames.contains('level_progress')) {
          const lvlStore = db.createObjectStore('level_progress', { keyPath: 'levelKey' });
          lvlStore.createIndex('unitId', 'unitId', { unique: false });
        }

        // User Learner Profile store (streak, exp, stars)
        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB init error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async ensureDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  // --- Bookmarks ---
  async getBookmarks() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bookmarks', 'readonly');
      const store = tx.objectStore('bookmarks');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.time - a.time));
      req.onerror = () => reject(req.error);
    });
  }

  async isBookmarked(id) {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('bookmarks', 'readonly');
      const store = tx.objectStore('bookmarks');
      const req = store.get(id);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  }

  async toggleBookmark(word) {
    const db = await this.ensureDB();
    const bookmarked = await this.isBookmarked(word.id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bookmarks', 'readwrite');
      const store = tx.objectStore('bookmarks');
      if (bookmarked) {
        store.delete(word.id);
        tx.oncomplete = () => resolve(false);
      } else {
        store.put({
          id: word.id,
          hz: word.hz,
          tl: word.tl,
          cat: word.cat || '',
          def: word.def || word.summary || '',
          audio: word.a || word.audio || word.id,
          time: Date.now()
        });
        tx.oncomplete = () => resolve(true);
      }
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- History ---
  async addHistory(word) {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      store.put({
        id: word.id,
        hz: word.hz,
        tl: word.tl,
        time: Date.now()
      });
      tx.oncomplete = () => resolve();
    });
  }

  async getHistory(limit = 30) {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('history', 'readonly');
      const store = tx.objectStore('history');
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = req.result.sort((a, b) => b.time - a.time);
        resolve(sorted.slice(0, limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  async clearHistory() {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('history', 'readwrite');
      tx.objectStore('history').clear();
      tx.oncomplete = () => resolve();
    });
  }

  // --- Offline Audio Blobs ---
  async saveAudioBlob(id, blob) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_blobs', 'readwrite');
      const store = tx.objectStore('audio_blobs');
      store.put({ id: String(id), blob: blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAudioBlob(id) {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('audio_blobs', 'readonly');
      const store = tx.objectStore('audio_blobs');
      const req = store.get(String(id));
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => resolve(null);
    });
  }

  async countAudioBlobs() {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('audio_blobs', 'readonly');
      const store = tx.objectStore('audio_blobs');
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  }

  // --- Quiz Errors & Stats ---
  async addQuizError(quizItem) {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('quiz_errors', 'readwrite');
      const store = tx.objectStore('quiz_errors');
      store.put({
        id: quizItem.id || String(Date.now()),
        hz: quizItem.hz,
        tl: quizItem.tl,
        question: quizItem.question,
        correct: quizItem.correct,
        userAnswer: quizItem.userAnswer,
        time: Date.now()
      });
      tx.oncomplete = () => resolve();
    });
  }

  async getQuizErrors() {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('quiz_errors', 'readonly');
      const store = tx.objectStore('quiz_errors');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.time - a.time));
      req.onerror = () => resolve([]);
    });
  }

  async clearQuizErrors() {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('quiz_errors', 'readwrite');
      tx.objectStore('quiz_errors').clear();
      tx.oncomplete = () => resolve();
    });
  }

  // --- SM-2 SRS Repetition Storage ---
  async saveSRSItem(item) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('srs_items', 'readwrite');
      const store = tx.objectStore('srs_items');
      store.put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSRSItem(id) {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('srs_items', 'readonly');
      const store = tx.objectStore('srs_items');
      const req = store.get(String(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async getAllSRSItems() {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('srs_items', 'readonly');
      const store = tx.objectStore('srs_items');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async getDueSRSItems() {
    const all = await this.getAllSRSItems();
    const now = Date.now();
    return all.filter(item => !item.nextReviewDate || item.nextReviewDate <= now);
  }

  // --- Level Map Progress Storage ---
  async saveLevelProgress(levelKey, data) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('level_progress', 'readwrite');
      const store = tx.objectStore('level_progress');
      const record = { levelKey, ...data, updatedAt: Date.now() };
      store.put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getLevelProgress(levelKey) {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('level_progress', 'readonly');
      const store = tx.objectStore('level_progress');
      const req = store.get(levelKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async getAllLevelProgress() {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('level_progress', 'readonly');
      const store = tx.objectStore('level_progress');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  // --- User Profile (Streak, Stars, Exp) ---
  async getUserProfile() {
    const db = await this.ensureDB();
    return new Promise((resolve) => {
      const tx = db.transaction('user_profile', 'readonly');
      const store = tx.objectStore('user_profile');
      const req = store.get('main_profile');
      req.onsuccess = () => {
        const defaultProfile = {
          key: 'main_profile',
          streak: 1,
          lastActiveDate: new Date().toISOString().split('T')[0],
          totalStars: 0,
          totalReviews: 0,
          totalPronunciations: 0
        };
        resolve(req.result || defaultProfile);
      };
      req.onerror = () => resolve({
        key: 'main_profile',
        streak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        totalStars: 0,
        totalReviews: 0
      });
    });
  }

  async saveUserProfile(profile) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('user_profile', 'readwrite');
      const store = tx.objectStore('user_profile');
      profile.key = 'main_profile';
      store.put(profile);
      tx.oncomplete = () => resolve(profile);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Preferences (LocalStorage) ---
  getPref(key, defaultVal) {
    try {
      const val = localStorage.getItem('lan_taigi_' + key);
      return val !== null ? JSON.parse(val) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  setPref(key, val) {
    try {
      localStorage.setItem('lan_taigi_' + key, JSON.stringify(val));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }
}

window.storage = new StorageManager();
