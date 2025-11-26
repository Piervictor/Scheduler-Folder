/**
 * test-data-init.js
 * Initializes test bookings for demonstrating cancellation policy and congregation filtering
 * Run this once after volunteers are loaded to create realistic test scenarios
 */

(function() {
  'use strict';

  function initTestBookings() {
    // Wait for page load and other modules
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTestBookings);
      return;
    }

    // Check if test data already initialized
    const testDataFlag = localStorage.getItem('cvsa_test_data_initialized');
    if (testDataFlag === 'true') {
      console.log('Test data already initialized. Clear localStorage to reinitialize.');
      return;
    }

    const LS_KEYS = {
      BOOKINGS: 'cvsa_bookings',
      VOLUNTEERS: 'cvsa_volunteers',
      LOCATIONS: 'cvsa_locations'
    };

    // Load existing data
    const volunteers = JSON.parse(localStorage.getItem(LS_KEYS.VOLUNTEERS) || '[]');
    const locations = JSON.parse(localStorage.getItem(LS_KEYS.LOCATIONS) || '[]');
    
    if (!volunteers.length || !locations.length) {
      console.log('Waiting for volunteers and locations to be initialized...');
      setTimeout(initTestBookings, 500);
      return;
    }

    // Helper to format date as YYYY-MM-DD
    function formatDate(date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // Helper to generate booking ID
    function uid(prefix = '') {
      return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    // Time slots definition (matching volunteer-dashboard.js)
    const TIMESLOTS = [
      { id: '6-8am', label: '6:00 AM - 8:00 AM', startHour: 6, endHour: 8 },
      { id: '8-10am', label: '8:00 AM - 10:00 AM', startHour: 8, endHour: 10 },
      { id: '10-12pm', label: '10:00 AM - 12:00 PM', startHour: 10, endHour: 12 },
      { id: '12-2pm', label: '12:00 PM - 2:00 PM', startHour: 12, endHour: 14 },
      { id: '2-4pm', label: '2:00 PM - 4:00 PM', startHour: 14, endHour: 16 },
      { id: '4-6pm', label: '4:00 PM - 6:00 PM', startHour: 16, endHour: 18 },
      { id: '6-8pm', label: '6:00 PM - 8:00 PM', startHour: 18, endHour: 20 }
    ];

    const testBookings = [];
    const now = new Date();
    const today = formatDate(now);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);
    const nextWeekStr = formatDate(nextWeek);

    // Find specific volunteers
    const mariaSantos = volunteers.find(v => v.firstName === 'Maria' && v.lastName === 'Santos');
    const joseReyes = volunteers.find(v => v.firstName === 'Jose' && v.lastName === 'Reyes');
    const anaCruz = volunteers.find(v => v.firstName === 'Ana' && v.lastName === 'Cruz');
    const pedroGarcia = volunteers.find(v => v.firstName === 'Pedro' && v.lastName === 'Garcia');
    const lindaFlores = volunteers.find(v => v.firstName === 'Linda' && v.lastName === 'Flores');

    // Find locations
    const taytayMarket = locations.find(l => l.name === 'Taytay Market') || locations[0];
    const angonoPlaza = locations.find(l => l.name === 'Angono Plaza') || locations[1];
    const pritilEntrance = locations.find(l => l.name === 'Pritil Entrance') || locations[3];

    if (!taytayMarket || !angonoPlaza) {
      console.error('Required locations not found');
      return;
    }

    // TEST CASE 1: Booking for TODAY in 3 hours (should NOT be cancellable - too close)
    const currentHour = now.getHours();
    let futureSlot = TIMESLOTS.find(slot => slot.startHour > currentHour + 2);
    if (!futureSlot) futureSlot = TIMESLOTS[TIMESLOTS.length - 1]; // Use last slot if all passed

    if (mariaSantos) {
      testBookings.push({
        id: uid('booking-test-'),
        username: mariaSantos.email,
        displayName: mariaSantos.name,
        volunteerId: mariaSantos.id,
        role: 'volunteer',
        locationId: taytayMarket.id,
        locationName: taytayMarket.name,
        date: today,
        slotId: futureSlot.id,
        slotLabel: futureSlot.label,
        startHour: futureSlot.startHour,
        endHour: futureSlot.endHour,
        status: 'assigned',
        createdAt: Date.now() - (2 * 60 * 60 * 1000) // Booked 2 hours ago
      });
    }

    // TEST CASE 2: Booking for TODAY in 10 minutes (should NOT be cancellable)
    let veryCloseSlot = TIMESLOTS.find(slot => slot.startHour === currentHour);
    if (!veryCloseSlot) veryCloseSlot = TIMESLOTS[0];

    if (joseReyes) {
      testBookings.push({
        id: uid('booking-test-'),
        username: joseReyes.email,
        displayName: joseReyes.name,
        volunteerId: joseReyes.id,
        role: 'volunteer',
        locationId: taytayMarket.id,
        locationName: taytayMarket.name,
        date: today,
        slotId: veryCloseSlot.id,
        slotLabel: veryCloseSlot.label,
        startHour: veryCloseSlot.startHour,
        endHour: veryCloseSlot.endHour,
        status: 'assigned',
        createdAt: Date.now() - (10 * 60 * 1000) // Booked 10 minutes ago
      });
    }

    // TEST CASE 3: Booking for TOMORROW (should be cancellable)
    if (anaCruz) {
      testBookings.push({
        id: uid('booking-test-'),
        username: anaCruz.email,
        displayName: anaCruz.name,
        volunteerId: anaCruz.id,
        role: 'volunteer',
        locationId: angonoPlaza.id,
        locationName: angonoPlaza.name,
        date: tomorrowStr,
        slotId: '10-12pm',
        slotLabel: '10:00 AM - 12:00 PM',
        startHour: 10,
        endHour: 12,
        status: 'assigned',
        createdAt: Date.now() - (24 * 60 * 60 * 1000) // Booked 1 day ago
      });
    }

    // TEST CASE 4: Multiple bookings for Taytay Congregation volunteers (Elder should see these)
    if (mariaSantos) {
      testBookings.push({
        id: uid('booking-test-'),
        username: mariaSantos.email,
        displayName: mariaSantos.name,
        volunteerId: mariaSantos.id,
        role: 'volunteer',
        locationId: angonoPlaza.id,
        locationName: angonoPlaza.name,
        date: nextWeekStr,
        slotId: '6-8am',
        slotLabel: '6:00 AM - 8:00 AM',
        startHour: 6,
        endHour: 8,
        status: 'assigned',
        createdAt: Date.now() - (3 * 24 * 60 * 60 * 1000)
      });
    }

    if (joseReyes) {
      testBookings.push({
        id: uid('booking-test-'),
        username: joseReyes.email,
        displayName: joseReyes.name,
        volunteerId: joseReyes.id,
        role: 'volunteer',
        locationId: taytayMarket.id,
        locationName: taytayMarket.name,
        date: nextWeekStr,
        slotId: '2-4pm',
        slotLabel: '2:00 PM - 4:00 PM',
        startHour: 14,
        endHour: 16,
        status: 'checked-in',
        createdAt: Date.now() - (5 * 24 * 60 * 60 * 1000)
      });
    }

    // TEST CASE 5: Bookings for Angono Congregation (Elder should NOT see these)
    if (pedroGarcia) {
      testBookings.push({
        id: uid('booking-test-'),
        username: pedroGarcia.email,
        displayName: pedroGarcia.name,
        volunteerId: pedroGarcia.id,
        role: 'volunteer',
        locationId: angonoPlaza.id,
        locationName: angonoPlaza.name,
        date: tomorrowStr,
        slotId: '8-10am',
        slotLabel: '8:00 AM - 10:00 AM',
        startHour: 8,
        endHour: 10,
        status: 'assigned',
        createdAt: Date.now() - (12 * 60 * 60 * 1000)
      });
    }

    if (lindaFlores) {
      testBookings.push({
        id: uid('booking-test-'),
        username: lindaFlores.email,
        displayName: lindaFlores.name,
        volunteerId: lindaFlores.id,
        role: 'volunteer',
        locationId: pritilEntrance.id,
        locationName: pritilEntrance.name,
        date: nextWeekStr,
        slotId: '12-2pm',
        slotLabel: '12:00 PM - 2:00 PM',
        startHour: 12,
        endHour: 14,
        status: 'assigned',
        createdAt: Date.now() - (2 * 24 * 60 * 60 * 1000)
      });
    }

    // TEST CASE 6: Past booking (for history)
    const pastDate = new Date(now); pastDate.setDate(now.getDate() - 7);
    const pastDateStr = formatDate(pastDate);
    
    if (mariaSantos) {
      testBookings.push({
        id: uid('booking-test-'),
        username: mariaSantos.email,
        displayName: mariaSantos.name,
        volunteerId: mariaSantos.id,
        role: 'volunteer',
        locationId: taytayMarket.id,
        locationName: taytayMarket.name,
        date: pastDateStr,
        slotId: '10-12pm',
        slotLabel: '10:00 AM - 12:00 PM',
        startHour: 10,
        endHour: 12,
        status: 'checked-in',
        createdAt: Date.now() - (8 * 24 * 60 * 60 * 1000)
      });
    }

    // Save test bookings
    try {
      localStorage.setItem(LS_KEYS.BOOKINGS, JSON.stringify(testBookings));
      localStorage.setItem('cvsa_test_data_initialized', 'true');
      console.log(`✅ Test data initialized successfully!`);
      console.log(`   - Created ${testBookings.length} test bookings`);
      console.log(`   - ${volunteers.length} volunteers loaded (${volunteers.filter(v => v.congregation === 'Taytay Congregation').length} in Taytay Congregation)`);
      console.log(`\n📋 Test Scenarios Ready:`);
      console.log(`   1. Login as 'volunteer/volunteer' to test cancellation`);
      console.log(`   2. Login as 'elder/elder' to see only Taytay Congregation data`);
      console.log(`\n⚠️  To reset test data: Clear browser localStorage and refresh`);
    } catch (err) {
      console.error('Failed to save test bookings:', err);
    }
  }

  // Auto-initialize when module loads
  initTestBookings();
})();
