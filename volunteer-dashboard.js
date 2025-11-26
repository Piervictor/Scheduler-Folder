/**
 * volunteer-dashboard.js
 * Congregation Volunteer Scheduler — Volunteer Dashboard interactions (client-side)
 *
 * Features implemented:
 * - Shows 5 location cards after login (populates #location-cards)
 * - Clicking a location opens a modal showing 7 defined time slots for a selected date
 * - Each slot displays: time, current volunteers assigned, capacity, and volunteer names
 * - Users can book an available time slot (prevents duplicates & enforces capacity)
 * - Confirmation shown after booking (modal)
 * - "My Assignments" view lists user's bookings and allows cancellations
 * - Cancelling a booking enforces 30-minute notice before the slot start
 * - All data persists in localStorage (bookings + optional custom locations)
 * - Note displayed: "Reservations may be cancelled up to 30 minutes prior to duty"
 *
 * Integration notes:
 * - This script expects your page to include (recommended IDs/classes):
 *    - A container with id="location-cards" to render the location cards (existing template has this)
 *    - A section with id="volunteer-dashboard" (to show/hide)
 *    - A login/session entry in localStorage under the key used by your auth (default 'cvsa_session')
 *    - Optionally: modal elements with ids: modal-backdrop, modal-title, modal-body, modal-confirm, modal-cancel
 *      If modal elements are not found, the script falls back to window.confirm / alert for confirmations.
 *
 * - Persisted keys:
 *    - cvsa_locations  (optional, can store custom locations)
 *    - cvsa_bookings   (stores booking array)
 *
 * Usage:
 *   Include after your HTML (after auth.js if present):
 *     <script src="volunteer-dashboard.js"></script>
 *
 * Security note:
 * - This is a client-side demo. For production, move booking/auth enforcement to a server API and validate on the server.
 */

/* -------------------------
   Config & Defaults
   ------------------------- */
const VDB = (function () {
  const LS_KEYS = {
    LOCATIONS: 'cvsa_locations',
    BOOKINGS: 'cvsa_bookings',
    SESSION: 'cvsa_session' // used by auth.js demo
  };

  // Locations and time slots are now managed by AdminLocations and AdminSchedules modules
  // We'll load them dynamically from those modules instead of using hardcoded constants

  /* -------------------------
     LocalStorage helpers
     ------------------------- */
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('LocalStorage save error', err);
    }
  }
  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('LocalStorage load error', err);
      return null;
    }
  }

  /* -------------------------
     Load locations and time slots from Admin modules
     ------------------------- */
  function getLocations() {
    // Try to get from AdminLocations module first (admin-managed locations)
    if (window.AdminLocations && typeof window.AdminLocations.getLocations === 'function') {
      const locs = window.AdminLocations.getLocations();
      console.log('VDB: Loaded locations from AdminLocations:', locs);
      return locs;
    }
    // Fallback to localStorage if AdminLocations not loaded yet
    const stored = load(LS_KEYS.LOCATIONS);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      console.log('VDB: Loaded locations from localStorage:', stored);
      return stored;
    }
    // Last resort: return empty array (will be populated by admin)
    console.warn('VDB: No locations found. Please add locations in Admin > Locations.');
    return [];
  }

  function getSlotsForLocation(locationId) {
    // Try to get per-location time slots from AdminSchedules module
    if (window.AdminSchedules && typeof window.AdminSchedules.getSlotsForLocation === 'function') {
      const slots = window.AdminSchedules.getSlotsForLocation(locationId);
      return slots;
    }
    // Fallback to default 7 slots if AdminSchedules not loaded
    console.warn('VDB: AdminSchedules not available, using fallback slots for location:', locationId);
    return [
      { id: '6-8am', label: '6:00 AM - 8:00 AM', startHour: 6, endHour: 8 },
      { id: '8-10am', label: '8:00 AM - 10:00 AM', startHour: 8, endHour: 10 },
      { id: '10-12pm', label: '10:00 AM - 12:00 PM', startHour: 10, endHour: 12 },
      { id: '12-2pm', label: '12:00 PM - 2:00 PM', startHour: 12, endHour: 14 },
      { id: '2-4pm', label: '2:00 PM - 4:00 PM', startHour: 14, endHour: 16 },
      { id: '4-6pm', label: '4:00 PM - 6:00 PM', startHour: 16, endHour: 18 },
      { id: '6-8pm', label: '6:00 PM - 8:00 PM', startHour: 18, endHour: 20 }
    ];
  }

  /* -------------------------
     Bookings model
     booking shape:
     {
       id: string,
       username: string,
       displayName: string,
       role: string,
       locationId: string,
       locationName: string,
       date: 'YYYY-MM-DD',
       slotId: '6-8am',
       slotLabel: '6:00 AM - 8:00 AM',
       createdAt: timestamp
     }
     ------------------------- */
  function loadBookings() {
    return load(LS_KEYS.BOOKINGS) || [];
  }
  function saveBookings(list) {
    save(LS_KEYS.BOOKINGS, list);
  }
  function addBooking(booking) {
    const all = loadBookings();
    all.push(booking);
    saveBookings(all);
  }
  function removeBookingById(id) {
    const all = loadBookings().filter(b => b.id !== id);
    saveBookings(all);
    return all;
  }

  /* -------------------------
     Helpers: session & user
     ------------------------- */
  function currentSession() {
    return load(LS_KEYS.SESSION) || null;
  }
  function currentUser() {
    const s = currentSession();
    if (!s) return null;
    return { username: s.username, displayName: s.displayName || s.username, role: s.role };
  }

  /* -------------------------
     Utility helpers
     ------------------------- */
  function uid(prefix = '') {
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function formatDate(d) {
    // returns YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function parseDateStr(dateStr) {
    // create Date at local midnight
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function slotStartDateTime(dateStr, slot) {
    const d = parseDateStr(dateStr);
    d.setHours(slot.startHour, 0, 0, 0);
    return d;
  }

  /* -------------------------
     UI: modal helper (uses existing modal elements when present)
     ------------------------- */
  function findModalEls() {
    const backdrop = document.getElementById('modal-backdrop');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const confirm = document.getElementById('modal-confirm');
    const cancel = document.getElementById('modal-cancel');
    return { backdrop, title, body, confirm, cancel };
  }

  function openModal({ title = '', content = '', showConfirm = false, confirmText = 'Confirm', onConfirm = null, onClose = null }) {
    const { backdrop, title: mtitle, body: mbody, confirm, cancel } = findModalEls();

    if (backdrop && mtitle && mbody) {
      mtitle.innerHTML = title;
      if (typeof content === 'string') mbody.innerHTML = content;
      else {
        // DOM node
        mbody.innerHTML = '';
        mbody.appendChild(content);
      }

      if (confirm) {
        confirm.textContent = confirmText;
        confirm.style.display = showConfirm ? 'inline-block' : 'none';
        confirm.onclick = () => {
          if (onConfirm) onConfirm();
          closeModal();
        };
      }
      if (cancel) {
        cancel.style.display = 'inline-block';
        cancel.onclick = closeModal;
      }
      backdrop.style.display = 'flex';
      backdrop.setAttribute('aria-hidden', 'false');

      function closeModal() {
        backdrop.style.display = 'none';
        backdrop.setAttribute('aria-hidden', 'true');
        if (confirm) { confirm.onclick = null; }
        if (cancel) { cancel.onclick = null; }
        if (onClose) onClose();
      }

      // allow clicking backdrop to close (not if clicking inside modal)
      backdrop.addEventListener('click', function onBackdrop(e) {
        if (e.target === backdrop) {
          closeModal();
          backdrop.removeEventListener('click', onBackdrop);
        }
      });

      return { close: () => { backdrop.style.display = 'none'; } };
    }

    // fallback: use window.confirm/alert
    if (showConfirm) {
      if (window.confirm((title ? (title + '\n\n') : '') + (typeof content === 'string' ? content.replace(/<[^>]+>/g, '') : ''))) {
        if (onConfirm) onConfirm();
      }
      if (onClose) onClose();
      return null;
    } else {
      window.alert((title ? (title + '\n\n') : '') + (typeof content === 'string' ? content.replace(/<[^>]+>/g, '') : ''));
      if (onClose) onClose();
    }
  }

  function showToast(message, timeout = 2500) {
    // simple transient modal-like toast (uses openModal briefly)
    openModal({
      title: '',
      content: `<div style="padding:0.25rem 0.5rem; font-weight:600;">${escapeHtml(message)}</div>`,
      showConfirm: false,
      onClose: null
    });
    // auto-close after timeout
    const { backdrop } = findModalEls();
    if (backdrop) {
      setTimeout(() => { backdrop.style.display = 'none'; }, timeout);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* -------------------------
     Rendering: location cards
     ------------------------- */
  function renderLocationCards() {
    const container = document.getElementById('location-cards');
    if (!container) {
      console.warn('No #location-cards container found in DOM.');
      return;
    }
    const locations = getLocations();
    container.innerHTML = ''; // clear

    locations.forEach(loc => {
      const card = document.createElement('article');
      card.className = 'card location-card';
      card.setAttribute('data-location-id', loc.id);
      card.setAttribute('role', 'button');
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <h3>${escapeHtml(loc.name)}</h3>
        <div class="location-meta">${escapeHtml(loc.address)} · Required per slot: <strong>${loc.slotCapacity}</strong></div>
        <div class="small">Next shifts for today:</div>
        <ul class="small" id="summary-${loc.id}">
          ${getSlotsForLocation(loc.id).slice(0, 2).map(ts => `<li>${escapeHtml(ts.id)} — loading...</li>`).join('')}
        </ul>
        <div class="btn-row" style="margin-top:0.5rem;">
          <button class="view-location" data-location-id="${loc.id}">View slots</button>
          <button class="muted-btn view-summary" data-location-id="${loc.id}">Summary</button>
        </div>
      `;
      container.appendChild(card);

      // Event: clicking card or View slots opens modal
      card.addEventListener('click', (e) => {
        // avoid duplicate triggers if click on inner button; check if target is button then let button handle
        if (e.target.closest('button')) return;
        openLocationModal(loc.id);
      });
      card.querySelector('.view-location').addEventListener('click', (ev) => {
        ev.stopPropagation();
        openLocationModal(loc.id);
      });
      card.querySelector('.view-summary').addEventListener('click', (ev) => {
        ev.stopPropagation();
        const summaryEl = document.getElementById(`summary-${loc.id}`);
        if (summaryEl) {
          const todayStr = formatDate(new Date());
          const locationSlots = getSlotsForLocation(loc.id);
          const counts = locationSlots.slice(0,2).map(ts => {
            const assigned = getBookingsFor(loc.id, todayStr, ts.id);
            return `${escapeHtml(ts.id)} — ${assigned.length}/${loc.slotCapacity}`;
          });
          openModal({ title: `${loc.name} — Today summary`, content: `<div class="small">${counts.map(c => `<div>${c}</div>`).join('')}</div>` });
        }
      });
    });

    // After creating cards, update their summaries with real counts for today
    updateAllSummaries();
  }

  function updateAllSummaries() {
    const locations = getLocations();
    const todayStr = formatDate(new Date());
    locations.forEach(loc => {
      const summaryEl = document.getElementById(`summary-${loc.id}`);
      if (!summaryEl) return;
      const locationSlots = getSlotsForLocation(loc.id);
      summaryEl.innerHTML = locationSlots.slice(0, 2).map(ts => {
        const assigned = getBookingsFor(loc.id, todayStr, ts.id);
        return `<li>${escapeHtml(ts.id)} — ${assigned.length}/${loc.slotCapacity}</li>`;
      }).join('');
    });
  }

  /* -------------------------
     Booking queries
     ------------------------- */
  function getBookingsFor(locationId, dateStr, slotId) {
    const all = loadBookings();
    return all.filter(b => b.locationId === locationId && b.date === dateStr && b.slotId === slotId);
  }
  function getUserBookings(username) {
    const all = loadBookings();
    return all.filter(b => b.username && b.username.toLowerCase() === (username || '').toLowerCase());
  }
  function userHasBookingForSlot(username, locationId, dateStr, slotId) {
    const all = loadBookings();
    return all.some(b => b.username === username && b.locationId === locationId && b.date === dateStr && b.slotId === slotId);
  }

  /* -------------------------
     Location modal & slot rendering
     ------------------------- */
  function openLocationModal(locationId) {
    const locations = getLocations();
    const loc = locations.find(l => l.id === locationId);
    if (!loc) return showToast('Location not found.');

    // Get location-specific time slots
    const locationSlots = getSlotsForLocation(locationId);

    // Build modal content: header with date picker, timeslot grid
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gap = '0.6rem';

    // date picker row
    const dateRow = document.createElement('div');
    dateRow.style.display = 'flex';
    dateRow.style.gap = '0.5rem';
    dateRow.style.alignItems = 'center';

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = formatDate(new Date());
    dateInput.style.padding = '6px';
    dateInput.style.borderRadius = '6px';
    dateInput.style.border = '1px solid #e6eef7';

    const help = document.createElement('div');
    help.className = 'small muted';
    help.style.marginLeft = 'auto';
    help.textContent = 'Select date to view and book slots';

    dateRow.appendChild(dateInput);
    dateRow.appendChild(help);

    wrapper.appendChild(dateRow);

    // Add cancellation policy note
    const noteDiv = document.createElement('div');
    noteDiv.className = 'small muted';
    noteDiv.style.padding = '0.5rem';
    noteDiv.style.backgroundColor = '#f0f9ff';
    noteDiv.style.borderLeft = '3px solid #0284c7';
    noteDiv.style.borderRadius = '4px';
    noteDiv.style.marginTop = '0.5rem';
    noteDiv.style.marginBottom = '0.5rem';
    noteDiv.innerHTML = '<strong>📌 Note:</strong> Reservations may be cancelled up to 30 minutes prior to duty.';
    wrapper.appendChild(noteDiv);

    // timeslot grid
    const grid = document.createElement('div');
    grid.className = 'timeslot-grid';
    wrapper.appendChild(grid);

    function renderGridForDate(dateStr) {
      grid.innerHTML = '';
      locationSlots.forEach(ts => {
        const assigned = getBookingsFor(loc.id, dateStr, ts.id);
        const slotCard = document.createElement('div');
        slotCard.className = 'timeslot card';
        slotCard.style.display = 'flex';
        slotCard.style.flexDirection = 'column';
        slotCard.style.justifyContent = 'space-between';

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<div class="slot-title">${escapeHtml(ts.label)}</div><div class="slot-meta small">Start: ${ts.startHour}:00</div>`;
        slotCard.appendChild(header);

        // Body: capacity and names
        const body = document.createElement('div');
        body.className = 'small';
        body.style.marginTop = '0.4rem';
        body.innerHTML = `<div>Assigned: <strong>${assigned.length}</strong> / ${loc.slotCapacity}</div>
                          <div style="margin-top:6px;"><em>${assigned.length ? assigned.map(a => escapeHtml(a.displayName)).join(', ') : 'No volunteers yet'}</em></div>`;
        slotCard.appendChild(body);

        // Actions
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '0.5rem';
        actions.style.marginTop = '0.6rem';

        const bookBtn = document.createElement('button');
        bookBtn.className = 'success';
        bookBtn.textContent = 'Book';
        bookBtn.disabled = assigned.length >= loc.slotCapacity;

        // if user already booked this slot, change to "Booked" / cancel option
        const user = currentUser();
        const alreadyBooked = user ? userHasBookingForSlot(user.username, loc.id, dateStr, ts.id) : false;
        if (alreadyBooked) {
          bookBtn.textContent = 'Booked';
          bookBtn.className = 'muted-btn';
          bookBtn.disabled = true;
        }

        bookBtn.addEventListener('click', function () {
          if (!user) {
            openModal({ title: 'Not signed in', content: '<p>Please sign in to book a slot.</p>' });
            return;
          }
          if (assigned.length >= loc.slotCapacity) {
            openModal({ title: 'Full', content: '<p>This slot is already full.</p>' });
            return;
          }
          if (alreadyBooked) {
            openModal({ title: 'Already booked', content: '<p>You already have a booking for this slot.</p>' });
            return;
          }

          // Confirm booking flow
          openModal({
            title: `Confirm booking — ${loc.name}`,
            content: `<div class="small">Date: <strong>${escapeHtml(dateStr)}</strong></div>
                      <div class="small">Time: <strong>${escapeHtml(ts.label)}</strong></div>
                      <div class="small">Location: <strong>${escapeHtml(loc.name)}</strong></div>
                      <p style="margin-top:8px;">Do you want to book this slot?</p>`,
            showConfirm: true,
            confirmText: 'Book',
            onConfirm: () => {
              const booking = {
                id: uid('bk-'),
                username: user.username,
                displayName: user.displayName || user.username,
                role: user.role || 'volunteer',
                locationId: loc.id,
                locationName: loc.name,
                date: dateStr,
                slotId: ts.id,
                slotLabel: ts.label,
                createdAt: Date.now()
              };
              addBooking(booking);
              showToast('Booking confirmed');
              renderGridForDate(dateStr);
              updateAllSummaries();
              updateReservationSummary();
            }
          });
        });

        // Optionally allow user to cancel here if they are booked (but cancellation also available in My Assignments)
        if (user && alreadyBooked) {
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'danger';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', function () {
            // find the booking id for this user/loc/date/slot
            const all = loadBookings();
            const b = all.find(item => item.username === user.username && item.locationId === loc.id && item.date === dateStr && item.slotId === ts.id);
            if (!b) return showToast('Booking not found.');
            // cancellation rule: must be 30 minutes before slot start
            const slotStart = slotStartDateTime(dateStr, ts);
            const diffMs = slotStart - Date.now();
            if (diffMs < 30 * 60 * 1000) {
              openModal({ title: 'Too late to cancel', content: '<p>Reservations may be cancelled up to 30 minutes prior to duty.</p>' });
              return;
            }
            openModal({
              title: 'Confirm cancellation',
              content: `<p>Cancel your booking on <strong>${escapeHtml(dateStr)}</strong> for <strong>${escapeHtml(ts.label)}</strong> at ${escapeHtml(loc.name)}?</p>`,
              showConfirm: true,
              confirmText: 'Cancel booking',
              onConfirm: () => {
                removeBookingById(b.id);
                showToast('Booking canceled');
                renderGridForDate(dateStr);
                updateAllSummaries();
                updateReservationSummary();
              }
            });
          });
          actions.appendChild(cancelBtn);
        }

        actions.appendChild(bookBtn);
        slotCard.appendChild(actions);

        grid.appendChild(slotCard);
      });
    }

    // initial render
    renderGridForDate(dateInput.value);

    // update when date changes
    dateInput.addEventListener('change', () => renderGridForDate(dateInput.value));

    openModal({
      title: `${loc.name} — Time slots`,
      content: wrapper,
      showConfirm: false
    });
  }

  /* -------------------------
     Assignments view & cancellation
     ------------------------- */
  function renderMyAssignments() {
    const user = currentUser();
    if (!user) {
      openModal({ title: 'Not signed in', content: '<p>Please sign in to view your assignments.</p>' });
      return;
    }

    const bookings = getUserBookings(user.username).sort((a, b) => a.date.localeCompare(b.date) || a.slotId.localeCompare(b.slotId));
    const allLocations = getLocations();

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '1rem';
    container.style.maxHeight = '70vh';
    container.style.overflowY = 'auto';

    const noteDiv = document.createElement('div');
    noteDiv.className = 'small muted';
    noteDiv.style.padding = '0.75rem';
    noteDiv.style.backgroundColor = '#eff6ff';
    noteDiv.style.borderLeft = '4px solid #3b82f6';
    noteDiv.style.borderRadius = '6px';
    noteDiv.innerHTML = '<strong>📌 Reminder:</strong> Reservations may be cancelled up to 30 minutes before your shift.';
    container.appendChild(noteDiv);

    if (!bookings.length) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-state';
      emptyMsg.innerHTML = '<div class="empty-state-icon">🗓️</div><p>You have no reservations yet.</p>';
      container.appendChild(emptyMsg);
      openModal({ title: 'My Assignments', content: container, showConfirm: false });
      return;
    }

    const now = Date.now();
    const grouped = { upcoming: [], past: [] };

    bookings.forEach(b => {
      const locationSlots = getSlotsForLocation(b.locationId);
      const slot = locationSlots.find(s => s.id === b.slotId) || { label: b.slotLabel, startHour: 0 };
      const slotStart = slotStartDateTime(b.date, slot);
      const location = allLocations.find(loc => loc.id === b.locationId) || null;
      const bucket = slotStart >= now ? 'upcoming' : 'past';
      grouped[bucket].push({ booking: b, slot, slotStart, location });
    });

    container.appendChild(buildSummaryCard(grouped));
    container.appendChild(buildSection('Upcoming Reservations', grouped.upcoming, 'No upcoming reservations. Book a slot to see it here.', true));
    container.appendChild(buildSection('Past Reservations', grouped.past, 'No past reservations yet.', false));

    openModal({ title: 'My Assignments', content: container, showConfirm: false });

    function buildSummaryCard(groups) {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.display = 'grid';
      card.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
      card.style.gap = '0.5rem';
      card.innerHTML = `
        <div>
          <div class="small muted">Total Reservations</div>
          <div style="font-size:1.4rem; font-weight:700;">${groups.upcoming.length + groups.past.length}</div>
        </div>
        <div>
          <div class="small muted">Upcoming</div>
          <div style="font-size:1.2rem; font-weight:600; color:#047857;">${groups.upcoming.length}</div>
        </div>
        <div>
          <div class="small muted">Completed</div>
          <div style="font-size:1.2rem; font-weight:600; color:#0ea5e9;">${groups.past.length}</div>
        </div>
      `;
      return card;
    }

    function buildSection(title, list, emptyText, allowCancel) {
      const section = document.createElement('section');
      section.style.background = '#f9fafb';
      section.style.borderRadius = '10px';
      section.style.padding = '0.75rem';
      section.style.border = '1px solid #e5e7eb';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '0.5rem';
      header.innerHTML = `<h4 style="margin:0; font-size:1rem;">${escapeHtml(title)}</h4><span class="small muted">${list.length} item(s)</span>`;
      section.appendChild(header);

      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'small muted';
        empty.style.padding = '0.75rem';
        empty.style.textAlign = 'center';
        empty.textContent = emptyText;
        section.appendChild(empty);
        return section;
      }

      list.forEach(({ booking, slot, slotStart, location }) => {
        const card = document.createElement('article');
        card.className = 'card';
        card.style.borderLeft = `4px solid ${allowCancel ? '#10b981' : '#94a3b8'}`;
        card.style.marginBottom = '0.5rem';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:0.75rem; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:1rem;">${escapeHtml(booking.locationName)}</div>
              <div class="small muted">${escapeHtml(booking.date)} · ${escapeHtml(slot.label)}</div>
            </div>
            <div class="small" style="text-align:right;">
              <div>Booked ${new Date(booking.createdAt).toLocaleDateString()}</div>
              <div class="muted" style="font-size:0.75rem;">ID: ${escapeHtml(booking.id)}</div>
            </div>
          </div>
        `;

        const metaRow = document.createElement('div');
        metaRow.className = 'small';
        metaRow.style.marginTop = '0.5rem';
        metaRow.style.display = 'flex';
        metaRow.style.flexWrap = 'wrap';
        metaRow.style.gap = '0.5rem';
        metaRow.innerHTML = `
          <span style="background:#eef2ff; padding:0.25rem 0.5rem; border-radius:999px;">${slotStart.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          <span style="background:#fff7ed; padding:0.25rem 0.5rem; border-radius:999px;">${slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span style="background:#ecfccb; padding:0.25rem 0.5rem; border-radius:999px;">Capacity: ${escapeHtml(String(location ? location.slotCapacity : 'N/A'))}</span>
        `;
        card.appendChild(metaRow);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.flexWrap = 'wrap';
        actions.style.gap = '0.5rem';
        actions.style.marginTop = '0.75rem';

        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'muted-btn';
        detailsBtn.textContent = 'Details';
        detailsBtn.addEventListener('click', () => {
          openModal({
            title: 'Booking details',
            content: `<div class="small">Location: <strong>${escapeHtml(booking.locationName)}</strong></div>
                      <div class="small">Date: <strong>${escapeHtml(booking.date)}</strong></div>
                      <div class="small">Time: <strong>${escapeHtml(slot.label)}</strong></div>
                      <div class="small">Booked by: <strong>${escapeHtml(booking.displayName)}</strong></div>
                      <div class="small">Created: <strong>${new Date(booking.createdAt).toLocaleString()}</strong></div>`,
            showConfirm: false
          });
        });
        actions.appendChild(detailsBtn);

        if (allowCancel) {
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'danger';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', () => {
            const diffMs = slotStart - Date.now();
            if (diffMs < 30 * 60 * 1000) {
              openModal({ title: 'Too late to cancel', content: '<p>Reservations may be cancelled up to 30 minutes prior to duty.</p>' });
              return;
            }
            openModal({
              title: 'Confirm cancellation',
              content: `<p>Cancel your booking on <strong>${escapeHtml(booking.date)}</strong> for <strong>${escapeHtml(slot.label)}</strong> at ${escapeHtml(booking.locationName)}?</p>`,
              showConfirm: true,
              confirmText: 'Cancel booking',
              onConfirm: () => {
                removeBookingById(booking.id);
                showToast('Booking canceled');
                renderMyAssignments();
                updateAllSummaries();
                updateReservationSummary();
              }
            });
          });
          actions.appendChild(cancelBtn);
        }

        card.appendChild(actions);
        section.appendChild(card);
      });

      return section;
    }
  }

  /* -------------------------
     Update reservation summary
     ------------------------- */
  function updateReservationSummary() {
    const user = currentUser();
    const summaryCard = document.getElementById('my-reservations-summary');
    const summaryContent = document.getElementById('summary-content');
    
    console.log('📊 Updating reservation summary...', { user, hasCard: !!summaryCard, hasContent: !!summaryContent });
    
    if (!summaryCard || !summaryContent || !user) {
      console.log('⚠️ Cannot update summary - missing elements or user not logged in');
      return;
    }

    const bookings = getUserBookings(user.username)
      .filter(b => {
        // Show only upcoming bookings
        const locationSlots = getSlotsForLocation(b.locationId);
        const slot = locationSlots.find(s => s.id === b.slotId) || { startHour: 0 };
        const slotStart = slotStartDateTime(b.date, slot);
        return slotStart > Date.now();
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.slotId.localeCompare(b.slotId))
      .slice(0, 3); // Show max 3 upcoming

    if (bookings.length === 0) {
      console.log('ℹ️ No upcoming bookings - hiding summary card');
      summaryCard.style.display = 'none';
      return;
    }

    console.log('✅ Showing summary with', bookings.length, 'upcoming bookings');
    summaryCard.style.display = 'block';
    summaryContent.innerHTML = bookings.map(b => {
      const locationSlots = getSlotsForLocation(b.locationId);
      const slot = locationSlots.find(s => s.id === b.slotId) || { label: b.slotLabel };
      return `<div style="margin:0.25rem 0;">• <strong>${escapeHtml(b.locationName)}</strong> — ${escapeHtml(b.date)} at ${escapeHtml(slot.label)}</div>`;
    }).join('');

    // Add "and X more" if there are more bookings
    const total = getUserBookings(user.username).filter(b => {
      const locationSlots = getSlotsForLocation(b.locationId);
      const slot = locationSlots.find(s => s.id === b.slotId) || { startHour: 0 };
      const slotStart = slotStartDateTime(b.date, slot);
      return slotStart > Date.now();
    }).length;

    if (total > 3) {
      summaryContent.innerHTML += `<div style="margin-top:0.5rem; font-style:italic; color:#047857;">...and ${total - 3} more</div>`;
    }
  }

  /* -------------------------
     Show all locations summary modal
     ------------------------- */
  function showAllLocationsModal() {
    const locations = getLocations();
    const today = formatDate(new Date());
    
    const content = document.createElement('div');
    content.style.maxHeight = '60vh';
    content.style.overflowY = 'auto';
    
    locations.forEach(loc => {
      const locDiv = document.createElement('div');
      locDiv.style.marginBottom = '1.5rem';
      locDiv.style.padding = '1rem';
      locDiv.style.background = '#f9fafb';
      locDiv.style.borderRadius = '8px';
      locDiv.style.borderLeft = '4px solid #3b82f6';
      
      locDiv.innerHTML = `
        <h4 style="margin:0 0 0.5rem 0; color:#1f2937;">${escapeHtml(loc.name)}</h4>
        <div class="small muted" style="margin-bottom:0.75rem;">📍 ${escapeHtml(loc.address || 'N/A')} • Capacity: ${loc.slotCapacity} per slot</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:0.5rem;">
          ${getSlotsForLocation(loc.id).map(ts => {
            const assigned = getBookingsFor(loc.id, today, ts.id);
            const available = loc.slotCapacity - assigned.length;
            return `
              <div style="padding:0.4rem; background:#fff; border-radius:4px; text-align:center; border:1px solid #e5e7eb;">
                <div class="small" style="font-weight:600; margin-bottom:0.25rem;">${escapeHtml(ts.id)}</div>
                <div class="small" style="color:${available > 0 ? '#059669' : '#dc2626'};">
                  ${available > 0 ? `${available} left` : 'Full'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      
      content.appendChild(locDiv);
    });
    
    openModal({
      title: '📍 All Locations — Today\'s Availability',
      content: content,
      showConfirm: false
    });
  }

  /* -------------------------
     NEW: Step-by-step booking interface
     ------------------------- */
  let selectedLocation = null;
  let selectedDate = null;
  let selectedSlot = null;

  function initStepByStepBooking() {
    const locationSelect = document.getElementById('booking-location');
    const dateInput = document.getElementById('booking-date');
    const timeslotGrid = document.getElementById('timeslot-grid');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const locationInfo = document.getElementById('location-info');
    const selectionSummary = document.getElementById('booking-selection-summary');

    if (!locationSelect || !dateInput || !timeslotGrid || !confirmBtn) {
      console.warn('Step-by-step booking elements not found');
      return;
    }

    // Populate location dropdown from Admin-managed locations
    const locations = getLocations();
    console.log('📍 Loading locations for booking:', locations);
    
    if (!locations || locations.length === 0) {
      console.warn('⚠️ No locations available! Please add locations in Admin > Locations tab.');
      locationSelect.innerHTML = '<option value="">No locations available - Add in Admin panel</option>';
      return;
    }
    
    locationSelect.innerHTML = '<option value="">-- Select a location --</option>';
    locations.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc.id;
      option.textContent = `${loc.name} (${loc.address || ''})`;
      locationSelect.appendChild(option);
    });
    console.log(`✅ Loaded ${locations.length} locations into dropdown`);

    // Set minimum date to today
    dateInput.min = formatDate(new Date());

    // Step 1: Location selected
    locationSelect.addEventListener('change', function() {
      const locId = this.value;
      if (!locId) {
        selectedLocation = null;
        dateInput.disabled = true;
        dateInput.value = '';
        locationInfo.style.display = 'none';
        resetDateAndSlot();
        return;
      }

      selectedLocation = locations.find(l => l.id === locId);
      dateInput.disabled = false;
      dateInput.value = formatDate(new Date()); // Default to today
      locationInfo.style.display = 'block';
      locationInfo.textContent = `📍 ${selectedLocation.address} • Capacity: ${selectedLocation.slotCapacity} per slot`;
      
      // Auto-trigger date change to load slots
      dateInput.dispatchEvent(new Event('change'));
    });

    // Step 2: Date selected
    dateInput.addEventListener('change', function() {
      selectedDate = this.value;
      selectedSlot = null;
      
      if (!selectedLocation || !selectedDate) {
        timeslotGrid.innerHTML = '<div class="small muted" style="padding:1rem; text-align:center; grid-column:1/-1;">Pick a date to see available time slots</div>';
        confirmBtn.disabled = true;
        selectionSummary.style.display = 'none';
        return;
      }

      renderTimeslotCards();
    });

    // Step 4: Confirm booking
    confirmBtn.addEventListener('click', function() {
      if (!selectedLocation || !selectedDate || !selectedSlot) {
        showToast('Please complete all steps');
        return;
      }

      const user = currentUser();
      if (!user) {
        openModal({ title: 'Not signed in', content: '<p>Please sign in to book a slot.</p>' });
        return;
      }

      const alreadyBooked = userHasBookingForSlot(user.username, selectedLocation.id, selectedDate, selectedSlot.id);
      if (alreadyBooked) {
        openModal({ title: 'Already booked', content: '<p>You already have a booking for this slot.</p>' });
        return;
      }

      const assigned = getBookingsFor(selectedLocation.id, selectedDate, selectedSlot.id);
      if (assigned.length >= selectedLocation.slotCapacity) {
        openModal({ title: 'Slot full', content: '<p>This slot is already full.</p>' });
        return;
      }

      // Confirm and book
      openModal({
        title: 'Confirm Booking',
        content: `
          <div style="padding:0.5rem;">
            <p style="margin-bottom:1rem;">Please confirm your booking:</p>
            <div style="background:#f9fafb; padding:1rem; border-radius:6px; margin-bottom:1rem;">
              <div style="margin-bottom:0.5rem;"><strong>📍 Location:</strong> ${escapeHtml(selectedLocation.name)}</div>
              <div style="margin-bottom:0.5rem;"><strong>📅 Date:</strong> ${escapeHtml(selectedDate)}</div>
              <div><strong>🕐 Time:</strong> ${escapeHtml(selectedSlot.label)}</div>
            </div>
            <div class="small muted" style="padding:0.5rem; background:#fef3c7; border-left:3px solid #f59e0b; border-radius:4px;">
              <strong>⚠️ Remember:</strong> Cancellations must be made at least 30 minutes before your scheduled time.
            </div>
          </div>
        `,
        showConfirm: true,
        confirmText: 'Confirm Booking',
        onConfirm: () => {
          const booking = {
            id: uid('bk-'),
            username: user.username,
            displayName: user.displayName || user.username,
            role: user.role || 'volunteer',
            locationId: selectedLocation.id,
            locationName: selectedLocation.name,
            date: selectedDate,
            slotId: selectedSlot.id,
            slotLabel: selectedSlot.label,
            createdAt: Date.now()
          };

          addBooking(booking);
          showToast(`✅ Booking confirmed! ${selectedLocation.name} on ${selectedDate}`);
          
          // Update UI
          updateReservationSummary();
          renderTimeslotCards(); // Refresh to show updated availability
          
          // Reset selection
          confirmBtn.disabled = true;
          selectionSummary.style.display = 'none';
          selectedSlot = null;
        }
      });
    });

    function renderTimeslotCards() {
      timeslotGrid.innerHTML = '';

      // Get time slots configured for this specific location by admin
      const locationSlots = getSlotsForLocation(selectedLocation.id);

      locationSlots.forEach(ts => {
        const assigned = getBookingsFor(selectedLocation.id, selectedDate, ts.id);
        const available = selectedLocation.slotCapacity - assigned.length;
        const isFull = available <= 0;

        const user = currentUser();
        const alreadyBooked = user ? userHasBookingForSlot(user.username, selectedLocation.id, selectedDate, ts.id) : false;

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = isFull || alreadyBooked ? 'not-allowed' : 'pointer';
        card.style.padding = '1rem';
        card.style.border = selectedSlot?.id === ts.id ? '2px solid #3b82f6' : '1px solid #e6eef7';
        card.style.background = selectedSlot?.id === ts.id ? '#eff6ff' : (isFull ? '#f9fafb' : '#fff');
        card.style.opacity = isFull ? '0.6' : '1';
        card.style.transition = 'all 0.2s ease';

        card.innerHTML = `
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:0.5rem; color:${isFull ? '#6b7280' : '#1f2937'};">
            ${escapeHtml(ts.label)}
          </div>
          <div class="small muted" style="margin-bottom:0.5rem;">
            Starts at ${ts.startHour}:00
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; background:${isFull ? '#fee2e2' : (available <= 1 ? '#fef3c7' : '#dcfce7')}; border-radius:4px; margin-bottom:0.5rem;">
            <span class="small" style="font-weight:600;">
              ${isFull ? '🔴 Full' : (available <= 1 ? '⚠️ Almost Full' : '✅ Available')}
            </span>
            <span class="small">
              ${available} of ${selectedLocation.slotCapacity} left
            </span>
          </div>
          ${alreadyBooked ? '<div class="small" style="color:#0284c7; font-weight:600; text-align:center;">✓ Already Booked</div>' : ''}
        `;

        if (!isFull && !alreadyBooked) {
          card.addEventListener('click', function() {
            selectedSlot = ts;
            confirmBtn.disabled = false;
            selectionSummary.style.display = 'block';
            selectionSummary.textContent = `Selected: ${selectedLocation.name} on ${selectedDate} at ${ts.label}`;
            renderTimeslotCards(); // Re-render to highlight selected
          });

          card.addEventListener('mouseenter', function() {
            if (selectedSlot?.id !== ts.id) {
              card.style.borderColor = '#93c5fd';
              card.style.transform = 'translateY(-2px)';
            }
          });

          card.addEventListener('mouseleave', function() {
            if (selectedSlot?.id !== ts.id) {
              card.style.borderColor = '#e6eef7';
              card.style.transform = 'translateY(0)';
            }
          });
        }

        timeslotGrid.appendChild(card);
      });
    }

    function resetDateAndSlot() {
      selectedDate = null;
      selectedSlot = null;
      timeslotGrid.innerHTML = '<div class="small muted" style="padding:1rem; text-align:center; grid-column:1/-1;">Pick a date to see available time slots</div>';
      confirmBtn.disabled = true;
      selectionSummary.style.display = 'none';
    }
  }

  /* -------------------------
     Initialization & bindings
     ------------------------- */
  function init() {
    function start() {
      initStepByStepBooking();
      renderLocationCards();
      updateReservationSummary();

      // add a "My Assignments" button in the volunteer dashboard header if not already present
      const volunteerSection = document.getElementById('volunteer-dashboard');
      if (volunteerSection) {
        let header = volunteerSection.querySelector('.card h2');
        // create top-actions container if missing
        let topActions = volunteerSection.querySelector('.top-actions');
        if (!topActions) {
          topActions = document.createElement('div');
          topActions.className = 'top-actions';
          topActions.style.display = 'flex';
          topActions.style.gap = '0.5rem';
          topActions.style.marginTop = '0.6rem';
          // insert after the first .card inside volunteerSection
          const firstCard = volunteerSection.querySelector('.card');
          if (firstCard) firstCard.appendChild(topActions);
        }

        // add view assignments button
        if (!document.getElementById('btn-my-assignments')) {
          const myBtn = document.createElement('button');
          myBtn.id = 'btn-my-assignments';
          myBtn.className = 'muted-btn';
          myBtn.textContent = 'My Assignments';
          myBtn.addEventListener('click', () => renderMyAssignments());
          topActions.appendChild(myBtn);
        }
      }

      // Wire up "View All Reservations" button in summary card
      const viewAllBtn = document.getElementById('view-all-reservations');
      if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => renderMyAssignments());
      }

      // Wire up "View My Assignments" button
      const myAssignmentsBtn = document.getElementById('view-my-assignments-btn');
      if (myAssignmentsBtn) {
        myAssignmentsBtn.addEventListener('click', () => renderMyAssignments());
      }

      // Wire up "View All Locations" button - shows location summary modal
      const allLocationsBtn = document.getElementById('view-all-locations-btn');
      if (allLocationsBtn) {
        allLocationsBtn.addEventListener('click', () => showAllLocationsModal());
      }

      // If location cards are created by other code already, ensure their buttons open the modal:
      document.querySelectorAll('#location-cards .location-card').forEach(card => {
        const btn = card.querySelector('.view-location');
        if (btn && btn.dataset.locationId) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openLocationModal(btn.dataset.locationId);
          });
        } else {
          // fallback: if data-location-id exists on card
          const id = card.getAttribute('data-location-id') || card.getAttribute('data-location');
          if (id) {
            card.addEventListener('click', () => openLocationModal(id));
          }
        }
      });

      // Periodically update summaries (keeps today's counts fresh)
      setInterval(updateAllSummaries, 30 * 1000); // every 30 seconds
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  /* -------------------------
     Public API
     ------------------------- */
  return {
    init,
    renderLocationCards,
    openLocationModal,
    renderMyAssignments,
    updateReservationSummary,
    loadBookings,
    addBooking,
    removeBookingById,
    getBookingsFor,
    getLocations,
    getSlotsForLocation
  };
})();

// Expose VDB globally
if (typeof window !== 'undefined') {
  window.VDB = VDB;
}

// Auto-init
if (typeof window !== 'undefined') {
  try {
    console.log('🚀 Initializing Volunteer Dashboard...');
    VDB.init();
    console.log('✅ Volunteer Dashboard initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize Volunteer Dashboard', err);
  }
}