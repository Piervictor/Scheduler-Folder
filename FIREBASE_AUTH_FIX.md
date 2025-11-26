# 🔐 Firebase Authentication Setup

## Issue: Permission Denied

The migration failed because Firebase security rules require authentication. Let's fix this:

---

## Quick Fix: Create Admin User in Firebase Authentication

### Step 1: Create Admin User in Firebase Console

1. Go to **Firebase Console** → **Authentication** → **Users** tab
2. Click **Add user**
3. Enter:
   - **Email:** `admin@example.com`
   - **Password:** `admin123` (you can change this later)
4. Click **Add user**
5. **IMPORTANT:** Copy the **User UID** (looks like: `abc123xyz456...`)

### Step 2: Link Admin User to Firestore

1. Go to **Firestore Database** → **Data** tab
2. Click on the `users` collection (you created this earlier)
3. Find your admin user document
4. **Edit the Document ID** to match the User UID from Step 1
   - Click the document
   - Change the document ID to the UID you copied

OR create a new one:
1. Click **+ Add document** in `users` collection
2. **Document ID:** Paste the User UID
3. Add fields:
   - `username` (string): `admin`
   - `role` (string): `admin`
   - `email` (string): `admin@example.com`
   - `displayName` (string): `Administrator`

### Step 3: Login and Migrate

Now in your browser console, run this:

```javascript
// Login to Firebase first
await firebase.auth().signInWithEmailAndPassword('admin@example.com', 'admin123');
console.log('✅ Logged in as:', firebase.auth().currentUser.email);

// Now run the migration
(async () => {
  console.log('🚀 Starting Firebase migration...');
  const keys = ['cvsa_locations', 'cvsa_volunteers', 'cvsa_bookings', 'cvsa_location_slots'];
  const collections = ['locations', 'volunteers', 'bookings', 'schedules'];
  
  for (let i = 0; i < keys.length; i++) {
    const data = JSON.parse(localStorage.getItem(keys[i]) || '[]');
    console.log(`📦 Migrating ${keys[i]}... (${data.length} items)`);
    
    for (const item of data) {
      try {
        if (item.id) {
          await FirebaseAPI.set(collections[i], item.id, item);
        } else {
          await FirebaseAPI.add(collections[i], item);
        }
      } catch (err) {
        console.warn(`⚠️ Skipped item:`, err.message);
      }
    }
    console.log(`✅ ${keys[i]} migrated!`);
  }
  
  console.log('🎉 All data migrated to Firebase!');
})();
```

---

## Alternative: Temporarily Open Security Rules (Not Recommended for Production)

If you just want to test quickly, you can temporarily relax the rules:

1. Go to **Firestore Database** → **Rules** tab
2. **Temporarily replace** with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // TEMPORARY - allows all access
    }
  }
}
```

3. Click **Publish**
4. Run the migration script (without login)
5. **IMPORTANT:** Restore the secure rules immediately after migration!

---

## Which method should you use?

**Method 1 (Recommended):** Create admin user and login - this is the proper way  
**Method 2 (Quick test):** Temporarily open rules - only for testing, must revert immediately

Let me know which you prefer and I'll guide you through it!
