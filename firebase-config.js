/**
 * firebase-config.js
 * Firebase configuration and API wrapper for Congregation Volunteer Scheduler
 * 
 * Setup Instructions:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Authentication (Email/Password provider)
 * 3. Enable Firestore Database
 * 4. Copy your config from Project Settings and replace the placeholder below
 * 5. Deploy the firestore.rules to set up security
 */

(function() {
  'use strict';

  // ============================================
  // FIREBASE CONFIGURATION
  // ============================================
  // Your Firebase project configuration
  const firebaseConfig = {
    apiKey: "AIzaSyA_gkr9H032PrdIgyKeRsi75TisHmRgRIQ",
    authDomain: "congregation-scheduler.firebaseapp.com",
    projectId: "congregation-scheduler",
    storageBucket: "congregation-scheduler.firebasestorage.app",
    messagingSenderId: "727512095380",
    appId: "1:727512095380:web:d05d11348600576b5d3281"
  };

  // Initialize Firebase (will only initialize if config is valid)
  let firebaseInitialized = false;
  let db = null;
  let auth = null;

  function initializeFirebase() {
    if (firebaseInitialized) return true;
    
    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK not loaded. Add Firebase scripts to index.html');
      return false;
    }

    // Check if config is set
    if (firebaseConfig.apiKey === 'YOUR_API_KEY_HERE') {
      console.warn('⚠️ Firebase not configured. Using localStorage fallback mode.');
      console.warn('👉 Update firebase-config.js with your Firebase project credentials');
      return false;
    }

    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();
      firebaseInitialized = true;
      console.log('✅ Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      return false;
    }
  }

  // ============================================
  // FIRESTORE API WRAPPER
  // ============================================
  window.FirebaseAPI = {
    // Check if Firebase is ready
    isReady() {
      return firebaseInitialized && db !== null;
    },

    // Initialize Firebase
    init() {
      return initializeFirebase();
    },

    // Get all documents from a collection
    async getAll(collection, queryFn = null) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        let query = db.collection(collection);
        
        // Apply custom query if provided
        if (queryFn && typeof queryFn === 'function') {
          query = queryFn(query);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore Timestamps to JS Date
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        }));
      } catch (error) {
        console.error(`Error getting ${collection}:`, error);
        throw error;
      }
    },

    // Get single document by ID
    async getOne(collection, id) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) return null;
        
        return {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        };
      } catch (error) {
        console.error(`Error getting ${collection}/${id}:`, error);
        throw error;
      }
    },

    // Query documents with filters
    async query(collection, filters = []) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        let query = db.collection(collection);
        
        // Apply filters: [['field', '==', 'value'], ['field2', '>', 10]]
        filters.forEach(([field, operator, value]) => {
          query = query.where(field, operator, value);
        });

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        }));
      } catch (error) {
        console.error(`Error querying ${collection}:`, error);
        throw error;
      }
    },

    // Add new document
    async add(collection, data) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        const docRef = await db.collection(collection).add({
          ...data,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return {
          id: docRef.id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      } catch (error) {
        console.error(`Error adding to ${collection}:`, error);
        throw error;
      }
    },

    // Update existing document
    async update(collection, id, data) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        await db.collection(collection).doc(id).update({
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { id, ...data, updatedAt: new Date() };
      } catch (error) {
        console.error(`Error updating ${collection}/${id}:`, error);
        throw error;
      }
    },

    // Set document (create or overwrite)
    async set(collection, id, data) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        await db.collection(collection).doc(id).set({
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: false });

        return { id, ...data };
      } catch (error) {
        console.error(`Error setting ${collection}/${id}:`, error);
        throw error;
      }
    },

    // Delete document
    async delete(collection, id) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        await db.collection(collection).doc(id).delete();
        return { success: true, id };
      } catch (error) {
        console.error(`Error deleting ${collection}/${id}:`, error);
        throw error;
      }
    },

    // Real-time listener for collection changes
    onSnapshot(collection, callback, errorCallback = null, queryFn = null) {
      if (!this.isReady()) {
        console.error('Firebase not initialized - cannot set up listener');
        return () => {}; // Return empty unsubscribe function
      }

      try {
        let query = db.collection(collection);
        
        // Apply custom query if provided
        if (queryFn && typeof queryFn === 'function') {
          query = queryFn(query);
        }

        const unsubscribe = query.onSnapshot(
          snapshot => {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
              updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
            }));
            callback(data);
          },
          error => {
            console.error(`Snapshot error for ${collection}:`, error);
            if (errorCallback) errorCallback(error);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error(`Error setting up listener for ${collection}:`, error);
        return () => {};
      }
    },

    // Batch write operations
    async batch(operations) {
      if (!this.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        const batch = db.batch();

        operations.forEach(({ type, collection, id, data }) => {
          const ref = db.collection(collection).doc(id);
          
          switch(type) {
            case 'set':
              batch.set(ref, { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
              break;
            case 'update':
              batch.update(ref, { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
              break;
            case 'delete':
              batch.delete(ref);
              break;
          }
        });

        await batch.commit();
        return { success: true, count: operations.length };
      } catch (error) {
        console.error('Batch operation failed:', error);
        throw error;
      }
    }
  };

  // ============================================
  // FIREBASE AUTHENTICATION WRAPPER
  // ============================================
  window.FirebaseAuth = {
    // Get current user
    getCurrentUser() {
      if (!auth) return null;
      return auth.currentUser;
    },

    // Sign in with email and password
    async signIn(email, password) {
      if (!auth) throw new Error('Firebase Auth not initialized');
      
      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
      } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
      }
    },

    // Create user with email and password
    async createUser(email, password) {
      if (!auth) throw new Error('Firebase Auth not initialized');
      
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
      } catch (error) {
        console.error('Create user error:', error);
        return { success: false, error: error.message };
      }
    },

    // Sign out
    async signOut() {
      if (!auth) throw new Error('Firebase Auth not initialized');
      
      try {
        await auth.signOut();
        return { success: true };
      } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
      }
    },

    // Listen for auth state changes
    onAuthStateChanged(callback) {
      if (!auth) {
        console.error('Firebase Auth not initialized');
        return () => {};
      }
      
      return auth.onAuthStateChanged(callback);
    },

    // Get ID token for API calls
    async getIdToken() {
      const user = this.getCurrentUser();
      if (!user) return null;
      
      try {
        return await user.getIdToken();
      } catch (error) {
        console.error('Error getting ID token:', error);
        return null;
      }
    }
  };

  // ============================================
  // MIGRATION HELPERS
  // ============================================
  window.FirebaseMigration = {
    // Migrate data from localStorage to Firestore
    async migrateFromLocalStorage() {
      if (!FirebaseAPI.isReady()) {
        throw new Error('Firebase not initialized');
      }

      const results = {
        locations: 0,
        volunteers: 0,
        bookings: 0,
        schedules: 0
      };

      try {
        // Migrate locations
        const locations = JSON.parse(localStorage.getItem('cvsa_locations') || '[]');
        for (const loc of locations) {
          await FirebaseAPI.add('locations', loc);
          results.locations++;
        }

        // Migrate volunteers
        const volunteers = JSON.parse(localStorage.getItem('cvsa_volunteers') || '[]');
        for (const vol of volunteers) {
          await FirebaseAPI.add('volunteers', vol);
          results.volunteers++;
        }

        // Migrate bookings
        const bookings = JSON.parse(localStorage.getItem('cvsa_bookings') || '[]');
        for (const booking of bookings) {
          await FirebaseAPI.add('bookings', booking);
          results.bookings++;
        }

        // Migrate schedules
        const schedules = JSON.parse(localStorage.getItem('cvsa_location_slots') || '[]');
        for (const schedule of schedules) {
          await FirebaseAPI.add('schedules', schedule);
          results.schedules++;
        }

        console.log('✅ Migration complete:', results);
        return results;
      } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
      }
    },

    // Export Firestore data to JSON (backup)
    async exportData() {
      if (!FirebaseAPI.isReady()) {
        throw new Error('Firebase not initialized');
      }

      try {
        const data = {
          locations: await FirebaseAPI.getAll('locations'),
          volunteers: await FirebaseAPI.getAll('volunteers'),
          bookings: await FirebaseAPI.getAll('bookings'),
          schedules: await FirebaseAPI.getAll('schedules'),
          exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cvsa-firebase-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        return data;
      } catch (error) {
        console.error('Export failed:', error);
        throw error;
      }
    }
  };

  // ============================================
  // AUTO-INITIALIZATION
  // ============================================
  function autoInit() {
    // Wait for Firebase SDK to load
    if (typeof firebase === 'undefined') {
      setTimeout(autoInit, 100);
      return;
    }

    const initialized = initializeFirebase();
    
    if (initialized) {
      console.log('🔥 Firebase ready for use');
      document.dispatchEvent(new CustomEvent('cvsa:firebase:ready'));
    } else {
      console.log('📦 Running in localStorage mode (Firebase not configured)');
      document.dispatchEvent(new CustomEvent('cvsa:firebase:fallback'));
    }
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
