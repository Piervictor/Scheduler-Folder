/**
 * firebase-storage-adapter.js
 * Hybrid storage adapter that uses Firebase when available, falls back to localStorage
 * Provides a drop-in replacement for SharedUtils.Storage methods
 */

(function() {
  'use strict';

  // Collection name mapping from localStorage keys
  const COLLECTION_MAP = {
    'cvsa_locations': 'locations',
    'cvsa_volunteers': 'volunteers',
    'cvsa_bookings': 'bookings',
    'cvsa_location_slots': 'schedules',
    'cvsa_preferences': 'preferences'
  };

  // Determine if we should use Firebase
  function shouldUseFirebase() {
    return typeof FirebaseAPI !== 'undefined' && FirebaseAPI.isReady();
  }

  // Get collection name from key
  function getCollectionName(key) {
    return COLLECTION_MAP[key] || key;
  }

  // Enhanced Storage wrapper
  window.FirebaseStorageAdapter = {
    /**
     * Save data - uses Firebase if available, else localStorage
     */
    async save(key, value) {
      if (shouldUseFirebase()) {
        try {
          const collection = getCollectionName(key);
          
          // For array data (most common case)
          if (Array.isArray(value)) {
            // First, get existing docs to avoid duplicates
            const existing = await FirebaseAPI.getAll(collection);
            
            // Add only new items
            for (const item of value) {
              const exists = existing.find(e => e.id === item.id);
              if (!exists && item.id) {
                await FirebaseAPI.set(collection, item.id, item);
              }
            }
          } else {
            // For single objects, use set
            await FirebaseAPI.set(collection, key, value);
          }
          
          console.log(`✅ Saved to Firebase: ${collection}`);
          return { success: true, backend: 'firebase' };
        } catch (err) {
          console.warn(`⚠️ Firebase save failed, falling back to localStorage:`, err);
          return this.saveToLocalStorage(key, value);
        }
      } else {
        return this.saveToLocalStorage(key, value);
      }
    },

    /**
     * Load data - uses Firebase if available, else localStorage
     */
    async load(key, defaultValue = null) {
      if (shouldUseFirebase()) {
        try {
          const collection = getCollectionName(key);
          const data = await FirebaseAPI.getAll(collection);
          console.log(`✅ Loaded from Firebase: ${collection} (${data.length} items)`);
          return data.length > 0 ? data : defaultValue;
        } catch (err) {
          console.warn(`⚠️ Firebase load failed, falling back to localStorage:`, err);
          return this.loadFromLocalStorage(key, defaultValue);
        }
      } else {
        return this.loadFromLocalStorage(key, defaultValue);
      }
    },

    /**
     * Add single item to collection
     */
    async add(key, item) {
      if (shouldUseFirebase()) {
        try {
          const collection = getCollectionName(key);
          const result = await FirebaseAPI.add(collection, item);
          console.log(`✅ Added to Firebase: ${collection}`);
          return { success: true, data: result, backend: 'firebase' };
        } catch (err) {
          console.warn(`⚠️ Firebase add failed:`, err);
          return { success: false, error: err };
        }
      } else {
        // localStorage fallback
        const all = this.loadFromLocalStorage(key, []);
        all.push(item);
        return this.saveToLocalStorage(key, all);
      }
    },

    /**
     * Update item by ID
     */
    async update(key, id, updates) {
      if (shouldUseFirebase()) {
        try {
          const collection = getCollectionName(key);
          const result = await FirebaseAPI.update(collection, id, updates);
          console.log(`✅ Updated in Firebase: ${collection}/${id}`);
          return { success: true, data: result, backend: 'firebase' };
        } catch (err) {
          console.warn(`⚠️ Firebase update failed:`, err);
          return { success: false, error: err };
        }
      } else {
        // localStorage fallback
        const all = this.loadFromLocalStorage(key, []);
        const index = all.findIndex(item => item.id === id);
        if (index !== -1) {
          all[index] = { ...all[index], ...updates };
          return this.saveToLocalStorage(key, all);
        }
        return { success: false, error: 'Item not found' };
      }
    },

    /**
     * Delete item by ID
     */
    async delete(key, id) {
      if (shouldUseFirebase()) {
        try {
          const collection = getCollectionName(key);
          await FirebaseAPI.delete(collection, id);
          console.log(`✅ Deleted from Firebase: ${collection}/${id}`);
          return { success: true, backend: 'firebase' };
        } catch (err) {
          console.warn(`⚠️ Firebase delete failed:`, err);
          return { success: false, error: err };
        }
      } else {
        // localStorage fallback
        const all = this.loadFromLocalStorage(key, []);
        const filtered = all.filter(item => item.id !== id);
        return this.saveToLocalStorage(key, filtered);
      }
    },

    /**
     * localStorage fallback methods
     */
    saveToLocalStorage(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { success: true, backend: 'localStorage' };
      } catch (err) {
        console.error(`❌ localStorage save failed:`, err);
        return { success: false, error: err };
      }
    },

    loadFromLocalStorage(key, defaultValue = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultValue;
      } catch (err) {
        console.error(`❌ localStorage load failed:`, err);
        return defaultValue;
      }
    },

    /**
     * Get current backend being used
     */
    getCurrentBackend() {
      return shouldUseFirebase() ? 'firebase' : 'localStorage';
    },

    /**
     * Check if Firebase is available
     */
    isFirebaseAvailable() {
      return shouldUseFirebase();
    }
  };

  console.log(`🔧 Firebase Storage Adapter loaded. Current backend: ${FirebaseStorageAdapter.getCurrentBackend()}`);
})();
