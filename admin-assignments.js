/**
 * admin-assignments.js
 * Congregation Volunteer Scheduler — Admin Assignments Management
 *
 * Features:
 * - Locations x Time Slot grid (for a selected date)
 * - Drag-and-drop volunteers from the side list into grid cells to assign
 * - Manual assignment form (select volunteer, location, slot, date)
 * - Detect & warn about double-booking (overlapping times on same date)
 * - Show current assignments in each cell, with ability to remove
 * - Bulk assign multiple selected volunteers to the same slot
 * - Conflicts shown in red; warnings for conflicts before assigning
 * - Data persisted to localStorage under "cvsa_bookings"
 *
 * Integration notes:
 * - Requires an Admin > Assignments tab container with id="tab-assignments" in index.html
 * - Reads volunteers from localStorage key "cvsa_volunteers"
 * - Reads locations from AdminLocations.getLocations() or localStorage "cvsa_locations"
 * - Reads per-location slots from AdminSchedules.getSlotsForLocation(locationId) if available,
 *   otherwise falls back to AdminSchedules.DEFAULT_SLOTS or a built-in default.
 * - Uses existing modal elements if present (#modal-backdrop, #modal-title, #modal-body, #modal-confirm, #modal-cancel)
 *
 * Usage:
 *  - Include after your other admin scripts:
 *      <script src="/js/admin-assignments.js"></script>
 *
 * Security note:
 * - This is a client-side demo; in production, perform assignment validation on the server.
 */

(function () {
  const LS_BOOKINGS = 'cvsa_bookings';
  const LS_VOLUNTEERS = 'cvsa_volunteers';
  const LS_LOCATIONS = 'cvsa_locations';

  // Fallback time slots (if AdminSchedules isn't present)
  const FALLBACK_SLOTS = [
    { id: '6-8am', label: '6:00 AM - 8:00 AM', startHour: 6, endHour: 8 },
    { id: '8-10am', label: '8:00 AM - 10:00 AM', startHour: 8, endHour: 10 },
    { id: '10-12pm', label: '10:00 AM - 12:00 PM', startHour: 10, endHour: 12 },
    { id: '12-2pm', label: '12:00 PM - 2:00 PM', startHour: 12, endHour: 14 },
    { id: '2-4pm', label: '2:00 PM - 4:00 PM', startHour: 14, endHour: 16 },
    { id: '4-6pm', label: '4:00 PM - 6:00 PM', startHour: 16, endHour: 18 },
    { id: '6-8pm', label: '6:00 PM - 8:00 PM', startHour: 18, endHour: 20 }
  ];

  /* -------------------------
     Storage helpers
     ------------------------- */
  function saveBookings(list) {
    try { localStorage.setItem(LS_BOOKINGS, JSON.stringify(list)); }
    catch (e) { console.error('admin-assignments: saveBookings', e); }
  }
  function loadBookings() {
    try {
      const raw = localStorage.getItem(LS_BOOKINGS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { console.error('admin-assignments: loadBookings', e); return []; }
  }

  function loadVolunteers() {
    try {
      const raw = localStorage.getItem(LS_VOLUNTEERS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { console.error('admin-assignments: loadVolunteers', e); return []; }
  }

  function loadLocations() {
    try {
      // prefer AdminLocations.getLocations() if present
      if (window.AdminLocations && typeof window.AdminLocations.getLocations === 'function') {
        return window.AdminLocations.getLocations();
      }
      const raw = localStorage.getItem(LS_LOCATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { console.error('admin-assignments: loadLocations', e); return []; }
  }

  function getSlotsForLocation(locationId) {
    try {
      if (window.AdminSchedules && typeof window.AdminSchedules.getSlotsForLocation === 'function') {
        return window.AdminSchedules.getSlotsForLocation(locationId);
      }
      if (window.AdminSchedules && Array.isArray(window.AdminSchedules.DEFAULT_SLOTS)) {
        return window.AdminSchedules.DEFAULT_SLOTS;
      }
    } catch (e) { /* ignore */ }
    return FALLBACK_SLOTS;
  }

  /* -------------------------
     Utilities
     ------------------------- */
  function uid(prefix = '') {
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDateStr(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function slotRange(slot) {
    // returns {startHour, endHour}
    return { start: Number(slot.startHour || 0), end: Number(slot.endHour || 0) };
  }

  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function findVolunteerById(id) {
    const vols = loadVolunteers();
    return vols.find(v => v.id === id) || null;
  }

  function findLocationById(id) {
    const locs = loadLocations();
    return locs.find(l => l.id === id) || null;
  }

  /* -------------------------
     Modal helper (uses existing modal in page)
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
    const { title = '', content = '', showConfirm = false, confirmText = 'Confirm', onConfirm = null, onClose = null } = opts;
    const { backdrop, title: mtitle, body: mbody, confirm, cancel } = findModalEls();
    if (backdrop && mtitle && mbody) {
      mtitle.innerHTML = title;
      if (typeof content === 'string') mbody.innerHTML = content;
      else { mbody.innerHTML = ''; mbody.appendChild(content); }
      if (confirm) {
        confirm.textContent = confirmText;
        confirm.style.display = showConfirm ? 'inline-block' : 'none';
        confirm.onclick = () => { if (onConfirm) onConfirm(); close(); };
      }
      if (cancel) {
        cancel.style.display = 'inline-block';
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
     Assignment model helpers
     ------------------------- */
  function getAssignmentsForCell(locationId, dateStr, slotId) {
    const all = loadBookings();
    return all.filter(b => b.locationId === locationId && b.date === dateStr && b.slotId === slotId);
  }

  function getAssignmentsForVolunteerOnDate(volIdOrName, dateStr) {
    // volIdOrName may be volunteer.id or volunteer.name or email or username
    const all = loadBookings();
    return all.filter(b => {
      if (b.date !== dateStr) return false;
      // heuristics: if booking.username equals volunteer id/email/name or booking.displayName equals name
      if (!volIdOrName) return false;
      const v = volIdOrName.toString().toLowerCase();
      if (b.username && b.username.toString().toLowerCase() === v) return true;
      if (b.displayName && b.displayName.toString().toLowerCase() === v) return true;
      // if volunteer id stored in booking.volunteerId (future), match it
      if (b.volunteerId && b.volunteerId === volIdOrName) return true;
      return false;
    });
  }

  function addAssignment(assignment) {
    const all = loadBookings();
    all.push(assignment);
    saveBookings(all);
  }

  function removeAssignmentById(id) {
    const all = loadBookings().filter(b => b.id !== id);
    saveBookings(all);
  }

  /* -------------------------
     Conflict detection
     ------------------------- */
  function detectConflictFor(volIdentifier, dateStr, newSlot) {
    // volIdentifier: volunteer.id or name or email/username
    const existing = getAssignmentsForVolunteerOnDate(volIdentifier, dateStr);
    const newRange = slotRange(newSlot);
    for (const b of existing) {
      // find slot object for booking slot
      const slots = getSlotsForLocation(b.locationId);
      const slotObj = slots.find(s => s.id === b.slotId) || { startHour: b.startHour || 0, endHour: b.endHour || 0 };
      const existingRange = slotRange(slotObj);
      if (rangesOverlap(newRange.start, newRange.end, existingRange.start, existingRange.end)) {
        return { conflict: true, booking: b, existingSlot: slotObj };
      }
    }
    return { conflict: false };
  }

  /* -------------------------
     UI Rendering
     ------------------------- */

  function buildAssignmentsUI() {
    const panel = document.getElementById('tab-assignments');
    if (!panel) {
      console.warn('admin-assignments: #tab-assignments not found');
      return;
    }

    // Clear and create layout: controls (date picker), left list of volunteers, right grid
    panel.innerHTML = ''; // remove existing content (we will create full UI here)

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.gap = '0.5rem';
    header.style.alignItems = 'center';
    header.style.marginBottom = '0.6rem';

    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date:';
    dateLabel.style.fontWeight = 700;
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = formatDate(new Date());
    dateInput.id = 'assign-date';
    dateInput.style.marginLeft = '0.25rem';

    header.appendChild(dateLabel);
    header.appendChild(dateInput);

    // bulk assign controls
    const bulkBtn = document.createElement('button');
    bulkBtn.textContent = 'Assign selected to slot';
    bulkBtn.className = 'muted-btn';
    bulkBtn.style.marginLeft = 'auto';
    header.appendChild(bulkBtn);

    panel.appendChild(header);

    const layout = document.createElement('div');
    layout.style.display = 'grid';
    layout.style.gridTemplateColumns = '320px 1fr';
    layout.style.gap = '1rem';
    panel.appendChild(layout);

    // Left: volunteer list with checkboxes and drag sources
    const left = document.createElement('aside');
    left.className = 'card';
    left.style.overflow = 'auto';
    left.style.maxHeight = '60vh';
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = '0.5rem';

    const leftHeader = document.createElement('div');
    leftHeader.style.display = 'flex';
    leftHeader.style.gap = '0.5rem';
    leftHeader.style.alignItems = 'center';

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search volunteers';
    search.style.flex = '1';
    leftHeader.appendChild(search);

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.className = 'muted-btn';
    addBtn.style.marginLeft = '0.25rem';
    addBtn.addEventListener('click', () => openAddVolunteerModal());
    leftHeader.appendChild(addBtn);

    left.appendChild(leftHeader);

    const volList = document.createElement('div');
    volList.id = 'assign-vol-list';
    volList.style.display = 'grid';
    volList.style.gap = '0.4rem';
    left.appendChild(volList);

    layout.appendChild(left);

    // Right: grid container
    const rightWrap = document.createElement('div');
    rightWrap.style.display = 'flex';
    rightWrap.style.flexDirection = 'column';
    rightWrap.style.gap = '0.5rem';

    // Location x slots grid
    const gridWrap = document.createElement('div');
    gridWrap.style.overflow = 'auto';
    gridWrap.style.maxHeight = '60vh';
    gridWrap.style.border = '1px solid #eef1f5';
    gridWrap.style.borderRadius = '8px';
    gridWrap.style.padding = '0.6rem';
    gridWrap.style.background = '#fff';

    rightWrap.appendChild(gridWrap);

    // Legend / instructions
    const legend = document.createElement('div');
    legend.className = 'small muted';
    legend.innerHTML = '<strong>Instructions:</strong> Drag volunteers onto a cell or select one/more volunteers and click a cell to assign. Conflicts are shown in red.';
    rightWrap.appendChild(legend);

    layout.appendChild(rightWrap);

    // Render volunteers list and grid for the selected date
    function renderVolunteerList(filter = '') {
      const vols = loadVolunteers();
      const q = (filter || '').trim().toLowerCase();
      volList.innerHTML = '';
      vols
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .filter(v => !q || `${v.name || ''} ${v.email || ''} ${v.phone || ''} ${v.congregation || ''}`.toLowerCase().includes(q))
        .forEach(v => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '0.5rem';
          row.style.padding = '0.4rem';
          row.style.border = '1px solid #f1f5f9';
          row.style.borderRadius = '8px';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'assign-select';
          cb.dataset.volId = v.id;

          const dragHandle = document.createElement('div');
          dragHandle.textContent = '☰';
          dragHandle.title = 'Drag to assign';
          dragHandle.style.cursor = 'grab';
          dragHandle.draggable = true;
          dragHandle.dataset.volId = v.id;

          dragHandle.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData('text/plain', v.id);
            // include volunteer name for convenience
            ev.dataTransfer.setData('text/vol-name', v.name || '');
          });

          const info = document.createElement('div');
          info.style.flex = '1';
          info.innerHTML = `<div style="font-weight:700">${escapeHtml(v.name)}</div><div class="small muted">${escapeHtml(v.congregation || '')} · ${escapeHtml(v.email || '')}</div>`;

          const shifts = document.createElement('div');
          shifts.className = 'small';
          shifts.textContent = `${countShiftsForVolunteer(v)} shifts`;

          // clicking name opens quick actions (details/assign)
          info.addEventListener('click', () => openVolunteerDetails(v));

          row.appendChild(cb);
          row.appendChild(dragHandle);
          row.appendChild(info);
          row.appendChild(shifts);
          volList.appendChild(row);
        });
    }

    // Count shifts for volunteer (simple heuristic)
    function countShiftsForVolunteer(vol) {
      const all = loadBookings();
      const name = (vol.name || '').trim().toLowerCase();
      const email = (vol.email || '').trim().toLowerCase();
      return all.filter(b => (b.displayName && b.displayName.toLowerCase() === name) || (b.username && b.username.toLowerCase() === email) || (b.volunteerId && b.volunteerId === vol.id)).length;
    }

    // Render grid for date
    function renderGridForDate(dateStr) {
      gridWrap.innerHTML = '';
      const locations = loadLocations();
      if (!locations.length) {
        gridWrap.innerHTML = '<div class="small muted">No locations configured</div>';
        return;
      }

      // Determine union of slot ids across all locations for header columns (we will show columns of "slots used by at least one location")
      const slotHeaders = [];
      const slotMap = {}; // key -> {label, start,end}
      locations.forEach(loc => {
        const slots = getSlotsForLocation(loc.id) || [];
        slots.forEach(s => {
          if (!slotMap[s.id]) {
            slotMap[s.id] = { label: s.label, startHour: s.startHour, endHour: s.endHour };
            slotHeaders.push(s.id);
          }
        });
      });

      // Table: header row with slots
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';

      const thead = document.createElement('thead');
      const thr = document.createElement('tr');
      thr.innerHTML = `<th style="width:220px">Location</th>` + slotHeaders.map(id => `<th style="min-width:160px">${escapeHtml(slotMap[id].label)}<div class="small muted">${slotMap[id].startHour}:00 - ${slotMap[id].endHour}:00</div></th>`).join('');
      thead.appendChild(thr);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      locations.forEach(loc => {
        const tr = document.createElement('tr');
        const tdLoc = document.createElement('td');
        tdLoc.style.padding = '0.5rem';
        tdLoc.style.verticalAlign = 'top';
        tdLoc.innerHTML = `<div style="font-weight:700">${escapeHtml(loc.name)}</div><div class="small muted">${escapeHtml(loc.address || '')}</div>`;
        tr.appendChild(tdLoc);

        // get slots for this location (map for quick check)
        const locSlots = (getSlotsForLocation(loc.id) || []).reduce((m, s) => { m[s.id] = s; return m; }, {});
        slotHeaders.forEach(slotId => {
          const td = document.createElement('td');
          td.style.padding = '0.25rem';
          td.style.verticalAlign = 'top';
          td.style.minWidth = '160px';
          td.style.borderLeft = '1px solid #f1f5f9';
          td.dataset.locationId = loc.id;
          td.dataset.slotId = slotId;
          td.dataset.date = dateStr;
          td.className = 'assign-cell';

          if (!locSlots[slotId]) {
            // slot not configured for this location
            td.innerHTML = '<div class="small muted">—</div>';
            td.style.background = '#fbfdfe';
            td.style.color = '#94a3b8';
          } else {
            // render current assignments for this cell
            const assignments = getAssignmentsForCell(loc.id, dateStr, slotId);
            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gap = '0.3rem';

            assignments.forEach(a => {
              const volBadge = document.createElement('div');
              volBadge.style.display = 'flex';
              volBadge.style.alignItems = 'center';
              volBadge.style.justifyContent = 'space-between';
              volBadge.style.gap = '0.5rem';
              volBadge.style.padding = '0.3rem 0.4rem';
              volBadge.style.border = '1px solid #eef1f5';
              volBadge.style.borderRadius = '6px';
              volBadge.style.background = '#f8fafc';
              volBadge.className = 'assignment-badge';
              volBadge.dataset.assignmentId = a.id;

              const left = document.createElement('div');
              left.innerHTML = `<div style="font-weight:700">${escapeHtml(a.displayName || a.username || 'Volunteer')}</div><div class="small muted">${escapeHtml(a.role || '')}</div>`;

              const right = document.createElement('div');
              right.style.display = 'flex';
              right.style.gap = '0.4rem';
              right.style.alignItems = 'center';

              const del = document.createElement('button');
              del.className = 'danger';
              del.textContent = '✕';
              del.title = 'Remove assignment';
              del.addEventListener('click', (ev) => {
                ev.stopPropagation();
                openModal({
                  title: 'Remove assignment',
                  content: `<p>Remove ${escapeHtml(a.displayName || a.username)} from ${escapeHtml(loc.name)} ${escapeHtml(slotMap[slotId].label)} on ${escapeHtml(dateStr)}?</p>`,
                  showConfirm: true,
                  confirmText: 'Remove',
                  onConfirm: () => { removeAssignmentById(a.id); renderGridForDate(dateStr); }
                });
              });

              right.appendChild(del);
              volBadge.appendChild(left);
              volBadge.appendChild(right);

              // mark conflict visually if overlapping elsewhere
              const conflict = detectConflictFor(a.username || a.displayName || a.volunteerId, dateStr, slotMap[slotId]);
              if (conflict && conflict.conflict) {
                volBadge.style.borderColor = '#fca5a5';
                volBadge.style.background = '#fff1f2';
                const warn = document.createElement('div');
                warn.className = 'small';
                warn.style.color = '#b91c1c';
                warn.textContent = 'Conflict';
                right.appendChild(warn);
              }

              list.appendChild(volBadge);
            });

            // drop target behavior (assign on drop)
            td.addEventListener('dragover', (ev) => { ev.preventDefault(); td.style.outline = '3px dashed rgba(11,77,167,0.12)'; });
            td.addEventListener('dragleave', () => { td.style.outline = 'none'; });
            td.addEventListener('drop', (ev) => {
              ev.preventDefault();
              td.style.outline = 'none';
              const volId = ev.dataTransfer.getData('text/plain') || ev.dataTransfer.getData('text/vol-id');
              const vol = findVolunteerById(volId);
              if (!vol) return openModal({ title: 'Unknown volunteer', content: 'Volunteer not found.' });
              // get slot object
              const slotObj = slotMap[slotId] || locSlots[slotId];
              if (!slotObj) return openModal({ title: 'Slot not available', content: 'This time slot is not configured for the location.' });

              // conflict detection
              const conflict = detectConflictFor(vol.id || vol.name || vol.email || vol.username, dateStr, slotObj);
              if (conflict && conflict.conflict) {
                openModal({
                  title: 'Possible double-booking',
                  content: `<p>${escapeHtml(vol.name)} appears to have an overlapping assignment (${escapeHtml(conflict.existingSlot.label || conflict.existingSlot.id)}) on ${escapeHtml(dateStr)}. Proceed anyway?</p>`,
                  showConfirm: true,
                  confirmText: 'Assign anyway',
                  onConfirm: () => {
                    const booking = makeBooking(vol, loc, slotObj, dateStr);
                    addAssignment(booking);
                    renderGridForDate(dateStr);
                  }
                });
              } else {
                const booking = makeBooking(vol, loc, slotObj, dateStr);
                addAssignment(booking);
                renderGridForDate(dateStr);
              }
            });

            // click on empty cell opens manual assign modal for selected volunteers or single
            td.addEventListener('click', () => {
              const selected = Array.from(document.querySelectorAll('.assign-select:checked')).map(cb => cb.dataset.volId);
              if (selected.length) {
                // bulk assign
                handleBulkAssign(selected, loc, slotMap[slotId], dateStr);
              } else {
                // manual form for single assignment
                openManualAssignModal(loc, slotMap[slotId], dateStr);
              }
            });

            td.appendChild(list);
          }
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      gridWrap.appendChild(table);

      // attach assignment badge click handlers are inside creation above
    }

    // initial render
    renderVolunteerList();
    renderGridForDate(dateInput.value);

    // search binding
    search.addEventListener('input', () => renderVolunteerList(search.value));

    // date change binding
    dateInput.addEventListener('change', () => renderGridForDate(dateInput.value));

    // bulk assign button behavior: instructs user to select volunteers then click a cell
    bulkBtn.addEventListener('click', () => {
      openModal({ title: 'Bulk assign', content: '<p>Select volunteers on the left (checkboxes), then click the target cell in the grid to assign them in bulk.</p>', showConfirm: false });
    });
  }

  /* -------------------------
     Manual assign modal
     ------------------------- */
  function openManualAssignModal(location, slotObj, dateStr) {
    const form = document.createElement('form');
    form.style.display = 'grid';
    form.style.gap = '0.5rem';

    // volunteer select
    const vols = loadVolunteers();
    const volRow = document.createElement('div'); volRow.className = 'form-row';
    const volLabel = document.createElement('label'); volLabel.textContent = 'Volunteer';
    const volSelect = document.createElement('select'); volSelect.name = 'volunteer';
    volSelect.style.width = '100%';
    volSelect.innerHTML = '<option value="">-- select --</option>' + vols.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)} (${escapeHtml(v.congregation || '')})</option>`).join('');
    volRow.appendChild(volLabel); volRow.appendChild(volSelect);

    form.appendChild(volRow);

    form.appendChild((() => {
      const row = document.createElement('div'); row.className = 'form-row';
      row.innerHTML = `<div class="small muted">Location: <strong>${escapeHtml(location.name)}</strong> · Slot: <strong>${escapeHtml(slotObj.label)}</strong> · Date: <strong>${escapeHtml(dateStr)}</strong></div>`;
      return row;
    })());

    openModal({
      title: 'Assign volunteer',
      content: form,
      showConfirm: true,
      confirmText: 'Assign',
      onConfirm: () => {
        const volId = volSelect.value;
        if (!volId) return openModal({ title: 'Validation', content: 'Please select a volunteer.' });
        const vol = findVolunteerById(volId);
        if (!vol) return openModal({ title: 'Error', content: 'Selected volunteer not found.' });

        const conflict = detectConflictFor(vol.id || vol.name || vol.email, dateStr, slotObj);
        if (conflict && conflict.conflict) {
          openModal({
            title: 'Double-booking detected',
            content: `<p>${escapeHtml(vol.name)} has an overlapping assignment (${escapeHtml(conflict.existingSlot.label || conflict.existingSlot.id)}). Proceed?</p>`,
            showConfirm: true,
            confirmText: 'Assign anyway',
            onConfirm: () => {
              addAssignment(makeBooking(vol, location, slotObj, dateStr));
              // refresh UI
              buildAssignmentsUI();
            }
          });
        } else {
          addAssignment(makeBooking(vol, location, slotObj, dateStr));
          buildAssignmentsUI();
        }
      },
      onClose: () => {}
    });
  }

  /* -------------------------
     Bulk assign handler
     ------------------------- */
  function handleBulkAssign(volIds, location, slotObj, dateStr) {
    const volObjs = volIds.map(id => findVolunteerById(id)).filter(Boolean);
    if (!volObjs.length) return openModal({ title: 'No volunteers selected', content: 'Please select volunteers to bulk assign.' });

    // detect conflicts per volunteer
    const conflicts = [];
    const toAssign = [];
    volObjs.forEach(v => {
      const conflict = detectConflictFor(v.id || v.name || v.email, dateStr, slotObj);
      if (conflict && conflict.conflict) conflicts.push({ vol: v, conflict });
      toAssign.push(v);
    });

    if (conflicts.length) {
      const list = conflicts.map(c => `<div><strong>${escapeHtml(c.vol.name)}</strong> — overlapping: ${escapeHtml(c.conflict.existingSlot.label || c.conflict.existingSlot.id)}</div>`).join('');
      openModal({
        title: 'Conflicts detected',
        content: `<p>The following volunteers appear double-booked on ${escapeHtml(dateStr)}:</p>${list}<p>Assign all selected volunteers anyway?</p>`,
        showConfirm: true,
        confirmText: 'Assign anyway',
        onConfirm: () => {
          toAssign.forEach(v => addAssignment(makeBooking(v, location, slotObj, dateStr)));
          buildAssignmentsUI();
        }
      });
    } else {
      // proceed quietly
      toAssign.forEach(v => addAssignment(makeBooking(v, location, slotObj, dateStr)));
      buildAssignmentsUI();
    }
  }

  /* -------------------------
     Make booking object (assignment)
     ------------------------- */
  function makeBooking(vol, location, slotObj, dateStr) {
    return {
      id: uid('bk-'),
      username: vol.email || vol.id || (vol.name || '').toLowerCase().replace(/\s+/g, '.'),
      displayName: vol.name || vol.email || 'Volunteer',
      volunteerId: vol.id || null,
      role: vol.role || 'volunteer',
      locationId: location.id,
      locationName: location.name,
      date: dateStr,
      slotId: slotObj.id,
      slotLabel: slotObj.label,
      startHour: slotObj.startHour,
      endHour: slotObj.endHour,
      createdAt: Date.now()
    };
  }

  /* -------------------------
     Quick "Add volunteer" modal (delegates to AdminVolunteers if present)
     ------------------------- */
  function openAddVolunteerModal() {
    if (window.AdminVolunteers && typeof window.AdminVolunteers.init === 'function') {
      // if AdminVolunteers exports a modal or method, simply trigger its Add button event by dispatch
      // fallback to showing its add form via creating a click on its button if exists
      const addBtn = document.getElementById('add-volunteer-btn');
      if (addBtn) { addBtn.click(); return; }
    }
    // otherwise show a minimal form
    const form = document.createElement('form');
    form.style.display = 'grid';
    form.style.gap = '0.5rem';
    ['Full name', 'Email', 'Phone', 'Congregation'].forEach((labelText, i) => {
      const row = document.createElement('div'); row.className = 'form-row';
      const label = document.createElement('label'); label.textContent = labelText;
      const input = document.createElement('input'); input.type = i === 1 ? 'email' : 'text';
      input.name = labelText.toLowerCase().replace(/\s+/g, '-');
      row.appendChild(label);
      row.appendChild(input);
      form.appendChild(row);
    });
    openModal({
      title: 'Add volunteer',
      content: form,
      showConfirm: true,
      confirmText: 'Add',
      onConfirm: () => {
        const inputs = form.querySelectorAll('input');
        const name = inputs[0].value.trim();
        const email = inputs[1].value.trim();
        const phone = inputs[2].value.trim();
        const congregation = inputs[3].value.trim();
        if (!name) return openModal({ title: 'Validation', content: 'Name is required.' });
        const vols = loadVolunteers();
        const newVol = { id: 'vol-' + uid(), name, email, phone, congregation, notes: '', createdAt: Date.now(), updatedAt: Date.now() };
        vols.push(newVol);
        try { localStorage.setItem(LS_VOLUNTEERS, JSON.stringify(vols)); } catch (err) { console.error(err); }
        // re-render UI
        buildAssignmentsUI();
      }
    });
  }

  /* -------------------------
     Initialize UI on DOM
     ------------------------- */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildAssignmentsUI);
    } else {
      buildAssignmentsUI();
    }

    // listen to updates from other modules
    document.addEventListener('cvsa:volunteers:updated', () => buildAssignmentsUI());
    document.addEventListener('cvsa:locations:updated', () => buildAssignmentsUI());
    document.addEventListener('cvsa:schedules:updated', () => buildAssignmentsUI());
  }

  // Expose API
  window.AdminAssignments = {
    init,
    buildAssignmentsUI,
    getAssignmentsForCell,
    addAssignment,
    removeAssignmentById,
    detectConflictFor
  };

  init();

})();