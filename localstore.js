/**
 * localstore.js
 * Congregation Volunteer Scheduler — Central LocalStorage Manager
 *
 * Responsibilities:
 * - Centralize all localStorage keys and read/write helpers
 * - Initialize demo data when localStorage is empty
 * - Expose a stable API for other modules to read/write volunteers, locations, slots, assignments, session
 * - Emit events when datasets change so UI modules can re-render (cvsa:...:updated)
 * - Export / import / clear data utilities for backup & testing
 *
 * Usage:
 * - Include this file early (before other modules that read localStorage) or ensure they listen to cvsa:data:loaded.
 *   <script src="js/localstore.js"></script>
 *
 * Notes:
 * - This is purely client-side. For production, sync with a secure backend.
 * - The module keeps existing localStorage keys used elsewhere:
 *     cvsa_volunteers
 *     cvsa_locations
 *     cvsa_location_slots
 *     cvsa_bookings
 *     cvsa_session
 *
 * API (window.CVSAStorage):
 * - init(options)
 * - getVolunteers() / saveVolunteers(array)
 * - getLocations() / saveLocations(array)
 * - getLocationSlotsMap() / saveLocationSlotsMap(map)
 * - getAssignments() / saveAssignments(array)
 * - getSession() / saveSession(obj) / clearSession()
 * - exportData() -> triggers download of JSON
 * - importData(jsonOrObject, { merge: boolean }) -> returns { ok, errors }
 * - clearAllData({ seedDemo: boolean })
 * - on(eventName, handler) // subscribe to events
 *
 * Events emitted:
 * - cvsa:data:loaded
 * - cvsa:volunteers:updated
 * - cvsa:locations:updated
 * - cvsa:schedules:updated
 * - cvsa:bookings:updated
 * - cvsa:session:updated
 * - cvsa:data:cleared
 *
 * Demo data seeded (when storage empty): 5 locations, default slots, 3 demo users (admin/volunteer/elder),
 * a couple of volunteers and an example assignment.
 */

(function () {
  const LS_KEYS = {
    VOLUNTEERS: 'cvsa_volunteers',
    LOCATIONS: 'cvsa_locations',
    SLOTS: 'cvsa_location_slots', // mapping locationId -> [slot objects]
    BOOKINGS: 'cvsa_bookings',
    SESSION: 'cvsa_session'
  };

  // Default time slots (used to seed per-location slots if none exist)
  const DEFAULT_SLOTS = [
    { id: '6-8am', label: '6:00 AM - 8:00 AM', startHour: 6, endHour: 8, minVol: 1, maxVol: 4 },
    { id: '8-10am', label: '8:00 AM - 10:00 AM', startHour: 8, endHour: 10, minVol: 1, maxVol: 4 },
    { id: '10-12pm', label: '10:00 AM - 12:00 PM', startHour: 10, endHour: 12, minVol: 1, maxVol: 4 },
    { id: '12-2pm', label: '12:00 PM - 2:00 PM', startHour: 12, endHour: 14, minVol: 1, maxVol: 4 },
    { id: '2-4pm', label: '2:00 PM - 4:00 PM', startHour: 14, endHour: 16, minVol: 1, maxVol: 4 },
    { id: '4-6pm', label: '4:00 PM - 6:00 PM', startHour: 16, endHour: 18, minVol: 1, maxVol: 4 },
    { id: '6-8pm', label: '6:00 PM - 8:00 PM', startHour: 18, endHour: 20, minVol: 1, maxVol: 4 }
  ];

  // Demo locations (5)
  const DEMO_LOCATIONS = [
    { id: 'taytay-market', name: 'Taytay Market', address: 'Market Blvd.', slotCapacity: 3, notes: '' },
    { id: 'angono-plaza', name: 'Angono Plaza', address: 'Plaza St.', slotCapacity: 2, notes: '' },
    { id: 'angono-entrance', name: 'Angono Entrance', address: 'Entrance Rd.', slotCapacity: 2, notes: '' },
    { id: 'pritil-entrance', name: 'Pritil Entrance', address: 'Pritil Ave.', slotCapacity: 2, notes: '' },
    { id: 'pritil-exit', name: 'Pritil Exit', address: 'Exit Rd.', slotCapacity: 1, notes: '' }
  ];

  // Demo volunteers (small set). Their 'congregation' field helps elder filtering.
  const DEMO_VOLUNTEERS = [
    { id: 'vol-maria', name: 'Maria Santos', email: 'maria@example.com', phone: '+63 912 345 6789', congregation: 'Taytay', notes: '' },
    { id: 'vol-jose', name: 'Jose Perez', email: 'jose@example.com', phone: '+63 912 555 1212', congregation: 'Angono', notes: '' },
    { id: 'vol-anna', name: 'Anna Lee', email: 'anna@example.com', phone: '+63 917 111 2222', congregation: 'Pritil', notes: '' }
  ];

  // Demo bookings (assignments)
  const DEMO_BOOKINGS = [
    {
      id: 'bk-demo-1',
      username: 'maria@example.com',
      displayName: 'Maria Santos',
      volunteerId: 'vol-maria',
      role: 'volunteer',
      locationId: 'taytay-market',
      locationName: 'Taytay Market',
      date: (() => {
        const d = new Date(); d.setDate(d.getDate() + 1); // tomorrow
        return d.toISOString().slice(0,10);
      })(),
      slotId: '6-8am',
      slotLabel: '6:00 AM - 8:00 AM',
      startHour: 6,
      endHour: 8,
      status: 'assigned',
      checkedInAt: null,
      createdAt: Date.now()
    }
  ];

  // Demo session accounts for quick testing; these are not "volunteers" table but simple session examples.
  const DEMO_SESSIONS = {
    admin: { username: 'admin', role: 'admin', displayName: 'Administrator' },
    volunteer: { username: 'volunteer', role: 'volunteer', displayName: 'Volunteer Demo' },
    elder: { username: 'elder', role: 'elder', displayName: 'Elder Demo', congregation: 'Taytay' }
  };

  // Utility helpers
  function safeParse(jsonStr, fallback = null) {
    try { return JSON.parse(jsonStr); } catch (e) { return fallback; }
  }
  function safeStringify(obj) {
    try { return JSON.stringify(obj); } catch (e) { return 'null'; }
  }
  function uid(prefix = '') { return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function emit(name, detail = {}) { document.dispatchEvent(new CustomEvent(name, { detail })); }

  // Read/write wrappers
  function _read(key) {
    const raw = localStorage.getItem(key);
    return safeParse(raw, null);
  }
  function _write(key, value) {
    try {
      localStorage.setItem(key, safeStringify(value));
      return true;
    } catch (e) {
      console.error('CVSAStorage write error for key', key, e);
      return false;
    }
  }
  function _remove(key) { localStorage.removeItem(key); }

  // Public dataset functions
  function getVolunteers() { const v = _read(LS_KEYS.VOLUNTEERS); return Array.isArray(v) ? clone(v) : []; }
  function saveVolunteers(list) {
    const arr = Array.isArray(list) ? list : [];
    _write(LS_KEYS.VOLUNTEERS, arr);
    emit('cvsa:volunteers:updated', { count: arr.length });
    emit('cvsa:data:changed');
    return arr;
  }

  function getLocations() { const v = _read(LS_KEYS.LOCATIONS); return Array.isArray(v) ? clone(v) : []; }
  function saveLocations(list) {
    const arr = Array.isArray(list) ? list : [];
    _write(LS_KEYS.LOCATIONS, arr);
    emit('cvsa:locations:updated', { count: arr.length });
    emit('cvsa:data:changed');
    return arr;
  }

  // Slots map: object mapping locationId -> [slot objects]
  function getLocationSlotsMap() {
    const m = _read(LS_KEYS.SLOTS);
    if (m && typeof m === 'object') return clone(m);
    return {};
  }
  function saveLocationSlotsMap(map) {
    const obj = (map && typeof map === 'object') ? map : {};
    _write(LS_KEYS.SLOTS, obj);
    emit('cvsa:schedules:updated', { locations: Object.keys(obj).length });
    emit('cvsa:data:changed');
    return obj;
  }
  function getSlotsForLocation(locationId) {
    const map = getLocationSlotsMap();
    if (map[locationId] && Array.isArray(map[locationId])) return clone(map[locationId]);
    // if no custom slots defined, return clone of DEFAULT_SLOTS
    return clone(DEFAULT_SLOTS);
  }
  function saveSlotsForLocation(locationId, slotsArray) {
    const map = getLocationSlotsMap();
    map[locationId] = Array.isArray(slotsArray) ? clone(slotsArray) : [];
    return saveLocationSlotsMap(map);
  }

  function getAssignments() { const v = _read(LS_KEYS.BOOKINGS); return Array.isArray(v) ? clone(v) : []; }
  function saveAssignments(list) {
    const arr = Array.isArray(list) ? list : [];
    _write(LS_KEYS.BOOKINGS, arr);
    emit('cvsa:bookings:updated', { count: arr.length });
    emit('cvsa:data:changed');
    return arr;
  }

  function getSession() { const s = _read(LS_KEYS.SESSION); return s && typeof s === 'object' ? clone(s) : null; }
  function saveSession(sessionObj) {
    _write(LS_KEYS.SESSION, sessionObj || {});
    emit('cvsa:session:updated', { session: sessionObj });
    emit('cvsa:data:changed');
    return sessionObj;
  }
  function clearSession() {
    _remove(LS_KEYS.SESSION);
    emit('cvsa:session:updated', { session: null });
    emit('cvsa:data:changed');
  }

  // Initialize demo data when storage empty
  function initializeDemoData() {
    // Only seed if keys are missing or empty
    const hasVol = Array.isArray(_read(LS_KEYS.VOLUNTEERS)) && _read(LS_KEYS.VOLUNTEERS).length > 0;
    const hasLoc = Array.isArray(_read(LS_KEYS.LOCATIONS)) && _read(LS_KEYS.LOCATIONS).length > 0;
    const hasSlots = _read(LS_KEYS.SLOTS) && Object.keys(_read(LS_KEYS.SLOTS)).length > 0;
    const hasBookings = Array.isArray(_read(LS_KEYS.BOOKINGS)) && _read(LS_KEYS.BOOKINGS).length > 0;

    if (!hasLoc) {
      // add timestamps and ensure ids
      const locs = DEMO_LOCATIONS.map(l => Object.assign({}, l));
      saveLocations(locs);
    }

    if (!hasSlots) {
      // assign DEFAULT_SLOTS to every demo location
      const map = {};
      const locs = getLocations();
      locs.forEach(l => {
        map[l.id] = clone(DEFAULT_SLOTS);
      });
      saveLocationSlotsMap(map);
    }

    if (!hasVol) {
      const vols = DEMO_VOLUNTEERS.map(v => Object.assign({}, v, { createdAt: Date.now(), updatedAt: Date.now() }));
      saveVolunteers(vols);
    }

    if (!hasBookings) {
      saveAssignments(DEMO_BOOKINGS.map(b => Object.assign({}, b)));
    }

    // seed a default session (none by default) — DO NOT auto-login by default, but provide demo sessions available on API
    if (!getSession()) {
      // no session saved; don't overwrite. Keep application on login screen.
    }

    emit('cvsa:data:loaded', { seededDemo: true });
  }

  // Clear all data (for tests)
  function clearAllData({ seedDemo = false } = {}) {
    try {
      Object.values(LS_KEYS).forEach(k => _remove(k));
      emit('cvsa:data:cleared', {});
      if (seedDemo) {
        initializeDemoData();
      } else {
        emit('cvsa:data:loaded', { seededDemo: false });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // Export all data as JSON and trigger download
  function exportData(filename = null) {
    const payload = {
      exportedAt: new Date().toISOString(),
      volunteers: getVolunteers(),
      locations: getLocations(),
      locationSlots: getLocationSlotsMap(),
      assignments: getAssignments(),
      session: getSession()
    };
    const name = filename || `cvsa-export-${(new Date()).toISOString().slice(0,10)}.json`;
    const txt = safeStringify(payload);
    const blob = new Blob([txt], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true, filename: name };
  }

  // Import data from JSON string or object. Options: { merge: boolean } (merge = true merges arrays/maps, otherwise replace)
  function importData(jsonOrObject, { merge = true } = {}) {
    let obj = null;
    if (!jsonOrObject) return { ok: false, error: 'No data provided' };
    if (typeof jsonOrObject === 'string') {
      obj = safeParse(jsonOrObject, null);
      if (!obj) return { ok: false, error: 'Invalid JSON' };
    } else if (typeof jsonOrObject === 'object') {
      obj = jsonOrObject;
    } else {
      return { ok: false, error: 'Unsupported input' };
    }

    const errors = [];
    // volunteers
    if (Array.isArray(obj.volunteers)) {
      if (merge) {
        const existing = getVolunteers();
        // merge by id or email+name
        const map = {};
        existing.forEach(v => { map[v.id || v.email || uid('v-')] = v; });
        obj.volunteers.forEach(v => {
          const key = v.id || v.email || (v.name ? slugify(v.name) : uid('v-'));
          map[key] = Object.assign({}, map[key] || {}, v);
        });
        saveVolunteers(Object.values(map));
      } else {
        saveVolunteers(obj.volunteers);
      }
    } else if (obj.volunteers !== undefined) {
      errors.push('volunteers must be an array');
    }

    // locations
    if (Array.isArray(obj.locations)) {
      if (merge) {
        const existing = getLocations();
        const map = {};
        existing.forEach(l => { map[l.id || uid('loc-')] = l; });
        obj.locations.forEach(l => {
          const key = l.id || slugify(l.name || uid('loc-'));
          map[key] = Object.assign({}, map[key] || {}, l);
        });
        saveLocations(Object.values(map));
      } else {
        saveLocations(obj.locations);
      }
    } else if (obj.locations !== undefined) {
      errors.push('locations must be an array');
    }

    // locationSlots (map)
    if (obj.locationSlots && typeof obj.locationSlots === 'object') {
      if (merge) {
        const existing = getLocationSlotsMap();
        const merged = Object.assign({}, existing);
        Object.keys(obj.locationSlots).forEach(k => {
          merged[k] = Array.isArray(obj.locationSlots[k]) ? obj.locationSlots[k] : (merged[k] || []);
        });
        saveLocationSlotsMap(merged);
      } else {
        saveLocationSlotsMap(obj.locationSlots);
      }
    } else if (obj.locationSlots !== undefined && obj.locationSlots !== null) {
      errors.push('locationSlots must be an object mapping locationId->array');
    }

    // assignments
    if (Array.isArray(obj.assignments)) {
      if (merge) {
        const existing = getAssignments();
        // we will simply append non-duplicate bookings (by id)
        const ids = new Set(existing.map(b => b.id));
        const merged = existing.slice();
        obj.assignments.forEach(b => {
          if (!b.id) b.id = uid('bk-');
          if (!ids.has(b.id)) {
            merged.push(b);
            ids.add(b.id);
          }
        });
        saveAssignments(merged);
      } else {
        saveAssignments(obj.assignments);
      }
    } else if (obj.assignments !== undefined) {
      errors.push('assignments must be an array');
    }

    // session
    if (obj.session) {
      if (typeof obj.session === 'object') {
        saveSession(obj.session);
      } else {
        errors.push('session must be an object');
      }
    }

    // Emit batch events
    emit('cvsa:volunteers:updated', { count: getVolunteers().length });
    emit('cvsa:locations:updated', { count: getLocations().length });
    emit('cvsa:schedules:updated', { locations: Object.keys(getLocationSlotsMap()).length });
    emit('cvsa:bookings:updated', { count: getAssignments().length });
    emit('cvsa:session:updated', { session: getSession() });
    emit('cvsa:data:loaded', { imported: true });

    return { ok: errors.length === 0, errors };
  }

  // Helper: slugify name for ids
  function slugify(text = '') {
    return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Clear and re-seed demo convenience
  function resetToDemo() {
    clearAllData({ seedDemo: true });
  }

  // Small convenience: load everything (ensure demo seed)
  function loadAll({ seedDemoIfEmpty = true } = {}) {
    // If any of the primary keys are missing, seed demo (only if allowed)
    const hasAny = _read(LS_KEYS.VOLUNTEERS) || _read(LS_KEYS.LOCATIONS) || _read(LS_KEYS.SLOTS) || _read(LS_KEYS.BOOKINGS) || _read(LS_KEYS.SESSION);
    if (!hasAny && seedDemoIfEmpty) {
      initializeDemoData();
    } else {
      // still emit loaded event so listeners initialize
      emit('cvsa:data:loaded', { seededDemo: false });
    }
  }

  // Convenience: import from file input element (file object) -> produces Promise
  function importFromFile(file, { merge = true } = {}) {
    return new Promise((resolve, reject) => {
      if (!file) return reject({ ok: false, error: 'No file' });
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const txt = e.target.result;
          const obj = safeParse(txt, null);
          if (!obj) return resolve({ ok: false, error: 'Invalid JSON' });
          const res = importData(obj, { merge });
          resolve(res);
        } catch (err) {
          resolve({ ok: false, error: String(err) });
        }
      };
      reader.onerror = function (err) { resolve({ ok: false, error: String(err) }); };
      reader.readAsText(file);
    });
  }

  // Small helper to validate that other modules can rely on this API existing
  function init(options = {}) {
    // options: { seedDemoIfEmpty: boolean }
    loadAll({ seedDemoIfEmpty: options.seedDemoIfEmpty !== false });
  }

  // Expose API
  const API = {
    // init/load
    init,
    loadAll,
    initializeDemoData,
    resetToDemo,
    clearAllData,

    // volunteers
    getVolunteers,
    saveVolunteers,

    // locations
    getLocations,
    saveLocations,

    // slots
    getLocationSlotsMap,
    saveLocationSlotsMap,
    getSlotsForLocation,
    saveSlotsForLocation,

    // bookings/assignments
    getAssignments,
    saveAssignments,

    // session
    getSession,
    saveSession,
    clearSession,

    // import/export
    exportData,
    importData,
    importFromFile,

    // utilities
    slugify,
    uid,

    // events: subscribe helper
    on: function (eventName, handler) {
      document.addEventListener(eventName, handler);
      return function unsubscribe() { document.removeEventListener(eventName, handler); };
    }
  };

  // Attach to window for global usage
  window.CVSAStorage = API;

  // Auto-initialize (seed demo if empty)
  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        init({ seedDemoIfEmpty: true });
      } catch (e) {
        console.error('CVSAStorage init failed', e);
      }
    });
  }

  // Export for modules that import as script module (optional)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();