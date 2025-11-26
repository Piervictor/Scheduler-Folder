/**
 * migrate-to-firebase.js
 * One-time migration script to copy localStorage data to Firestore
 * Run this in the browser console after Firebase is configured
 */

(async function migrateToFirebase() {
  'use strict';

  console.log('🚀 Starting Firebase migration...');

  // Check if Firebase is ready
  if (!FirebaseAPI || !FirebaseAPI.isReady()) {
    console.error('❌ Firebase not initialized. Please configure Firebase first.');
    return;
  }

  const results = {
    locations: { migrated: 0, skipped: 0 },
    volunteers: { migrated: 0, skipped: 0 },
    bookings: { migrated: 0, skipped: 0 },
    schedules: { migrated: 0, skipped: 0 }
  };

  try {
    // Migrate locations
    console.log('📍 Migrating locations...');
    const locations = JSON.parse(localStorage.getItem('cvsa_locations') || '[]');
    for (const loc of locations) {
      try {
        await FirebaseAPI.add('locations', {
          ...loc,
          migratedFrom: 'localStorage',
          migratedAt: new Date()
        });
        results.locations.migrated++;
        console.log(`  ✓ Migrated location: ${loc.name}`);
      } catch (err) {
        console.warn(`  ⚠️ Skipped location ${loc.name}:`, err.message);
        results.locations.skipped++;
      }
    }

    // Migrate volunteers
    console.log('👥 Migrating volunteers...');
    const volunteers = JSON.parse(localStorage.getItem('cvsa_volunteers') || '[]');
    for (const vol of volunteers) {
      try {
        await FirebaseAPI.add('volunteers', {
          ...vol,
          migratedFrom: 'localStorage',
          migratedAt: new Date()
        });
        results.volunteers.migrated++;
        console.log(`  ✓ Migrated volunteer: ${vol.name}`);
      } catch (err) {
        console.warn(`  ⚠️ Skipped volunteer ${vol.name}:`, err.message);
        results.volunteers.skipped++;
      }
    }

    // Migrate bookings
    console.log('📅 Migrating bookings...');
    const bookings = JSON.parse(localStorage.getItem('cvsa_bookings') || '[]');
    for (const booking of bookings) {
      try {
        await FirebaseAPI.add('bookings', {
          ...booking,
          migratedFrom: 'localStorage',
          migratedAt: new Date()
        });
        results.bookings.migrated++;
        console.log(`  ✓ Migrated booking: ${booking.displayName} - ${booking.date}`);
      } catch (err) {
        console.warn(`  ⚠️ Skipped booking:`, err.message);
        results.bookings.skipped++;
      }
    }

    // Migrate schedules
    console.log('⏰ Migrating schedules...');
    const schedules = JSON.parse(localStorage.getItem('cvsa_location_slots') || '[]');
    for (const schedule of schedules) {
      try {
        await FirebaseAPI.add('schedules', {
          ...schedule,
          migratedFrom: 'localStorage',
          migratedAt: new Date()
        });
        results.schedules.migrated++;
        console.log(`  ✓ Migrated schedule`);
      } catch (err) {
        console.warn(`  ⚠️ Skipped schedule:`, err.message);
        results.schedules.skipped++;
      }
    }

    console.log('\n✅ Migration complete!');
    console.log('📊 Results:', results);
    console.log('\n💡 Your localStorage data is still intact. After verifying Firebase works, you can clear localStorage.');
    
    return results;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
})();
