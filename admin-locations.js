/**
 * admin-locations.js
 * Congregation Volunteer Scheduler — Admin Location Management
 *
 * Features:
 * - Display the 5 default locations in Admin > Locations table
 * - Add new location (name, capacity) via modal form
 * - Edit existing location via modal form
 * - Delete location with confirmation; blocked if volunteers/bookings reference the location
 * - Shows count of volunteers assigned to each location (based on cvsa_bookings)
 * - Persists data to localStorage under "cvsa_locations"
 *
 * Integration expectations:
 * - A table body with id="locations-table-body" exists in the Admin > Locations tab.
 * - An "Add Location" trigger button exists with id="add-location-btn".
 * - Optional modal elements to host forms:
 *     - #modal-backdrop
 *     - #modal-title
 *     - #modal-body
 *     - #modal-confirm
 *     - #modal-cancel
 *   If modal elements are not present, the script falls back to `prompt`/`confirm`/`alert`.
 * - When locations change, the script will attempt to call window.VDB.renderLocationCards() if available
 *   to keep the Volunteer Dashboard in sync.
 *
 * Notes:
 * - This is client-side demo code. For production use, move persistence and checks to a server API.
 */

(function () {
  const LS_KEYS = {
    LOCATIONS: 'cvsa_locations',
    BOOKINGS: 'cvsa_bookings'
  };

  const DEFAULT_LOCATIONS = [
    { id: 'taytay-market', name: 'Taytay Market', address: 'Market Blvd.', slotCapacity: 3, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'angono-plaza', name: 'Angono Plaza', address: 'Plaza St.', slotCapacity: 2, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'angono-entrance', name: 'Angono Entrance', address: 'Entrance Rd.', slotCapacity: 2, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'pritil-entrance', name: 'Pritil Entrance', address: 'Pritil Ave.', slotCapacity: 2, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'pritil-exit', name: 'Pritil Exit', address: 'Exit Rd.', slotCapacity: 1, notes: '', createdAt: Date.now(), updatedAt: Date.now() }
  ];

  /* -------------------------
     LocalStorage helpers
     ------------------------- */
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('admin-locations: failed to save to localStorage', err);
    }
  }

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('admin-locations: failed to load from localStorage', err);
      return null;
    }
  }

function ensureDefaultLocations() {
  console.log('🔧 ensureDefaultLocations() called');
  
  // First, try to load from localStorage
  const existing = load(LS_KEYS.LOCATIONS);
  
  // If we have valid locations in storage, use them
  if (existing && Array.isArray(existing) && existing.length >= 5) {
    console.log('✅ Loaded locations from localStorage:', existing);
    return existing;
  }
  
  // Otherwise, seed with DEFAULT_LOCATIONS
  console.log('📦 Initializing with DEFAULT_LOCATIONS:', DEFAULT_LOCATIONS);
  const seed = DEFAULT_LOCATIONS.map(l => Object.assign({}, l));
  save(LS_KEYS.LOCATIONS, seed);
  console.log('✅ Saved default locations to localStorage');
  return seed;
}

  /* -------------------------
     Bookings queries (to count assigned volunteers)
     ------------------------- */
  function loadBookings() {
    return load(LS_KEYS.BOOKINGS) || [];
  }

  function countAssignedToLocation(locationId) {
    const bookings = loadBookings();
    // count unique bookings referencing the location (each booking represents a slot assignment)
    return bookings.filter(b => b && b.locationId === locationId).length;
  }

  /* -------------------------
     Modal utilities (use existing modal if present)
     ------------------------- */
  function findModalEls() {
    return {
      backdrop: document.getElementById('modal-backdrop'),
      title: document.getElementById('modal-title'),
      body: document.getElementById('modal-body'),
      confirm: document.getElementById('modal-confirm'),
      cancel: document.getElementById('modal-cancel')
    };
  }

  function openModal(options = {}) {
    // options: { title, content (string or DOM node), showConfirm, confirmText, onConfirm, showCancel (bool), onClose }
    const { title = '', content = '', showConfirm = false, confirmText = 'Save', onConfirm = null, showCancel = true, onClose = null } = options;
    const { backdrop, title: mtitle, body: mbody, confirm, cancel } = findModalEls();

    if (backdrop && mtitle && mbody) {
      mtitle.innerHTML = title;
      if (typeof content === 'string') mbody.innerHTML = content;
      else {
        mbody.innerHTML = '';
        mbody.appendChild(content);
      }

      if (confirm) {
        confirm.textContent = confirmText;
        confirm.style.display = showConfirm ? 'inline-block' : 'none';
        confirm.onclick = () => {
          if (typeof onConfirm === 'function') onConfirm();
          close();
        };
      }
      if (cancel) {
        cancel.style.display = showCancel ? 'inline-block' : 'none';
        cancel.onclick = close;
      }

      backdrop.style.display = 'flex';
      backdrop.setAttribute('aria-hidden', 'false');

      function close() {
        backdrop.style.display = 'none';
        backdrop.setAttribute('aria-hidden', 'true');
        if (confirm) confirm.onclick = null;
        if (cancel) cancel.onclick = null;
        if (typeof onClose === 'function') onClose();
      }

      // close by clicking outside modal
      function onBackdropClick(e) {
        if (e.target === backdrop) close();
      }
      backdrop.addEventListener('click', onBackdropClick, { once: true });

      return { close };
    }

    // fallback: use prompt/confirm/alert
    if (showConfirm) {
      const proceed = window.confirm((title ? title + '\n\n' : '') + (typeof content === 'string' ? content.replace(/<[^>]+>/g, '') : ''));
      if (proceed && typeof onConfirm === 'function') onConfirm();
      if (typeof onClose === 'function') onClose();
      return null;
    } else {
      window.alert((title ? title + '\n\n' : '') + (typeof content === 'string' ? content.replace(/<[^>]+>/g, '') : ''));
      if (typeof onClose === 'function') onClose();
      return null;
    }
  }

  function closeCurrentModal() {
    const { backdrop } = findModalEls();
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  /* -------------------------
     Utility helpers
     ------------------------- */
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function uid(prefix = '') {
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function slugify(text = '') {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* -------------------------
     Render locations into admin table
     ------------------------- */
  function renderLocationsTable() {
    const tbody = document.getElementById('locations-table-body');
    if (!tbody) {
      console.warn('admin-locations: #locations-table-body not found in DOM.');
      return;
    }
    const locations = ensureDefaultLocations();
    // sort by name
    locations.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    tbody.innerHTML = '';

    locations.forEach(loc => {
      const assignedCount = countAssignedToLocation(loc.id);

      const tr = document.createElement('tr');
      tr.dataset.locationId = loc.id;

      const tdName = document.createElement('td');
      tdName.className = 'loc-name';
      tdName.textContent = loc.name;

      const tdAddress = document.createElement('td');
      tdAddress.className = 'loc-address';
      tdAddress.textContent = loc.address || '';

      const tdCap = document.createElement('td');
      tdCap.className = 'loc-capacity';
      tdCap.textContent = String(Number(loc.slotCapacity || 0));

      const tdAssigned = document.createElement('td');
      tdAssigned.className = 'loc-assigned small';
      tdAssigned.textContent = `${assignedCount} assigned`;

      const tdActions = document.createElement('td');
      tdActions.className = 'loc-actions';
      tdActions.innerHTML = `
        <button class="edit-location" data-location-id="${escapeHtml(loc.id)}">Edit</button>
        <button class="delete-location" data-location-id="${escapeHtml(loc.id)}">Delete</button>
      `;

      tr.appendChild(tdName);
      tr.appendChild(tdAddress);
      tr.appendChild(tdCap);
      tr.appendChild(tdAssigned);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

    // Attach handlers (delegated)
    tbody.querySelectorAll('.edit-location').forEach(btn => btn.addEventListener('click', onEditLocation));
    tbody.querySelectorAll('.delete-location').forEach(btn => btn.addEventListener('click', onDeleteLocation));
  }

  /* -------------------------
     Add / Edit form builder
     ------------------------- */
  function buildLocationForm(location) {
    // location may be null for add
    const form = document.createElement('form');
    form.className = 'location-form';
    form.style.display = 'grid';
    form.style.gap = '0.5rem';

    // name
    const nameRow = document.createElement('div');
    nameRow.className = 'form-row';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Location name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = 'name';
    nameInput.required = true;
    nameInput.placeholder = 'e.g. Taytay Market';
    if (location) nameInput.value = location.name || '';
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);

    // capacity
    const capRow = document.createElement('div');
    capRow.className = 'form-row';
    const capLabel = document.createElement('label');
    capLabel.textContent = 'Capacity (volunteers per slot)';
    const capInput = document.createElement('input');
    capInput.type = 'number';
    capInput.name = 'slotCapacity';
    capInput.min = 1;
    capInput.value = location ? Number(location.slotCapacity || 1) : 2;
    capRow.appendChild(capLabel);
    capRow.appendChild(capInput);

    // optional address
    const addrRow = document.createElement('div');
    addrRow.className = 'form-row';
    const addrLabel = document.createElement('label');
    addrLabel.textContent = 'Address (optional)';
    const addrInput = document.createElement('input');
    addrInput.type = 'text';
    addrInput.name = 'address';
    if (location) addrInput.value = location.address || '';
    addrRow.appendChild(addrLabel);
    addrRow.appendChild(addrInput);

    // notes
    const notesRow = document.createElement('div');
    notesRow.className = 'form-row';
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes (optional)';
    const notesInput = document.createElement('textarea');
    notesInput.name = 'notes';
    notesInput.rows = 3;
    if (location) notesInput.value = location.notes || '';
    notesRow.appendChild(notesLabel);
    notesRow.appendChild(notesInput);

    // error display
    const error = document.createElement('div');
    error.className = 'small';
    error.style.color = '#9b1c1c';
    error.style.display = 'none';

    // actions (save/cancel) are handled by modal confirm/cancel or by form submit if modal missing
    form.appendChild(nameRow);
    form.appendChild(capRow);
    form.appendChild(addrRow);
    form.appendChild(notesRow);
    form.appendChild(error);

    // validation on submit (used when modal confirm triggers programmatically)
    form._validateAndCollect = function () {
      const name = (nameInput.value || '').trim();
      const address = (addrInput.value || '').trim();
      const slotCapacity = Number(capInput.value);
      const notes = (notesInput.value || '').trim();

      const errors = [];
      if (!name) errors.push('Name is required.');
      if (!Number.isFinite(slotCapacity) || slotCapacity < 1) errors.push('Capacity must be a positive number.');

      return { valid: errors.length === 0, errors, payload: { name, address, slotCapacity, notes } };
    };

    return form;
  }

  /* -------------------------
     Handlers: Add / Edit / Delete
     ------------------------- */
  function onAddLocationClick(e) {
    e && e.preventDefault();
    const form = buildLocationForm(null);

    openModal({
      title: 'Add Location',
      content: form,
      showConfirm: true,
      confirmText: 'Save Location',
      showCancel: true,
      onConfirm: () => {
        const { valid, errors, payload } = form._validateAndCollect();
        if (!valid) {
          // show inline error in modal body
          const errEl = form.querySelector('.small');
          errEl.innerHTML = errors.map(x => `<div>${escapeHtml(x)}</div>`).join('');
          errEl.style.display = 'block';
          return false; // keep modal open (modal confirm will still close because our openModal closes after onConfirm; to avoid that we'd need a different modal pattern)
        }

        // persist new location
        const locations = ensureDefaultLocations();
        // Prevent duplicate by name
        if (locations.some(l => String(l.name).toLowerCase() === payload.name.toLowerCase())) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = `<div>A location with this name already exists.</div>`;
          errEl.style.display = 'block';
          return false;
        }

        const newLoc = {
          id: slugify(payload.name) + '-' + uid().slice(6),
          name: payload.name,
          address: payload.address || '',
          slotCapacity: Number(payload.slotCapacity || 1),
          notes: payload.notes || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        locations.push(newLoc);
        save(LS_KEYS.LOCATIONS, locations);
        renderLocationsTable();
        syncVolunteerView();
      }
    });
  }

  function onEditLocation(e) {
    e && e.preventDefault();
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.locationId;
    if (!id) return;
    const locations = ensureDefaultLocations();
    const loc = locations.find(l => l.id === id);
    if (!loc) return showAlert('Location not found', 'Error');

    const form = buildLocationForm(loc);

    openModal({
      title: `Edit Location — ${loc.name}`,
      content: form,
      showConfirm: true,
      confirmText: 'Save changes',
      showCancel: true,
      onConfirm: () => {
        const { valid, errors, payload } = form._validateAndCollect();
        if (!valid) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = errors.map(x => `<div>${escapeHtml(x)}</div>`).join('');
          errEl.style.display = 'block';
          return false;
        }

        // update
        const idx = locations.findIndex(l => l.id === id);
        if (idx < 0) {
          showAlert('Could not locate the location to update.', 'Error');
          return;
        }

        // prevent renaming to a name that duplicates another location
        if (locations.some((other, i) => i !== idx && String(other.name).toLowerCase() === payload.name.toLowerCase())) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = `<div>A location with this name already exists.</div>`;
          errEl.style.display = 'block';
          return false;
        }

        locations[idx] = Object.assign({}, locations[idx], {
          name: payload.name,
          address: payload.address || '',
          slotCapacity: Number(payload.slotCapacity || 1),
          notes: payload.notes || '',
          updatedAt: Date.now()
        });
        save(LS_KEYS.LOCATIONS, locations);
        renderLocationsTable();
        syncVolunteerView();
      }
    });
  }

  function onDeleteLocation(e) {
    e && e.preventDefault();
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.locationId;
    if (!id) return;
    const locations = ensureDefaultLocations();
    const loc = locations.find(l => l.id === id);
    if (!loc) return showAlert('Location not found', 'Error');

    const assignedCount = countAssignedToLocation(id);
    if (assignedCount > 0) {
      return openModal({
        title: 'Cannot delete location',
        content: `<p>This location has <strong>${assignedCount}</strong> volunteer assignment(s). Remove the assignments before deleting the location.</p>`,
        showConfirm: false
      });
    }

    openModal({
      title: 'Delete location',
      content: `<p>Are you sure you want to permanently delete the location <strong>${escapeHtml(loc.name)}</strong>? This action cannot be undone.</p>`,
      showConfirm: true,
      confirmText: 'Delete',
      showCancel: true,
      onConfirm: () => {
        const updated = locations.filter(l => l.id !== id);
        save(LS_KEYS.LOCATIONS, updated);
        renderLocationsTable();
        syncVolunteerView();
      }
    });
  }

  /* -------------------------
     Keep Volunteer Dashboard in sync
     ------------------------- */
  function syncVolunteerView() {
    // If the volunteer dashboard script exposes a rendering function, call it to refresh cards
    try {
      if (window.VDB && typeof window.VDB.renderLocationCards === 'function') {
        window.VDB.renderLocationCards();
      } else {
        // Try re-dispatching an event for other scripts to pick up
        document.dispatchEvent(new Event('cvsa:locations:updated'));
      }
    } catch (err) {
      console.warn('admin-locations: failed to sync volunteer view', err);
    }
  }

  /* -------------------------
     Initialization
     ------------------------- */
  function init() {
    // Ensure seed data
    ensureDefaultLocations();

    // Render table on DOM ready or immediately if already loaded
    function startup() {
      renderLocationsTable();

      // wire add button
      const addBtn = document.getElementById('add-location-btn');
      if (addBtn) addBtn.addEventListener('click', onAddLocationClick);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startup);
    } else {
      startup();
    }
  }

  // Expose API for testing and extensions
  window.AdminLocations = {
    init,
    renderLocationsTable,
    getLocations: () => ensureDefaultLocations(),
    saveLocations: (arr) => { save(LS_KEYS.LOCATIONS, arr); renderLocationsTable(); syncVolunteerView(); },
    countAssignedToLocation
  };

  // Auto-init
  init();

})();