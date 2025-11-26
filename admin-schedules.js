/**
 * admin-schedules.js
 * Congregation Volunteer Scheduler — Admin Time Schedule Management
 *
 * Features:
 * - Defines default global time slots (7 slots: 6-8am ... 6-8pm)
 * - Allows Admin to customize time slots per location
 * - Add / remove / edit time slots for specific locations
 * - Set minimum volunteers required and maximum volunteers allowed per time slot
 * - Display which locations have which time slots (overview in Admin > Schedules)
 * - Persist all schedule data to localStorage under key "cvsa_location_slots"
 * - Emits cvsa:schedules:updated event after changes so other modules can react
 *
 * Integration expectations:
 * - Admin > Schedules tab area exists (the sample index.html includes <section id="tab-schedules">).
 * - Modal elements exist (#modal-backdrop, #modal-title, #modal-body, #modal-confirm, #modal-cancel).
 * - AdminLocations module is available and exposes AdminLocations.getLocations() (optional, else falls back to cvsa_locations).
 * - Bookings stored under "cvsa_bookings" (used only for counts if needed externally).
 *
 * Notes:
 * - This is client-side demo code. For production, perform server-side validation and persist schedules to a backend.
 * - To make volunteer booking follow per-location configured slots, integrate VDB (volunteer-dashboard) to read per-location slots
 *   from getSlotsForLocation(locationId) (see below) instead of its built-in TIMESLOTS constant.
 */

(function () {
  const LS_KEY = 'cvsa_location_slots';
  const LS_LOCATIONS = 'cvsa_locations';
  const LS_BOOKINGS = 'cvsa_bookings';

  // Default global time slots (these are used as a baseline; admins can override per location)
  const DEFAULT_SLOTS = [
    { id: '6-8am', label: '6:00 AM - 8:00 AM', startHour: 6, endHour: 8, minVol: 1, maxVol: 4 },
    { id: '8-10am', label: '8:00 AM - 10:00 AM', startHour: 8, endHour: 10, minVol: 1, maxVol: 4 },
    { id: '10-12pm', label: '10:00 AM - 12:00 PM', startHour: 10, endHour: 12, minVol: 1, maxVol: 4 },
    { id: '12-2pm', label: '12:00 PM - 2:00 PM', startHour: 12, endHour: 14, minVol: 1, maxVol: 4 },
    { id: '2-4pm', label: '2:00 PM - 4:00 PM', startHour: 14, endHour: 16, minVol: 1, maxVol: 4 },
    { id: '4-6pm', label: '4:00 PM - 6:00 PM', startHour: 16, endHour: 18, minVol: 1, maxVol: 4 },
    { id: '6-8pm', label: '6:00 PM - 8:00 PM', startHour: 18, endHour: 20, minVol: 1, maxVol: 4 }
  ];

  /* -------------------------
     LocalStorage helpers
     ------------------------- */
  function save(obj) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch (err) {
      console.error('admin-schedules: save error', err);
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('admin-schedules: load error', err);
      return null;
    }
  }

  // Ensure baseline data structure exists: mapping locationId -> [slotObj...]
  function ensureData() {
    const existing = load();
    if (!existing || typeof existing !== 'object') {
      // initialize with empty mapping (locations will fall back to DEFAULT_SLOTS)
      const init = {};
      save(init);
      return init;
    }
    return existing;
  }

  /* -------------------------
     Helpers for locations
     ------------------------- */
  function getLocations() {
    // Prefer AdminLocations.getLocations() if available
    try {
      if (window.AdminLocations && typeof window.AdminLocations.getLocations === 'function') {
        return window.AdminLocations.getLocations();
      }
    } catch (e) { /* ignore */ }
    // Fallback to localStorage cvsa_locations
    try {
      const raw = localStorage.getItem(LS_LOCATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('admin-schedules: could not load locations', err);
      return [];
    }
  }

  /* -------------------------
     CRUD: per-location slots
     ------------------------- */
  function getSlotsForLocation(locationId) {
    const map = ensureData();
    if (!locationId) return DEFAULT_SLOTS.map(clone);
    const custom = map[locationId];
    if (!custom || !Array.isArray(custom) || custom.length === 0) {
      // return cloned default slots
      return DEFAULT_SLOTS.map(clone);
    }
    return custom.map(clone);
  }

  function setSlotsForLocation(locationId, slotsArray) {
    if (!locationId) return;
    const map = ensureData();
    map[locationId] = slotsArray.map(sl => normalizeSlot(sl));
    save(map);
    emitUpdated();
  }

  function addSlotToLocation(locationId, slot) {
    const map = ensureData();
    const list = map[locationId] && Array.isArray(map[locationId]) ? map[locationId] : getSlotsForLocation(locationId);
    slot.id = slot.id || uniqueId('slot-');
    list.push(normalizeSlot(slot));
    map[locationId] = list;
    save(map);
    emitUpdated();
    return list;
  }

  function removeSlotFromLocation(locationId, slotId) {
    const map = ensureData();
    if (!map[locationId]) return false;
    const before = map[locationId].length;
    map[locationId] = map[locationId].filter(s => s.id !== slotId);
    save(map);
    emitUpdated();
    return map[locationId].length < before;
  }

  function updateSlotForLocation(locationId, slotId, patch) {
    const map = ensureData();
    if (!map[locationId]) return false;
    let changed = false;
    map[locationId] = map[locationId].map(s => {
      if (s.id === slotId) {
        changed = true;
        return normalizeSlot(Object.assign({}, s, patch));
      }
      return s;
    });
    if (changed) {
      save(map);
      emitUpdated();
    }
    return changed;
  }

  function normalizeSlot(slot) {
    return {
      id: String(slot.id || slot.label || uniqueId('slot-')).replace(/\s+/g, '-'),
      label: String(slot.label || '').trim(),
      startHour: Number(slot.startHour || 0),
      endHour: Number(slot.endHour || 0),
      minVol: Number(slot.minVol || 0),
      maxVol: Number(slot.maxVol || 0)
    };
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function uniqueId(prefix = '') {
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* -------------------------
     Modal utilities (reuse existing modal in index.html)
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

  function openModal(opts = {}) {
    const { title = '', content = '', showConfirm = false, confirmText = 'Save', onConfirm = null, onClose = null, showCancel = true } = opts;
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
        confirm.onclick = () => { if (onConfirm) onConfirm(); close(); };
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
        if (onClose) onClose();
      }
      backdrop.addEventListener('click', function onB(e) { if (e.target === backdrop) { close(); backdrop.removeEventListener('click', onB); } });
      return { close };
    }
    // fallback
    if (typeof content === 'string') alert(title + '\n\n' + content.replace(/<[^>]+>/g, ''));
    if (onClose) onClose();
    return null;
  }

  /* -------------------------
     UI render: Overview inside Admin > Schedules
     ------------------------- */
  function renderSchedulesOverview() {
    // target the tab-schedules panel in index.html
    const panel = document.getElementById('tab-schedules');
    if (!panel) {
      console.warn('admin-schedules: #tab-schedules not found');
      return;
    }

    // clear previous content inside panel (but keep header controls if present)
    // We'll render a compact table: Location | #Slots | Actions
    let container = panel.querySelector('.schedules-overview');
    if (!container) {
      container = document.createElement('div');
      container.className = 'schedules-overview';
      panel.insertBefore(container, panel.querySelector('.card') || panel.firstChild);
    }
    container.innerHTML = '';

    const locations = getLocations();
    const map = ensureData();

    // Build table
    const table = document.createElement('table');
    table.className = 'schedules-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Location</th><th>Slots</th><th>Actions</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    locations.forEach(loc => {
      const locId = loc.id;
      const slots = map[locId] && Array.isArray(map[locId]) ? map[locId] : DEFAULT_SLOTS;
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = loc.name || locId;

      const tdSlots = document.createElement('td');
      tdSlots.innerHTML = slots.map(s => `<div class="small">${escapeHtml(s.label)} <span class="kv">(${s.minVol || 0}-${s.maxVol || 0})</span></div>`).join('');

      const tdActions = document.createElement('td');
      const editBtn = document.createElement('button');
      editBtn.className = 'muted-btn';
      editBtn.textContent = 'Edit slots';
      editBtn.dataset.locationId = locId;
      editBtn.addEventListener('click', () => openEditSlotsModal(locId));
      const resetBtn = document.createElement('button');
      resetBtn.className = 'muted-btn';
      resetBtn.textContent = 'Reset to defaults';
      resetBtn.addEventListener('click', () => {
        openModal({
          title: 'Reset slots',
          content: `<p>Reset time slots for <strong>${escapeHtml(loc.name)}</strong> to default global slots?</p>`,
          showConfirm: true,
          confirmText: 'Reset',
          onConfirm: () => {
            // set location slots to default (clone)
            const cloneDefaults = DEFAULT_SLOTS.map(clone);
            const mapNow = ensureData();
            mapNow[locId] = cloneDefaults;
            save(mapNow);
            renderSchedulesOverview();
            emitUpdated();
          }
        });
      });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(document.createTextNode(' '));
      tdActions.appendChild(resetBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdSlots);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Add a global control area (Add global slot, apply to all locations)
    let controls = panel.querySelector('.schedules-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'schedules-controls';
      controls.style.display = 'flex';
      controls.style.gap = '0.5rem';
      controls.style.marginBottom = '0.75rem';
      panel.insertBefore(controls, container);
    }
    controls.innerHTML = '';

    const addGlobalBtn = document.createElement('button');
    addGlobalBtn.textContent = 'Add global slot';
    addGlobalBtn.className = 'success';
    addGlobalBtn.addEventListener('click', () => openAddGlobalSlotModal());
    const applyToAllBtn = document.createElement('button');
    applyToAllBtn.textContent = 'Apply defaults to all';
    applyToAllBtn.className = 'muted-btn';
    applyToAllBtn.addEventListener('click', () => {
      openModal({
        title: 'Apply defaults',
        content: '<p>Set every location to use the default time slots? This will overwrite per-location customizations.</p>',
        showConfirm: true,
        confirmText: 'Apply',
        onConfirm: () => {
          const mapNow = {};
          const locationsNow = getLocations();
          locationsNow.forEach(l => { mapNow[l.id] = DEFAULT_SLOTS.map(clone); });
          save(mapNow);
          renderSchedulesOverview();
          emitUpdated();
        }
      });
    });

    controls.appendChild(addGlobalBtn);
    controls.appendChild(applyToAllBtn);
  }

  /* -------------------------
     Modal editor for a location's slots
     ------------------------- */
  function openEditSlotsModal(locationId) {
    const locations = getLocations();
    const loc = locations.find(l => l.id === locationId) || { id: locationId, name: locationId };
    const currentSlots = getSlotsForLocation(locationId);

    // Build editor UI
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gap = '0.6rem';
    wrapper.style.maxHeight = '60vh';
    wrapper.style.overflow = 'auto';

    const intro = document.createElement('div');
    intro.className = 'small muted';
    intro.innerHTML = `<strong>${escapeHtml(loc.name)}</strong> — edit, add, or remove time slots. Set min/max volunteers per slot.`;
    wrapper.appendChild(intro);

    const list = document.createElement('div');
    list.className = 'slot-list';
    list.style.display = 'grid';
    list.style.gap = '0.5rem';

    function renderList() {
      list.innerHTML = '';
      currentSlots.forEach((s, idx) => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 120px 80px 80px 120px';
        row.style.gap = '0.4rem';
        row.style.alignItems = 'center';
        row.style.padding = '0.4rem';
        row.style.border = '1px solid #eef1f5';
        row.style.borderRadius = '8px';
        // label input
        const labelIn = document.createElement('input');
        labelIn.type = 'text';
        labelIn.value = s.label || '';
        labelIn.style.width = '100%';
        labelIn.addEventListener('change', () => { currentSlots[idx].label = labelIn.value.trim(); });

        // start input
        const startIn = document.createElement('input');
        startIn.type = 'number';
        startIn.min = 0;
        startIn.max = 23;
        startIn.value = Number(s.startHour || 0);
        startIn.title = 'Start hour (0-23)';
        startIn.addEventListener('change', () => { currentSlots[idx].startHour = Number(startIn.value); });

        // end input
        const endIn = document.createElement('input');
        endIn.type = 'number';
        endIn.min = 1;
        endIn.max = 24;
        endIn.value = Number(s.endHour || 0);
        endIn.title = 'End hour (1-24)';
        endIn.addEventListener('change', () => { currentSlots[idx].endHour = Number(endIn.value); });

        // min volunteers
        const minIn = document.createElement('input');
        minIn.type = 'number';
        minIn.min = 0;
        minIn.step = 1;
        minIn.value = Number(s.minVol || 0);
        minIn.addEventListener('change', () => { currentSlots[idx].minVol = Number(minIn.value); });

        // max volunteers
        const maxIn = document.createElement('input');
        maxIn.type = 'number';
        maxIn.min = 0;
        maxIn.step = 1;
        maxIn.value = Number(s.maxVol || 0);
        maxIn.addEventListener('change', () => { currentSlots[idx].maxVol = Number(maxIn.value); });

        // delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'danger';
        delBtn.textContent = 'Remove';
        delBtn.style.gridColumn = '1 / -1';
        delBtn.style.justifySelf = 'end';
        delBtn.addEventListener('click', () => {
          // remove slot
          currentSlots.splice(idx, 1);
          renderList();
        });

        row.appendChild(labelIn);
        row.appendChild(startIn);
        row.appendChild(endIn);
        row.appendChild(minIn);
        row.appendChild(maxIn);
        list.appendChild(row);
        list.appendChild(delBtn);
      });
    }

    renderList();
    wrapper.appendChild(list);

    // Add new slot row builder
    const addRow = document.createElement('div');
    addRow.style.display = 'flex';
    addRow.style.gap = '0.5rem';
    addRow.style.alignItems = 'center';
    const newLabel = document.createElement('input'); newLabel.placeholder = 'Label, e.g. 9-11am';
    const newStart = document.createElement('input'); newStart.type = 'number'; newStart.min = 0; newStart.max = 23; newStart.placeholder = 'start';
    const newEnd = document.createElement('input'); newEnd.type = 'number'; newEnd.min = 1; newEnd.max = 24; newEnd.placeholder = 'end';
    const newMin = document.createElement('input'); newMin.type = 'number'; newMin.min = 0; newMin.placeholder = 'min';
    const newMax = document.createElement('input'); newMax.type = 'number'; newMax.min = 0; newMax.placeholder = 'max';
    const addBtn = document.createElement('button'); addBtn.className = 'success'; addBtn.textContent = 'Add slot';

    addRow.appendChild(newLabel);
    addRow.appendChild(newStart);
    addRow.appendChild(newEnd);
    addRow.appendChild(newMin);
    addRow.appendChild(newMax);
    addRow.appendChild(addBtn);
    wrapper.appendChild(addRow);

    addBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const label = (newLabel.value || '').trim();
      const sH = Number(newStart.value);
      const eH = Number(newEnd.value);
      const minV = Number(newMin.value || 0);
      const maxV = Number(newMax.value || 0);
      const validation = [];
      if (!label) validation.push('Label is required for a slot.');
      if (!Number.isFinite(sH) || !Number.isFinite(eH)) validation.push('Start and end must be numbers.');
      if (sH >= eH) validation.push('Start must be before end.');
      if (minV < 0 || maxV < 0) validation.push('Min/Max cannot be negative.');
      if (maxV > 0 && minV > maxV) validation.push('Min cannot be greater than Max.');
      if (validation.length) {
        openModal({ title: 'Validation', content: `<div class="small">${validation.join('<br>')}</div>`, showConfirm: false });
        return;
      }
      currentSlots.push(normalizeSlot({ id: uniqueId('slot-'), label, startHour: sH, endHour: eH, minVol: minV, maxVol: maxV }));
      // clear inputs
      newLabel.value = ''; newStart.value = ''; newEnd.value = ''; newMin.value = ''; newMax.value = '';
      renderList();
    });

    // Save button logic
    openModal({
      title: `Edit slots — ${loc.name}`,
      content: wrapper,
      showConfirm: true,
      confirmText: 'Save slots',
      showCancel: true,
      onConfirm: () => {
        // validate all slots
        const errs = [];
        for (let i = 0; i < currentSlots.length; i++) {
          const s = currentSlots[i];
          if (!s.label) errs.push(`Slot #${i + 1}: label required`);
          if (!Number.isFinite(s.startHour) || !Number.isFinite(s.endHour) || s.startHour >= s.endHour) errs.push(`Slot #${i + 1}: invalid hours`);
          if (s.minVol < 0 || s.maxVol < 0) errs.push(`Slot #${i + 1}: min/max cannot be negative`);
          if (s.maxVol > 0 && s.minVol > s.maxVol) errs.push(`Slot #${i + 1}: min cannot exceed max`);
        }
        if (errs.length) {
          openModal({ title: 'Validation errors', content: `<div class="small">${errs.join('<br>')}</div>`, showConfirm: false });
          return;
        }
        // Assign clean IDs and persist
        const cleaned = currentSlots.map(s => {
          if (!s.id) s.id = uniqueId('slot-');
          s.id = String(s.id).replace(/\s+/g, '-');
          return normalizeSlot(s);
        });
        setSlotsForLocation(locationId, cleaned);
        renderSchedulesOverview();
      }
    });
  }

  /* -------------------------
     Modal to add a global slot (applies to DEFAULT_SLOTS and optionally push to existing)
     ------------------------- */
  function openAddGlobalSlotModal() {
    const form = document.createElement('form');
    form.style.display = 'grid';
    form.style.gap = '0.5rem';
    const labelRow = document.createElement('div'); labelRow.className = 'form-row';
    const labelL = document.createElement('label'); labelL.textContent = 'Slot label';
    const labelIn = document.createElement('input'); labelIn.type = 'text';
    labelRow.appendChild(labelL); labelRow.appendChild(labelIn);

    const startRow = document.createElement('div'); startRow.className = 'form-row';
    const startL = document.createElement('label'); startL.textContent = 'Start hour (0-23)';
    const startIn = document.createElement('input'); startIn.type = 'number'; startIn.min = 0; startIn.max = 23;
    startRow.appendChild(startL); startRow.appendChild(startIn);

    const endRow = document.createElement('div'); endRow.className = 'form-row';
    const endL = document.createElement('label'); endL.textContent = 'End hour (1-24)';
    const endIn = document.createElement('input'); endIn.type = 'number'; endIn.min = 1; endIn.max = 24;
    endRow.appendChild(endL); endRow.appendChild(endIn);

    const minRow = document.createElement('div'); minRow.className = 'form-row';
    const minL = document.createElement('label'); minL.textContent = 'Min volunteers';
    const minIn = document.createElement('input'); minIn.type = 'number'; minIn.min = 0;
    minRow.appendChild(minL); minRow.appendChild(minIn);

    const maxRow = document.createElement('div'); maxRow.className = 'form-row';
    const maxL = document.createElement('label'); maxL.textContent = 'Max volunteers';
    const maxIn = document.createElement('input'); maxIn.type = 'number'; maxIn.min = 0;
    maxRow.appendChild(maxL); maxRow.appendChild(maxIn);

    form.appendChild(labelRow); form.appendChild(startRow); form.appendChild(endRow); form.appendChild(minRow); form.appendChild(maxRow);

    openModal({
      title: 'Add global time slot',
      content: form,
      showConfirm: true,
      confirmText: 'Add',
      showCancel: true,
      onConfirm: () => {
        const label = (labelIn.value || '').trim();
        const sH = Number(startIn.value);
        const eH = Number(endIn.value);
        const minV = Number(minIn.value || 0);
        const maxV = Number(maxIn.value || 0);
        const errors = [];
        if (!label) errors.push('Label required');
        if (!Number.isFinite(sH) || !Number.isFinite(eH) || sH >= eH) errors.push('Invalid start/end');
        if (minV < 0 || maxV < 0) errors.push('Min/Max cannot be negative');
        if (maxV > 0 && minV > maxV) errors.push('Min cannot exceed Max');
        if (errors.length) {
          openModal({ title: 'Validation', content: `<div class="small">${errors.join('<br>')}</div>`, showConfirm: false });
          return;
        }
        // add to DEFAULT_SLOTS (in-memory) and apply to all locations if desired
        const newSlot = normalizeSlot({ id: slugify(label) + '-' + uniqueId('g-'), label, startHour: sH, endHour: eH, minVol: minV, maxVol: maxV });
        DEFAULT_SLOTS.push(newSlot);
        // Optionally ask to apply to every location immediately
        openModal({
          title: 'Apply to locations',
          content: `<p>Global slot added. Do you want to append this slot to every location's schedule?</p>`,
          showConfirm: true,
          confirmText: 'Apply to all',
          onConfirm: () => {
            const mapNow = ensureData();
            const locations = getLocations();
            locations.forEach(l => {
              const arr = mapNow[l.id] && Array.isArray(mapNow[l.id]) ? mapNow[l.id] : getSlotsForLocation(l.id);
              arr.push(clone(newSlot));
              mapNow[l.id] = arr;
            });
            save(mapNow);
            renderSchedulesOverview();
            emitUpdated();
          }
        });
      }
    });
  }

  /* -------------------------
     Utility helpers
     ------------------------- */
  function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function slugify(text = '') { return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  /* -------------------------
     Event emission
     ------------------------- */
  function emitUpdated() {
    try {
      document.dispatchEvent(new CustomEvent('cvsa:schedules:updated', { detail: { time: Date.now() } }));
      // allow other modules to refresh (Volunteer dashboard should listen and adapt to new per-location slots)
      if (window.VDB && typeof window.VDB.renderLocationCards === 'function') {
        // VDB should be updated separately to read per-location slots; just trigger a re-render of cards
        window.VDB.renderLocationCards();
      }
    } catch (err) {
      console.warn('admin-schedules: emit failed', err);
    }
  }

  /* -------------------------
     Initialization
     ------------------------- */
  function init() {
    // ensure data structure exists
    ensureData();

    // render overview when admin opens schedules tab (or on DOMContentLoaded)
    function startup() {
      renderSchedulesOverview();

      // wire a re-render when locations or schedules updated elsewhere
      document.addEventListener('cvsa:locations:updated', renderSchedulesOverview);
      document.addEventListener('cvsa:schedules:refresh', renderSchedulesOverview);

      // if Admin UI has buttons to open specific location editors, delegate clicks
      const panel = document.getElementById('tab-schedules');
      if (panel) {
        panel.addEventListener('click', (ev) => {
          const btn = ev.target.closest('[data-edit-slots-for]');
          if (!btn) return;
          const id = btn.getAttribute('data-edit-slots-for');
          if (id) openEditSlotsModal(id);
        });
      }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startup);
    else startup();
  }

  // expose API
  window.AdminSchedules = {
    init,
    getSlotsForLocation,
    setSlotsForLocation,
    addSlotToLocation,
    removeSlotFromLocation,
    updateSlotForLocation,
    DEFAULT_SLOTS,
    ensureData
  };

  // auto-init
  init();

})();