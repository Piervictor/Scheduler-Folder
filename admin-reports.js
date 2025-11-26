/**
 * admin-reports.js
 * Congregation Volunteer Scheduler — Admin Reports
 *
 * Features:
 * - Report by Location: shows volunteers assigned to each location (with attendance status)
 * - Report by Volunteer: shows all assignments per volunteer (with attendance & service hours)
 * - Report by Date Range: filter assignments by date
 * - Export to CSV (Excel-friendly)
 * - Mark no-shows / check-ins (attendance tracking)
 * - Attendance statistics (counts, percentages)
 * - Service hours calculation per booking, per volunteer, per location, and totals
 * - Printable report format (print-friendly window)
 * - All data read/written to localStorage:
 *     - cvsa_bookings  (assignments/bookings)
 *     - cvsa_volunteers
 *     - cvsa_locations
 *     - cvsa_location_slots (optional; used to get slot times)
 *
 * Integration:
 * - This script expects an Admin > Reports tab panel with id="tab-reports" in index.html.
 * - Uses existing modal elements with ids: modal-backdrop, modal-title, modal-body, modal-confirm, modal-cancel
 * - If AdminSchedules is available, uses AdminSchedules.getSlotsForLocation(locationId) to get slot times.
 * - Persist changes to bookings back to localStorage under "cvsa_bookings".
 *
 * Usage:
 *   Include after other admin scripts:
 *     <script src="admin-reports.js"></script>
 *
 * Notes:
 * - Bookings schema expected (existing modules create):
 *   {
 *     id,
 *     username,
 *     displayName,
 *     volunteerId,        // optional
 *     locationId,
 *     locationName,
 *     date,               // "YYYY-MM-DD"
 *     slotId,
 *     slotLabel,
 *     startHour,          // optional number
 *     endHour,            // optional number
 *     status: "assigned" | "checked-in" | "no-show" | "cancelled",
 *     checkedInAt: timestamp | null,
 *     createdAt: timestamp
 *   }
 *
 * - This is client-side; for production, server-side audit and persistence is required.
 */

(function () {
  const LS_BOOKINGS = 'cvsa_bookings';
  const LS_VOLUNTEERS = 'cvsa_volunteers';
  const LS_LOCATIONS = 'cvsa_locations';
  const LS_SLOTS = 'cvsa_location_slots';

  /* -------------------------
     Storage helpers
     ------------------------- */
  function loadBookings() {
    try { const raw = localStorage.getItem(LS_BOOKINGS); return raw ? JSON.parse(raw) : []; }
    catch (e) { console.error('admin-reports: loadBookings', e); return []; }
  }
  function saveBookings(list) {
    try { localStorage.setItem(LS_BOOKINGS, JSON.stringify(list)); }
    catch (e) { console.error('admin-reports: saveBookings', e); }
  }
  function loadVolunteers() {
    try { const raw = localStorage.getItem(LS_VOLUNTEERS); return raw ? JSON.parse(raw) : []; }
    catch (e) { console.error('admin-reports: loadVolunteers', e); return []; }
  }
  function loadLocations() {
    try {
      if (window.AdminLocations && typeof window.AdminLocations.getLocations === 'function') {
        return window.AdminLocations.getLocations();
      }
      const raw = localStorage.getItem(LS_LOCATIONS); return raw ? JSON.parse(raw) : [];
    } catch (e) { console.error('admin-reports: loadLocations', e); return []; }
  }

  function getSlotsForLocation(locationId) {
    try {
      if (window.AdminSchedules && typeof window.AdminSchedules.getSlotsForLocation === 'function') {
        return window.AdminSchedules.getSlotsForLocation(locationId);
      }
      const raw = localStorage.getItem(LS_SLOTS);
      if (raw) {
        const map = JSON.parse(raw);
        return (map && map[locationId]) ? map[locationId] : null;
      }
    } catch (e) {
      console.warn('admin-reports: getSlotsForLocation error', e);
    }
    return null;
  }

  /* -------------------------
     Utilities
     ------------------------- */
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function formatDate(dateStr) {
    // expects YYYY-MM-DD
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString();
  }
  function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function uid(prefix = '') { return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

  function slotHoursFromBooking(b) {
    // prefer booking.startHour/endHour; else try to find from AdminSchedules
    if (typeof b.startHour === 'number' && typeof b.endHour === 'number') return { start: b.startHour, end: b.endHour };
    const slots = getSlotsForLocation(b.locationId) || [];
    const slot = slots.find(s => s.id === b.slotId) || null;
    if (slot) return { start: Number(slot.startHour || 0), end: Number(slot.endHour || 0) };
    // fallback: try to parse label like "6:00 AM - 8:00 AM" or id "6-8am"
    const m = (b.slotLabel || b.slotId || '').match(/(\d{1,2})(?::\d{2})?\s*(AM|PM)?\s*[-–]\s*(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i);
    if (m) {
      let s = Number(m[1]), e = Number(m[3]);
      const as = (m[2] || '').toUpperCase(), ae = (m[4] || '').toUpperCase();
      if (as === 'PM' && s < 12) s += 12;
      if (ae === 'PM' && e < 12) e += 12;
      return { start: s, end: e };
    }
    // try id like "6-8am"
    const m2 = (b.slotId || '').match(/(\d+)[^\d]+(\d+)/);
    if (m2) return { start: Number(m2[1]), end: Number(m2[2]) };
    return { start: 0, end: 0 };
  }

  function durationHoursFromBooking(b) {
    const h = slotHoursFromBooking(b);
    let dur = (h.end - h.start);
    if (!isFinite(dur) || dur < 0) dur = 0;
    return dur;
  }

  /* -------------------------
     CSV export helper
     ------------------------- */
  function arrayToCSV(rows, columns) {
    // columns: [{ key, label }]
    const header = columns.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(',');
    const lines = rows.map(r => columns.map(c => {
      const v = r[c.key] != null ? String(r[c.key]) : '';
      return `"${v.replace(/"/g, '""')}"`;
    }).join(','));
    return [header].concat(lines).join('\r\n');
  }
  function downloadCSV(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* -------------------------
     Modal helper (uses existing modal)
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
    const { title = '', content = '', showConfirm = false, confirmText = 'Confirm', onConfirm = null, onClose = null } = options;
    const { backdrop, title: mtitle, body: mbody, confirm, cancel } = findModalEls();
    if (backdrop && mtitle && mbody) {
      mtitle.innerHTML = escapeHtml(title);
      if (typeof content === 'string') mbody.innerHTML = content;
      else { mbody.innerHTML = ''; mbody.appendChild(content); }
      if (confirm) {
        confirm.textContent = confirmText;
        confirm.style.display = showConfirm ? 'inline-block' : 'none';
        confirm.onclick = () => { if (onConfirm) onConfirm(); close(); };
      }
      if (cancel) { cancel.style.display = 'inline-block'; cancel.onclick = close; }
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
     Render Reports UI
     ------------------------- */
  function renderReportsUI() {
    const panel = document.getElementById('tab-reports');
    if (!panel) {
      console.warn('admin-reports: #tab-reports not found');
      return;
    }

    panel.innerHTML = ''; // clear existing content

    // Controls
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '0.6rem';
    controls.style.alignItems = 'center';
    controls.style.marginBottom = '0.8rem';

    const fromLabel = document.createElement('label'); fromLabel.textContent = 'From:';
    const fromInput = document.createElement('input'); fromInput.type = 'date'; fromInput.id = 'report-from';
    const toLabel = document.createElement('label'); toLabel.textContent = 'To:';
    const toInput = document.createElement('input'); toInput.type = 'date'; toInput.id = 'report-to';

    const typeSelect = document.createElement('select'); typeSelect.id = 'report-type';
    ['location', 'volunteer', 'date-range'].forEach(v => {
      const o = document.createElement('option'); o.value = v;
      o.textContent = v === 'location' ? 'Report by Location' : v === 'volunteer' ? 'Report by Volunteer' : 'Report by Date Range';
      typeSelect.appendChild(o);
    });

    const genBtn = document.createElement('button'); genBtn.textContent = 'Generate'; genBtn.className = 'success';
    const exportBtn = document.createElement('button'); exportBtn.textContent = 'Export CSV'; exportBtn.className = 'muted-btn';
    const printBtn = document.createElement('button'); printBtn.textContent = 'Print'; printBtn.className = 'muted-btn';

    controls.appendChild(fromLabel);
    controls.appendChild(fromInput);
    controls.appendChild(toLabel);
    controls.appendChild(toInput);
    controls.appendChild(typeSelect);
    controls.appendChild(genBtn);
    controls.appendChild(exportBtn);
    controls.appendChild(printBtn);

    panel.appendChild(controls);

    // Stats summary area
    const statsArea = document.createElement('div');
    statsArea.id = 'reports-stats';
    statsArea.className = 'card';
    statsArea.style.marginBottom = '0.8rem';
    panel.appendChild(statsArea);

    // Report results area
    const results = document.createElement('div');
    results.id = 'reports-results';
    panel.appendChild(results);

    // Default date range: this week
    const today = new Date();
    const prior = new Date(today);
    prior.setDate(today.getDate() - 7);
    fromInput.value = toISODate(prior);
    toInput.value = toISODate(today);

    // Button actions
    genBtn.addEventListener('click', () => {
      const from = fromInput.value;
      const to = toInput.value;
      const type = typeSelect.value;
      generateReport(type, from, to);
    });

    exportBtn.addEventListener('click', () => {
      const type = typeSelect.value;
      const from = fromInput.value;
      const to = toInput.value;
      exportCurrentReport(type, from, to);
    });

    printBtn.addEventListener('click', () => {
      const type = typeSelect.value;
      const from = fromInput.value;
      const to = toInput.value;
      printReport(type, from, to);
    });

    // initial generate
    generateReport(typeSelect.value, fromInput.value, toInput.value);
  }

  function toISODate(d) {
    if (!(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* -------------------------
     Report Generators
     ------------------------- */
  function generateReport(type, from, to) {
    const results = qs('#reports-results');
    const statsArea = qs('#reports-stats');
    results.innerHTML = '';
    statsArea.innerHTML = '';

    // normalize date filters
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;

    const bookings = loadBookings().filter(b => {
      if (!b || !b.date) return false;
      const d = parseDate(b.date);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    // compute attendance stats and service hours totals
    const totalAssignments = bookings.length;
    const checkedIn = bookings.filter(b => b.status === 'checked-in').length;
    const noShows = bookings.filter(b => b.status === 'no-show').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    const assigned = bookings.filter(b => !b.status || b.status === 'assigned').length;
    const totalHours = bookings.reduce((acc, b) => acc + durationHoursFromBooking(b), 0);

    // stats card
    statsArea.innerHTML = `
      <div style="display:flex; gap:1rem; align-items:center;">
        <div><strong>Total assignments:</strong> ${totalAssignments}</div>
        <div><strong>Checked in:</strong> ${checkedIn}</div>
        <div><strong>No-shows:</strong> ${noShows}</div>
        <div><strong>Cancelled:</strong> ${cancelled}</div>
        <div><strong>Pending:</strong> ${assigned}</div>
        <div><strong>Service hours total:</strong> ${totalHours.toFixed(2)} h</div>
      </div>
    `;

    if (type === 'location') {
      renderReportByLocation(bookings, results);
    } else if (type === 'volunteer') {
      renderReportByVolunteer(bookings, results);
    } else {
      renderReportByDateRange(bookings, results);
    }
  }

  function renderReportByLocation(bookings, container) {
    const locations = loadLocations();
    const volMap = loadVolunteers().reduce((m, v) => { m[v.id] = v; return m; }, {});
    // group by location
    const byLoc = {};
    bookings.forEach(b => {
      const lid = b.locationId || 'unknown';
      if (!byLoc[lid]) byLoc[lid] = [];
      byLoc[lid].push(b);
    });

    container.innerHTML = '';
    locations.forEach(loc => {
      const list = byLoc[loc.id] || [];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '0.6rem';
      const assignmentCount = list.length;
      const hours = list.reduce((a, bk) => a + durationHoursFromBooking(bk), 0);
      const checked = list.filter(bk => bk.status === 'checked-in').length;
      const noshow = list.filter(bk => bk.status === 'no-show').length;
      card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 style="margin:0">${escapeHtml(loc.name)} <span class="small muted">(${assignmentCount} assignments)</span></h4>
            <div class="small muted">${escapeHtml(loc.address || '')} · Service hours total: ${hours.toFixed(2)} h</div>
          </div>
          <div class="small">Checked-in: ${checked} · No-shows: <span style="color:${noshow ? '#b91c1c' : 'inherit'}">${noshow}</span></div>
        </div>`;

      // assignments table per location
      const tbl = document.createElement('table');
      tbl.style.marginTop = '0.6rem';
      tbl.innerHTML = `<thead><tr><th>Date</th><th>Time</th><th>Volunteer</th><th>Congregation</th><th>Status</th><th>Hours</th><th>Actions</th></tr></thead>`;
      const tbody = document.createElement('tbody');

      list.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(bk => {
        const vol = volMap[bk.volunteerId] || loadVolunteers().find(v => (v.email || '').toLowerCase() === (bk.username || '').toLowerCase()) || { name: bk.displayName || bk.username, congregation: '' };
        const dur = durationHoursFromBooking(bk);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(bk.date)}</td>
                        <td>${escapeHtml(bk.slotLabel || bk.slotId || '')}</td>
                        <td>${escapeHtml(vol.name || bk.displayName || bk.username)}</td>
                        <td class="small muted">${escapeHtml(vol.congregation || '')}</td>
                        <td>${renderStatusBadge(bk.status)}</td>
                        <td>${dur.toFixed(2)}</td>
                        <td></td>`;
        const actionsTd = tr.querySelector('td:last-child');

        // actions: check-in, mark no-show, remove
        const checkBtn = document.createElement('button'); checkBtn.className = 'success'; checkBtn.textContent = 'Check in';
        checkBtn.style.marginRight = '0.4rem';
        checkBtn.addEventListener('click', () => {
          bk.status = 'checked-in';
          bk.checkedInAt = Date.now();
          saveBookingUpdate(bk);
          generateReport('location', qs('#report-from').value, qs('#report-to').value);
        });

        const noshowBtn = document.createElement('button'); noshowBtn.className = 'danger'; noshowBtn.textContent = 'No-show';
        noshowBtn.style.marginRight = '0.4rem';
        noshowBtn.addEventListener('click', () => {
          bk.status = 'no-show';
          saveBookingUpdate(bk);
          generateReport('location', qs('#report-from').value, qs('#report-to').value);
        });

        const removeBtn = document.createElement('button'); removeBtn.className = 'muted-btn'; removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
          openConfirmModal(`Remove assignment`, `Remove ${escapeHtml(vol.name || bk.displayName)} from ${escapeHtml(loc.name)} ${escapeHtml(bk.slotLabel || '')} on ${escapeHtml(bk.date)}?`, () => {
            removeBookingById(bk.id);
            generateReport('location', qs('#report-from').value, qs('#report-to').value);
          });
        });

        // disable check-in if already checked-in; color no-show button if already no-show
        if (bk.status === 'checked-in') { checkBtn.disabled = true; }
        if (bk.status === 'no-show') { noshowBtn.style.opacity = '0.7'; }

        actionsTd.appendChild(checkBtn);
        actionsTd.appendChild(noshowBtn);
        actionsTd.appendChild(removeBtn);

        tbody.appendChild(tr);
      });

      tbl.appendChild(tbody);
      card.appendChild(tbl);
      container.appendChild(card);
    });

    // Location entries for which there are bookings but not in locations list
    const knownLocIds = new Set(loadLocations().map(l => l.id));
    const extraLocs = Object.keys(bookings.reduce((m, b) => { if (b && b.locationId && !knownLocIds.has(b.locationId)) m[b.locationId] = true; return m; }, {}));
    if (extraLocs.length) {
      const unknownCard = document.createElement('div');
      unknownCard.className = 'card';
      unknownCard.innerHTML = `<h4>Other locations</h4>`;
      extraLocs.forEach(lid => {
        const list = bookings.filter(b => b.locationId === lid);
        const tbl = document.createElement('table');
        tbl.innerHTML = `<thead><tr><th>Date</th><th>Time</th><th>Volunteer</th><th>Status</th><th>Hours</th></tr></thead>`;
        const tb = document.createElement('tbody');
        list.forEach(bk => {
          tb.innerHTML += `<tr><td>${escapeHtml(bk.date)}</td><td>${escapeHtml(bk.slotLabel)}</td><td>${escapeHtml(bk.displayName || bk.username)}</td><td>${renderStatusBadge(bk.status)}</td><td>${durationHoursFromBooking(bk).toFixed(2)}</td></tr>`;
        });
        tbl.appendChild(tb);
        unknownCard.appendChild(tbl);
      });
      container.appendChild(unknownCard);
    }
  }

  function renderReportByVolunteer(bookings, container) {
    const volunteers = loadVolunteers();
    const locMap = loadLocations().reduce((m, l) => { m[l.id] = l; return m; }, {});
    // group by volunteerId or displayName
    const byVol = {};
    bookings.forEach(b => {
      const vid = b.volunteerId || (b.username ? 'usr:' + b.username : 'anon');
      if (!byVol[vid]) byVol[vid] = [];
      byVol[vid].push(b);
    });

    container.innerHTML = '';
    // ensure we present known volunteers first
    volunteers.forEach(vol => {
      const list = byVol[vol.id] || [];
      if (!list.length) return;
      const card = document.createElement('div'); card.className = 'card'; card.style.marginBottom = '0.6rem';
      const totalHours = list.reduce((a, b) => a + durationHoursFromBooking(b), 0);
      const checked = list.filter(b => b.status === 'checked-in').length;
      const noshow = list.filter(b => b.status === 'no-show').length;
      card.innerHTML = `<div style="display:flex; justify-content:space-between;">
          <div><h4 style="margin:0">${escapeHtml(vol.name)} <span class="small muted">(${escapeHtml(vol.congregation || '')})</span></h4>
            <div class="small muted">${escapeHtml(vol.email || '')} · ${escapeHtml(vol.phone || '')}</div></div>
          <div class="small">Hours: ${totalHours.toFixed(2)} · Checked-in: ${checked} · No-shows: <span style="color:${noshow ? '#b91c1c' : 'inherit'}">${noshow}</span></div>
        </div>`;
      const tbl = document.createElement('table'); tbl.style.marginTop = '0.6rem';
      tbl.innerHTML = `<thead><tr><th>Date</th><th>Location</th><th>Time</th><th>Status</th><th>Hours</th><th>Actions</th></tr></thead>`;
      const tbody = document.createElement('tbody');
      list.sort((a, b) => a.date.localeCompare(b.date)).forEach(bk => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(bk.date)}</td>
                        <td>${escapeHtml((locMap[bk.locationId] && locMap[bk.locationId].name) || bk.locationName || '')}</td>
                        <td>${escapeHtml(bk.slotLabel || '')}</td>
                        <td>${renderStatusBadge(bk.status)}</td>
                        <td>${durationHoursFromBooking(bk).toFixed(2)}</td>
                        <td></td>`;
        const actionsTd = tr.querySelector('td:last-child');
        const checkBtn = document.createElement('button'); checkBtn.className = 'success'; checkBtn.textContent = 'Check in';
        checkBtn.addEventListener('click', () => { bk.status = 'checked-in'; bk.checkedInAt = Date.now(); saveBookingUpdate(bk); generateReport('volunteer', qs('#report-from').value, qs('#report-to').value); });
        const noshowBtn = document.createElement('button'); noshowBtn.className = 'danger'; noshowBtn.textContent = 'No-show';
        noshowBtn.addEventListener('click', () => { bk.status = 'no-show'; saveBookingUpdate(bk); generateReport('volunteer', qs('#report-from').value, qs('#report-to').value); });
        const removeBtn = document.createElement('button'); removeBtn.className = 'muted-btn'; removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeBookingByIdConfirmation(bk.id));
        actionsTd.appendChild(checkBtn); actionsTd.appendChild(noshowBtn); actionsTd.appendChild(removeBtn);
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      card.appendChild(tbl);
      container.appendChild(card);
      // remove from map so we don't re-render below
      delete byVol[vol.id];
    });

    // Render remaining bookings tied to unknown volunteers (group by username/displayName)
    Object.keys(byVol).forEach(key => {
      const list = byVol[key];
      if (!list || !list.length) return;
      const card = document.createElement('div'); card.className = 'card'; card.style.marginBottom = '0.6rem';
      const identifier = list[0].displayName || list[0].username || key;
      const totalHours = list.reduce((a, b) => a + durationHoursFromBooking(b), 0);
      card.innerHTML = `<div style="display:flex; justify-content:space-between;">
          <div><h4 style="margin:0">${escapeHtml(identifier)}</h4></div>
          <div class="small">Hours: ${totalHours.toFixed(2)}</div>
        </div>`;
      const tbl = document.createElement('table'); tbl.style.marginTop = '0.6rem';
      tbl.innerHTML = `<thead><tr><th>Date</th><th>Location</th><th>Time</th><th>Status</th><th>Hours</th></tr></thead>`;
      const tbody = document.createElement('tbody');
      list.forEach(bk => {
        tbody.innerHTML += `<tr><td>${escapeHtml(bk.date)}</td><td>${escapeHtml(bk.locationName || '')}</td><td>${escapeHtml(bk.slotLabel || '')}</td><td>${renderStatusBadge(bk.status)}</td><td>${durationHoursFromBooking(bk).toFixed(2)}</td></tr>`;
      });
      tbl.appendChild(tbody);
      card.appendChild(tbl);
      container.appendChild(card);
    });
  }

  function renderReportByDateRange(bookings, container) {
    // Simple flat table of bookings in date range
    const vols = loadVolunteers().reduce((m, v) => { m[v.id] = v; return m; }, {});
    const locs = loadLocations().reduce((m, l) => { m[l.id] = l; return m; }, {});
    container.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.innerHTML = `<thead><tr>
      <th>Date</th><th>Location</th><th>Time</th><th>Volunteer</th><th>Congregation</th><th>Status</th><th>Hours</th><th>Actions</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');
    bookings.sort((a, b) => a.date.localeCompare(b.date)).forEach(bk => {
      const vol = vols[bk.volunteerId] || loadVolunteers().find(v => (v.email || '').toLowerCase() === (bk.username || '').toLowerCase()) || { name: bk.displayName || bk.username, congregation: '' };
      const loc = locs[bk.locationId] || { name: bk.locationName || '' };
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(bk.date)}</td><td>${escapeHtml(loc.name)}</td><td>${escapeHtml(bk.slotLabel || '')}</td><td>${escapeHtml(vol.name)}</td><td class="small muted">${escapeHtml(vol.congregation || '')}</td><td>${renderStatusBadge(bk.status)}</td><td>${durationHoursFromBooking(bk).toFixed(2)}</td><td></td>`;
      const actionsTd = tr.querySelector('td:last-child');
      const checkBtn = document.createElement('button'); checkBtn.className = 'success'; checkBtn.textContent = 'Check in';
      checkBtn.addEventListener('click', () => { bk.status = 'checked-in'; bk.checkedInAt = Date.now(); saveBookingUpdate(bk); generateReport(qs('#report-type').value, qs('#report-from').value, qs('#report-to').value); });
      const noshowBtn = document.createElement('button'); noshowBtn.className = 'danger'; noshowBtn.textContent = 'No-show';
      noshowBtn.addEventListener('click', () => { bk.status = 'no-show'; saveBookingUpdate(bk); generateReport(qs('#report-type').value, qs('#report-from').value, qs('#report-to').value); });
      const removeBtn = document.createElement('button'); removeBtn.className = 'muted-btn'; removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeBookingByIdConfirmation(bk.id));
      actionsTd.appendChild(checkBtn); actionsTd.appendChild(noshowBtn); actionsTd.appendChild(removeBtn);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    container.appendChild(tbl);
  }

  function renderStatusBadge(status) {
    if (!status || status === 'assigned') return `<span class="small muted">Assigned</span>`;
    if (status === 'checked-in') return `<span style="color:#065f46; font-weight:700">Checked-in</span>`;
    if (status === 'no-show') return `<span style="color:#b91c1c; font-weight:700">No-show</span>`;
    if (status === 'cancelled') return `<span style="color:#6b7280;">Cancelled</span>`;
    return escapeHtml(status);
  }

  /* -------------------------
     Mutations
     ------------------------- */
  function saveBookingUpdate(bk) {
    const all = loadBookings();
    const idx = all.findIndex(x => x.id === bk.id);
    if (idx >= 0) { all[idx] = bk; } else { all.push(bk); }
    saveBookings(all);
  }
  function removeBookingById(id) {
    const all = loadBookings().filter(b => b.id !== id);
    saveBookings(all);
  }
  function removeBookingByIdConfirmation(id) {
    openConfirmModal('Remove assignment', 'Are you sure you want to remove this assignment?', () => {
      removeBookingById(id);
      generateReport(qs('#report-type').value, qs('#report-from').value, qs('#report-to').value);
    });
  }

  function openConfirmModal(title, message, onConfirm) {
    openModal({ title, content: `<div class="small">${escapeHtml(message)}</div>`, showConfirm: true, confirmText: 'Confirm', onConfirm });
  }

  /* -------------------------
     Export and Print
     ------------------------- */
  function exportCurrentReport(type, from, to) {
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;
    const bookings = loadBookings().filter(b => {
      if (!b || !b.date) return false;
      const d = parseDate(b.date);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    if (type === 'location') {
      // rows per assignment with location column
      const cols = [
        { key: 'location', label: 'Location' },
        { key: 'date', label: 'Date' },
        { key: 'time', label: 'Time' },
        { key: 'volunteer', label: 'Volunteer' },
        { key: 'congregation', label: 'Congregation' },
        { key: 'status', label: 'Status' },
        { key: 'hours', label: 'Hours' }
      ];
      const vols = loadVolunteers().reduce((m, v) => { m[v.id] = v; return m; }, {});
      const locs = loadLocations().reduce((m, l) => { m[l.id] = l; return m; }, {});
      const rows = bookings.map(b => {
        const vol = vols[b.volunteerId] || loadVolunteers().find(v => (v.email||'').toLowerCase() === (b.username||'').toLowerCase()) || {};
        const loc = locs[b.locationId] || {};
        return {
          location: loc.name || b.locationName || b.locationId,
          date: b.date,
          time: b.slotLabel || b.slotId,
          volunteer: vol.name || b.displayName || b.username || '',
          congregation: vol.congregation || '',
          status: b.status || 'assigned',
          hours: durationHoursFromBooking(b).toFixed(2)
        };
      });
      const csv = arrayToCSV(rows, cols);
      downloadCSV(`report_by_location_${from || ''}_${to || ''}.csv`, csv);
    } else if (type === 'volunteer') {
      const cols = [
        { key: 'volunteer', label: 'Volunteer' },
        { key: 'date', label: 'Date' },
        { key: 'location', label: 'Location' },
        { key: 'time', label: 'Time' },
        { key: 'status', label: 'Status' },
        { key: 'hours', label: 'Hours' }
      ];
      const vols = loadVolunteers().reduce((m, v) => { m[v.id] = v; return m; }, {});
      const locs = loadLocations().reduce((m, l) => { m[l.id] = l; return m; }, {});
      const rows = bookings.map(b => {
        const vol = vols[b.volunteerId] || {};
        const loc = locs[b.locationId] || {};
        return {
          volunteer: vol.name || b.displayName || b.username || '',
          date: b.date,
          location: loc.name || b.locationName || '',
          time: b.slotLabel || b.slotId,
          status: b.status || 'assigned',
          hours: durationHoursFromBooking(b).toFixed(2)
        };
      });
      const csv = arrayToCSV(rows, cols);
      downloadCSV(`report_by_volunteer_${from || ''}_${to || ''}.csv`, csv);
    } else {
      // date-range: export flat list
      const cols = [
        { key: 'date', label: 'Date' },
        { key: 'location', label: 'Location' },
        { key: 'time', label: 'Time' },
        { key: 'volunteer', label: 'Volunteer' },
        { key: 'congregation', label: 'Congregation' },
        { key: 'status', label: 'Status' },
        { key: 'hours', label: 'Hours' }
      ];
      const vols = loadVolunteers().reduce((m, v) => { m[v.id] = v; return m; }, {});
      const locs = loadLocations().reduce((m, l) => { m[l.id] = l; return m; }, {});
      const rows = bookings.map(b => {
        const vol = vols[b.volunteerId] || {};
        const loc = locs[b.locationId] || {};
        return {
          date: b.date,
          location: loc.name || b.locationName || b.locationId,
          time: b.slotLabel || b.slotId,
          volunteer: vol.name || b.displayName || b.username || '',
          congregation: vol.congregation || '',
          status: b.status || 'assigned',
          hours: durationHoursFromBooking(b).toFixed(2)
        };
      });
      const csv = arrayToCSV(rows, cols);
      downloadCSV(`report_by_date_${from || ''}_${to || ''}.csv`, csv);
    }
  }

  function printReport(type, from, to) {
    // generate the same HTML as displayed, but in a printable new window with minimal styles
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;
    const bookings = loadBookings().filter(b => {
      if (!b || !b.date) return false;
      const d = parseDate(b.date);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const title = type === 'location' ? 'Report by Location' : type === 'volunteer' ? 'Report by Volunteer' : 'Report by Date Range';
    let html = `<html><head><title>${escapeHtml(title)}</title><meta charset="utf-8" />
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:20px;}
        h1{font-size:18px;margin-bottom:8px;}
        table{width:100%;border-collapse:collapse;margin-bottom:16px;}
        th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:12px;}
        .muted{color:#666;font-size:12px;}
        .no-show{color:#b91c1c;font-weight:700;}
        .checked{color:#065f46;font-weight:700;}
        @media print{ button{display:none} }
      </style></head><body>`;
    html += `<h1>${escapeHtml(title)}</h1>`;
    html += `<div class="muted">Range: ${escapeHtml(from || '')} → ${escapeHtml(to || '')}</div>`;

    if (type === 'location') {
      const locs = loadLocations();
      const locMap = locs.reduce((m, l) => { m[l.id] = l; return m; }, {});
      locs.forEach(loc => {
        const list = bookings.filter(b => b.locationId === loc.id);
        if (!list.length) return;
        html += `<h2>${escapeHtml(loc.name)} — ${list.length} assignments</h2>`;
        html += '<table><thead><tr><th>Date</th><th>Time</th><th>Volunteer</th><th>Status</th><th>Hours</th></tr></thead><tbody>';
        list.sort((a, b) => a.date.localeCompare(b.date)).forEach(bk => {
          html += `<tr><td>${escapeHtml(bk.date)}</td><td>${escapeHtml(bk.slotLabel || '')}</td><td>${escapeHtml(bk.displayName || bk.username || '')}</td><td>${escapeHtml(bk.status || 'assigned')}</td><td>${durationHoursFromBooking(bk).toFixed(2)}</td></tr>`;
        });
        html += '</tbody></table>';
      });
    } else if (type === 'volunteer') {
      const vols = loadVolunteers();
      vols.forEach(vol => {
        const list = bookings.filter(b => b.volunteerId === vol.id || (b.username && b.username.toLowerCase() === (vol.email||'').toLowerCase()) || (b.displayName && b.displayName === vol.name));
        if (!list.length) return;
        html += `<h2>${escapeHtml(vol.name)} (${escapeHtml(vol.congregation || '')}) — ${list.length} assignments</h2>`;
        html += '<table><thead><tr><th>Date</th><th>Location</th><th>Time</th><th>Status</th><th>Hours</th></tr></thead><tbody>';
        list.forEach(bk => {
          html += `<tr><td>${escapeHtml(bk.date)}</td><td>${escapeHtml(bk.locationName || '')}</td><td>${escapeHtml(bk.slotLabel || '')}</td><td>${escapeHtml(bk.status || '')}</td><td>${durationHoursFromBooking(bk).toFixed(2)}</td></tr>`;
        });
        html += '</tbody></table>';
      });
    } else {
      // date range flat
      html += '<table><thead><tr><th>Date</th><th>Location</th><th>Time</th><th>Volunteer</th><th>Status</th><th>Hours</th></tr></thead><tbody>';
      bookings.forEach(bk => {
        html += `<tr><td>${escapeHtml(bk.date)}</td><td>${escapeHtml(bk.locationName || '')}</td><td>${escapeHtml(bk.slotLabel || '')}</td><td>${escapeHtml(bk.displayName || bk.username || '')}</td><td>${escapeHtml(bk.status || '')}</td><td>${durationHoursFromBooking(bk).toFixed(2)}</td></tr>`;
      });
      html += '</tbody></table>';
    }

    html += `<div class="muted">Generated: ${new Date().toLocaleString()}</div>`;
    html += '</body></html>';

    const w = window.open('', '_blank', 'noopener');
    if (!w) return alert('Unable to open print window (popup blocked?)');
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // optional: wait a bit and call print
    setTimeout(() => { w.print(); }, 300);
  }

  /* -------------------------
     Helpers used by report UI
     ------------------------- */
  function renderReportsInit() {
    renderReportsUI();
    // listen to bookings updates to refresh
    document.addEventListener('cvsa:bookings:updated', () => {
      generateReport(qs('#report-type') ? qs('#report-type').value : 'location', qs('#report-from') ? qs('#report-from').value : '', qs('#report-to') ? qs('#report-to').value : '');
    });
  }

  /* -------------------------
     Helper CRUD wrappers and event triggers
     ------------------------- */
  function removeBookingById(id) {
    const all = loadBookings().filter(b => b.id !== id);
    saveBookings(all);
    // notify
    document.dispatchEvent(new Event('cvsa:bookings:updated'));
  }

  function saveBookingUpdate(bk) {
    const all = loadBookings();
    const idx = all.findIndex(x => x.id === bk.id);
    if (idx >= 0) { all[idx] = bk; } else { all.push(bk); }
    saveBookings(all);
    document.dispatchEvent(new Event('cvsa:bookings:updated'));
  }

  /* -------------------------
     Initialize on DOM ready
     ------------------------- */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderReportsInit);
    } else {
      renderReportsInit();
    }
  }

  // Expose API for testing
  window.AdminReports = {
    init,
    generateReport,
    exportCurrentReport,
    printReport,
    saveBookingUpdate,
    removeBookingById
  };

  init();
})();