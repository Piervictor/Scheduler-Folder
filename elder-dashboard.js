/**
 * elder-dashboard.js
 * Congregation Volunteer Scheduler — Elder Dashboard (read-only)
 *
 * Responsibilities:
 * - Show volunteers for the elder's congregation only (if session.congregation provided).
 * - If session.congregation is not provided, show a congregation selector but emphasize read-only scope.
 * - Display attendance summary (checked-in, no-shows, cancelled, pending).
 * - Show service hours per volunteer (sum of slot durations from bookings).
 * - Show participation metrics (total shifts, shifts in last 30/90 days).
 * - List all shifts (bookings) for volunteers in the selected congregation.
 * - Filter by date range and volunteer name.
 * - Printable report format (opens a print window).
 * - All data read-only; no edit/delete controls are provided.
 * - Data sources: localStorage keys cvsa_session, cvsa_volunteers, cvsa_bookings, cvsa_locations, cvsa_location_slots
 *
 * Usage:
 * - Include this file after your HTML (after other admin scripts). It expects an element with id="elder-dashboard"
 *   in the page (the base template already includes it).
 *
 * Note:
 * - This module is intentionally read-only. It will not modify any localStorage data.
 */

(function () {
  const LS = {
    SESSION: 'cvsa_session',
    VOLUNTEERS: 'cvsa_volunteers',
    BOOKINGS: 'cvsa_bookings',
    LOCATIONS: 'cvsa_locations',
    SLOTS: 'cvsa_location_slots'
  };

  /* -------------------------
     Utilities
     ------------------------- */
  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('elder-dashboard: load error', key, e);
      return null;
    }
  }

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from((root || document).querySelectorAll(sel)); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function parseDate(dateStr) {
    if (!dateStr) return null;
    const [y,m,d] = dateStr.split('-').map(Number);
    return new Date(y,m-1,d);
  }
  function toISODate(d) {
    if (!(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  // Heuristic to determine slot start/end hours from booking (same approach as other modules)
  function slotHoursFromBooking(b) {
    if (!b) return { start:0, end:0 };
    if (typeof b.startHour === 'number' && typeof b.endHour === 'number') return { start: b.startHour, end: b.endHour };
    // try to find from per-location slots (AdminSchedules)
    try {
      if (window.AdminSchedules && typeof window.AdminSchedules.getSlotsForLocation === 'function') {
        const slots = window.AdminSchedules.getSlotsForLocation(b.locationId) || [];
        const s = slots.find(x => x.id === b.slotId) || null;
        if (s) return { start: Number(s.startHour||0), end: Number(s.endHour||0) };
      }
    } catch (e) { /* ignore */ }
    // parse label "6:00 AM - 8:00 AM" or id "6-8am"
    const m = (b.slotLabel || b.slotId || '').match(/(\d{1,2})(?::\d{2})?\s*(AM|PM)?\s*[-–]\s*(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i);
    if (m) {
      let s = Number(m[1]), e = Number(m[3]);
      const as = (m[2] || '').toUpperCase(), ae = (m[4] || '').toUpperCase();
      if (as === 'PM' && s < 12) s += 12;
      if (ae === 'PM' && e < 12) e += 12;
      return { start: s, end: e };
    }
    const m2 = (b.slotId || '').match(/(\d+)[^\d]+(\d+)/);
    if (m2) return { start: Number(m2[1]), end: Number(m2[2]) };
    return { start: 0, end: 0 };
  }
  function durationHoursFromBooking(b) {
    const { start, end } = slotHoursFromBooking(b);
    const dur = Number(end) - Number(start);
    return isFinite(dur) && dur > 0 ? dur : 0;
  }

  /* -------------------------
     Data queries
     ------------------------- */
  function getSession() { return loadJSON(LS.SESSION) || {}; }
  function getVolunteers() { return loadJSON(LS.VOLUNTEERS) || []; }
  function getBookings() { return loadJSON(LS.BOOKINGS) || []; }
  function getLocations() { return loadJSON(LS.LOCATIONS) || []; }

  function uniqueCongregationsFromVolunteers() {
    const vols = getVolunteers();
    const set = new Set();
    vols.forEach(v => { if (v.congregation) set.add(String(v.congregation).trim()); });
    return Array.from(set).sort();
  }

  /* -------------------------
     Rendering: main view
     ------------------------- */
  function renderElderDashboard() {
    const root = document.getElementById('elder-dashboard');
    if (!root) {
      console.warn('elder-dashboard: #elder-dashboard not found');
      return;
    }

    // Clear current dynamic content (we will rebuild header area and results)
    // Keep the original card at top if present; we'll append controls and results below it
    root.querySelectorAll('.elder-controls, .elder-results').forEach(n => n.remove());

    // Controls area
    const controls = document.createElement('div');
    controls.className = 'elder-controls card';
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '0.6rem';
    controls.style.marginTop = '0.8rem';

    const session = getSession();
    const elderCongregation = session.congregation ? String(session.congregation).trim() : null;

    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '0.5rem';
    row1.style.alignItems = 'center';

    // Only show congregation selector if elder doesn't have assigned congregation
    const congLabel = document.createElement('label'); 
    const congSelect = document.createElement('select'); congSelect.id = 'elder-congregation';
    congSelect.style.minWidth = '220px';
    const congregations = uniqueCongregationsFromVolunteers();
    
    if (elderCongregation) {
      // Elder has assigned congregation - show as read-only text
      congLabel.textContent = 'Congregation:';
      const congDisplay = document.createElement('strong');
      congDisplay.textContent = elderCongregation;
      congDisplay.style.padding = '0.3rem 0.6rem';
      congDisplay.style.backgroundColor = '#f0f9ff';
      congDisplay.style.borderRadius = '4px';
      congDisplay.style.color = '#0c4a6e';
      // Create hidden select for consistency with filter logic
      const opt = document.createElement('option'); 
      opt.value = elderCongregation; 
      opt.textContent = elderCongregation; 
      congSelect.appendChild(opt);
      congSelect.style.display = 'none';
      row1.appendChild(congLabel);
      row1.appendChild(congDisplay);
      row1.appendChild(congSelect);
    } else {
      // No assigned congregation - allow selection
      congLabel.textContent = 'Congregation:';
      const allOpt = document.createElement('option'); allOpt.value = ''; allOpt.textContent = '-- select congregation --';
      congSelect.appendChild(allOpt);
      congregations.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c; congSelect.appendChild(opt);
      });
      // if only one congregation present, preselect it
      if (congregations.length === 1) congSelect.value = congregations[0];
      row1.appendChild(congLabel);
      row1.appendChild(congSelect);
    }

    const fromLabel = document.createElement('label'); fromLabel.textContent = 'From:';
    const fromInput = document.createElement('input'); fromInput.type = 'date'; fromInput.id = 'elder-from';
    const toLabel = document.createElement('label'); toLabel.textContent = 'To:';
    const toInput = document.createElement('input'); toInput.type = 'date'; toInput.id = 'elder-to';

    // default date range: last 30 days
    const today = new Date();
    toInput.value = toISODate(today);
    const prior = new Date(today); prior.setDate(today.getDate() - 30);
    fromInput.value = toISODate(prior);

    const filterBtn = document.createElement('button'); filterBtn.className = 'muted-btn'; filterBtn.textContent = 'Filter';
    filterBtn.addEventListener('click', () => updateElderResults());

    const printBtn = document.createElement('button'); printBtn.className = 'muted-btn'; printBtn.textContent = 'Print report';
    printBtn.addEventListener('click', () => printElderReport());

    // Only append if not already appended above
    if (!elderCongregation) {
      // These were not appended in the else block above
    }
    row1.appendChild(fromLabel);
    row1.appendChild(fromInput);
    row1.appendChild(toLabel);
    row1.appendChild(toInput);
    row1.appendChild(filterBtn);
    row1.appendChild(printBtn);

    // quick search by volunteer name
    const row2 = document.createElement('div');
    row2.style.display = 'flex';
    row2.style.gap = '0.5rem';
    row2.style.alignItems = 'center';
    const searchLabel = document.createElement('label'); searchLabel.textContent = 'Volunteer search:';
    const searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.id = 'elder-search'; searchInput.placeholder = 'Search by name or email';
    searchInput.style.flex = '1';
    searchInput.addEventListener('input', () => updateElderResults());
    row2.appendChild(searchLabel);
    row2.appendChild(searchInput);

    controls.appendChild(row1);
    controls.appendChild(row2);

    // Add info note if elder has assigned congregation
    if (elderCongregation) {
      const infoNote = document.createElement('div');
      infoNote.className = 'small';
      infoNote.style.padding = '0.5rem';
      infoNote.style.backgroundColor = '#ecfdf5';
      infoNote.style.borderLeft = '3px solid #059669';
      infoNote.style.borderRadius = '4px';
      infoNote.style.color = '#065f46';
      infoNote.innerHTML = '<strong>ℹ️ Note:</strong> You can only view volunteers and assignments from your congregation: <strong>' + escapeHtml(elderCongregation) + '</strong>';
      controls.appendChild(infoNote);
    }

    root.appendChild(controls);

    // Results area
    const results = document.createElement('div');
    results.className = 'elder-results';
    results.style.display = 'grid';
    results.style.gap = '0.6rem';
    results.style.marginTop = '0.6rem';

    // Summary card
    const summaryCard = document.createElement('div');
    summaryCard.id = 'elder-summary';
    summaryCard.className = 'card';
    results.appendChild(summaryCard);

    // Volunteers card
    const volunteersCard = document.createElement('div');
    volunteersCard.className = 'card';
    volunteersCard.id = 'elder-volunteers';
    results.appendChild(volunteersCard);

    // Shifts list
    const shiftsCard = document.createElement('div');
    shiftsCard.className = 'card';
    shiftsCard.id = 'elder-shifts';
    results.appendChild(shiftsCard);

    root.appendChild(results);

    // initial render
    updateElderResults();
  }

  /* -------------------------
     Compute metrics and render results
     ------------------------- */
  function updateElderResults() {
    const root = document.getElementById('elder-dashboard');
    if (!root) return;
    const session = getSession();
    const elderCongregation = session.congregation ? String(session.congregation).trim() : null;
    const congSelect = qs('#elder-congregation', root);
    const selectedCong = elderCongregation || (congSelect ? congSelect.value : '');
    if (!selectedCong) {
      // show info message
      qs('#elder-summary', root).innerHTML = `<div class="small muted">No congregation selected. Please select a congregation to view its data.</div>`;
      qs('#elder-volunteers', root).innerHTML = '';
      qs('#elder-shifts', root).innerHTML = '';
      return;
    }

    const fromStr = qs('#elder-from', root).value;
    const toStr = qs('#elder-to', root).value;
    const fromDate = fromStr ? parseDate(fromStr) : null;
    const toDate = toStr ? parseDate(toStr) : null;

    // filter volunteers by congregation
    const volunteers = getVolunteers().filter(v => (v.congregation||'').trim() === selectedCong);
    const bookings = getBookings();
    // bookings for volunteers of this congregation (match by volunteerId or username/displayName)
    const volunteerIds = new Set(volunteers.map(v => v.id));
    const volunteerEmails = new Set(volunteers.map(v => (v.email||'').toLowerCase()));
    const volunteerNames = new Set(volunteers.map(v => (v.name||'').toLowerCase()));

    const bookingsForCong = bookings.filter(b => {
      if (!b || !b.date) return false;
      const d = parseDate(b.date);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      // check if booking belongs to one of the congregation volunteers
      if (b.volunteerId && volunteerIds.has(b.volunteerId)) return true;
      if (b.username && volunteerEmails.has((b.username||'').toLowerCase())) return true;
      if (b.displayName && volunteerNames.has((b.displayName||'').toLowerCase())) return true;
      return false;
    });

    // Summary stats
    const totalAssignments = bookingsForCong.length;
    const checkedIn = bookingsForCong.filter(b => b.status === 'checked-in').length;
    const noShows = bookingsForCong.filter(b => b.status === 'no-show').length;
    const cancelled = bookingsForCong.filter(b => b.status === 'cancelled').length;
    const pending = bookingsForCong.filter(b => !b.status || b.status === 'assigned').length;
    const totalServiceHours = bookingsForCong.reduce((acc, b) => acc + durationHoursFromBooking(b), 0);

    const summaryHtml = `
      <div style="display:flex; flex-wrap:wrap; gap:1rem; align-items:center;">
        <div><strong>Congregation:</strong> ${escapeHtml(selectedCong)}</div>
        <div><strong>Assignments:</strong> ${totalAssignments}</div>
        <div><strong>Checked-in:</strong> ${checkedIn}</div>
        <div><strong>No-shows:</strong> <span style="color:${noShows ? '#b91c1c' : 'inherit'}">${noShows}</span></div>
        <div><strong>Cancelled:</strong> ${cancelled}</div>
        <div><strong>Pending:</strong> ${pending}</div>
        <div><strong>Service hours:</strong> ${totalServiceHours.toFixed(2)} h</div>
      </div>
    `;
    qs('#elder-summary', root).innerHTML = summaryHtml;

    // Volunteers list: service hours and participation metrics
    const volsContainer = qs('#elder-volunteers', root);
    volsContainer.innerHTML = `<h3>Volunteers — ${volunteers.length}</h3>`;

    const searchQ = (qs('#elder-search', root) || {}).value || '';
    const q = searchQ.trim().toLowerCase();

    const now = new Date();
    const days30 = new Date(now); days30.setDate(now.getDate() - 30);
    const days90 = new Date(now); days90.setDate(now.getDate() - 90);

    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Name</th><th>Contact</th><th>Service hours (range)</th><th>Total shifts</th><th>Last 30d</th><th>Last 90d</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    volunteers
      .filter(v => {
        if (!q) return true;
        const hay = `${v.name||''} ${v.email||''} ${v.phone||''}`.toLowerCase();
        return hay.indexOf(q) !== -1;
      })
      .sort((a,b) => (a.name||'').localeCompare(b.name||''))
      .forEach(v => {
        // bookings for this volunteer in the selected date range
        const vBookings = bookingsForCong.filter(b => {
          if (b.volunteerId && b.volunteerId === v.id) return true;
          if (b.username && (b.username||'').toLowerCase() === (v.email||'').toLowerCase()) return true;
          if (b.displayName && (b.displayName||'').toLowerCase() === (v.name||'').toLowerCase()) return true;
          return false;
        });

        const totalShifts = vBookings.length;
        const hours = vBookings.reduce((a,bk) => a + durationHoursFromBooking(bk), 0);
        const last30 = vBookings.filter(bk => parseDate(bk.date) >= days30).length;
        const last90 = vBookings.filter(bk => parseDate(bk.date) >= days90).length;

        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="width:220px"><strong>${escapeHtml(v.name)}</strong><div class="small muted">${escapeHtml(v.congregation||'')}</div></td>
                        <td style="width:200px" class="small muted">${escapeHtml(v.email||'')}<br>${escapeHtml(v.phone||'')}</td>
                        <td>${hours.toFixed(2)} h</td>
                        <td>${totalShifts}</td>
                        <td>${last30}</td>
                        <td>${last90}</td>`;
        tbody.appendChild(tr);
      });

    table.appendChild(tbody);
    volsContainer.appendChild(table);

    // Shifts list for the congregation & date range
    const shiftsContainer = qs('#elder-shifts', root);
    shiftsContainer.innerHTML = `<h3>Shifts (${bookingsForCong.length})</h3>`;
    if (!bookingsForCong.length) {
      shiftsContainer.innerHTML += `<div class="small muted">No shifts found for this congregation in the selected range.</div>`;
      return;
    }

    // Table of shifts: Date | Time | Location | Volunteer | Status | Hours
    const shiftsTable = document.createElement('table');
    shiftsTable.innerHTML = `<thead><tr><th>Date</th><th>Time</th><th>Location</th><th>Volunteer</th><th>Status</th><th>Hours</th></tr></thead>`;
    const shiftsBody = document.createElement('tbody');

    // map of locations to names
    const locMap = getLocations().reduce((m,l) => { m[l.id] = l; return m; }, {});

    bookingsForCong
      .slice()
      .sort((a,b) => (a.date||'').localeCompare(b.date||'') || (a.slotId||'').localeCompare(b.slotId||''))
      .forEach(bk => {
        const volunteer = getVolunteers().find(v => (v.id && v.id === bk.volunteerId) || ((v.email||'').toLowerCase() === (bk.username||'').toLowerCase()) || ((v.name||'').toLowerCase() === (bk.displayName||'').toLowerCase()));
        const volDisplay = volunteer ? `${escapeHtml(volunteer.name)} (${escapeHtml(volunteer.congregation||'')})` : escapeHtml(bk.displayName || bk.username || 'Volunteer');
        const loc = locMap[bk.locationId] ? locMap[bk.locationId].name : (bk.locationName || bk.locationId || '');
        const hours = durationHoursFromBooking(bk);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(bk.date)}</td>
                        <td>${escapeHtml(bk.slotLabel || bk.slotId || '')}</td>
                        <td>${escapeHtml(loc)}</td>
                        <td>${volDisplay}</td>
                        <td>${renderStatusReadOnly(bk.status)}</td>
                        <td>${hours.toFixed(2)}</td>`;
        shiftsBody.appendChild(tr);
      });

    shiftsTable.appendChild(shiftsBody);
    shiftsContainer.appendChild(shiftsTable);
  }

  function renderStatusReadOnly(status) {
    if (!status || status === 'assigned') return `<span class="small muted">Assigned</span>`;
    if (status === 'checked-in') return `<span style="color:#065f46; font-weight:700;">Checked-in</span>`;
    if (status === 'no-show') return `<span style="color:#b91c1c; font-weight:700;">No-show</span>`;
    if (status === 'cancelled') return `<span class="small muted">Cancelled</span>`;
    return escapeHtml(status);
  }

  /* -------------------------
     Print-friendly report (opens new window)
     ------------------------- */
  function printElderReport() {
    const root = document.getElementById('elder-dashboard');
    if (!root) return;
    // Compose a clean HTML snapshot of the current results (summary + volunteers + shifts)
    const summaryEl = qs('#elder-summary', root);
    const volsEl = qs('#elder-volunteers', root);
    const shiftsEl = qs('#elder-shifts', root);

    const title = `Elder Report — ${new Date().toLocaleDateString()}`;
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:20px;}
        h1,h2,h3{margin:0 0 8px 0;}
        .muted{color:#666;font-size:12px;}
        table{width:100%;border-collapse:collapse;margin-top:8px;}
        th,td{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left;}
        .card{padding:10px;border:1px solid #eee;margin-bottom:12px;border-radius:6px;}
        @media print{ button{display:none; } }
      </style>
    </head><body>`;

    html += `<h1>${escapeHtml(title)}</h1>`;
    html += `<div class="card">${summaryEl ? summaryEl.innerHTML : ''}</div>`;
    html += `<div class="card"><h2>Volunteers</h2>${volsEl ? volsEl.innerHTML : ''}</div>`;
    html += `<div class="card"><h2>Shifts</h2>${shiftsEl ? shiftsEl.innerHTML : ''}</div>`;
    html += `<div class="muted">Generated: ${new Date().toLocaleString()}</div>`;
    html += '</body></html>';

    const w = window.open('', '_blank', 'noopener');
    if (!w) { alert('Unable to open print window (popup blocked).'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  /* -------------------------
     Initialization: wire up on DOM ready
     ------------------------- */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderElderDashboard);
      document.addEventListener('DOMContentLoaded', () => {
        // attach listeners for dynamic filter updates (delegated)
        const root = document.getElementById('elder-dashboard');
        if (!root) return;
        root.addEventListener('change', (e) => {
          if (e.target && (e.target.id === 'elder-congregation' || e.target.id === 'elder-from' || e.target.id === 'elder-to')) updateElderResults();
        });
        root.addEventListener('input', (e) => {
          if (e.target && e.target.id === 'elder-search') updateElderResults();
        });
      });
    } else {
      renderElderDashboard();
      const root = document.getElementById('elder-dashboard');
      if (root) {
        root.addEventListener('change', (e) => {
          if (e.target && (e.target.id === 'elder-congregation' || e.target.id === 'elder-from' || e.target.id === 'elder-to')) updateElderResults();
        });
        root.addEventListener('input', (e) => {
          if (e.target && e.target.id === 'elder-search') updateElderResults();
        });
      }
    }

    // Refresh when bookings or volunteers change elsewhere
    document.addEventListener('cvsa:bookings:updated', () => updateElderResults());
    document.addEventListener('cvsa:volunteers:updated', () => updateElderResults());
  }

  // Public API (read-only)
  window.ElderDashboard = {
    init,
    render: renderElderDashboard,
    refresh: updateElderResults,
    print: printElderReport
  };

  init();
})();