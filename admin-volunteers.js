/**
 * admin-volunteers.js
 * Congregation Volunteer Scheduler — Admin Volunteer Management
 *
 * Features:
 * - Display list of all volunteers in Admin > Volunteers table (reads/writes cvsa_volunteers)
 * - Add new volunteer (firstName, lastName, congregation, circuit, privilege, email, phone, S-73 approval, seminar attendance, active status, notes) via modal form
 * - Edit volunteer details via modal form
 * - Delete volunteer with confirmation
 * - Import volunteers from CSV file (parses CSV and adds to list, skipping duplicates)
 * - Search/filter volunteers by name, email, phone, congregation, circuit, privilege
 * - Show all volunteer details in comprehensive table
 * - Persist volunteers to localStorage
 *
 * Integration expectations:
 * - Table body with id="volunteers-table-body" in Admin > Volunteers tab (existing template)
 * - "Add Volunteer" button with id="add-volunteer-btn" (existing)
 * - Optional modal elements:
 *     - #modal-backdrop
 *     - #modal-title
 *     - #modal-body
 *     - #modal-confirm
 *     - #modal-cancel
 *   If not present, falls back to prompt/confirm/alert.
 *
 * Notes:
 * - Booking association heuristic: bookings created by volunteer sessions contain booking.displayName and booking.username.
 *   To count shifts assigned to a volunteer record we match booking.displayName === volunteer.name OR
 *   booking.username === volunteer.email OR booking.username === volunteer.name.
 *   This is a best-effort heuristic for demo usage; for production, map volunteers to user accounts/IDs server-side.
 *
 * Usage:
 * - Include after your HTML (after admin-locations.js and volunteer-dashboard.js).
 *     <script src="admin-volunteers.js"></script>
 *
 * - CSV Import format (header row optional). Accepts columns (case-insensitive):
 *     First Name,Last Name,Congregation,Circuit,Privilege,Email Address,Mobile Number,Approved S-73 Form ?,Attended Seminar ?,Active ?
 *
 * Example CSV:
 * First Name,Last Name,Congregation,Circuit,Privilege,Email Address,Mobile Number,Approved S-73 Form ?,Attended Seminar ?,Active ?
 * Maria,Santos,Taytay Congregation,PH-12,Elder,maria@example.com,+639123456789,Yes,Yes,Yes
 *
 */

(function () {
  const LS_KEYS = {
    VOLUNTEERS: 'cvsa_volunteers',
    BOOKINGS: 'cvsa_bookings'
  };

  const DEFAULT_VOLUNTEERS = [
    // Test volunteers for Taytay Congregation (Elder can see these)
    { 
      id: 'vol-maria-santos', 
      firstName: 'Maria', 
      lastName: 'Santos', 
      name: 'Maria Santos',
      email: 'maria.santos@example.com', 
      phone: '+63 912 345 6789', 
      congregation: 'Taytay Congregation',
      circuit: 'PH-12',
      privilege: 'Regular Pioneer',
      approvedS73: true,
      attendedSeminar: true,
      active: true,
      notes: 'Available mornings and weekends',
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    },
    { 
      id: 'vol-jose-reyes', 
      firstName: 'Jose', 
      lastName: 'Reyes', 
      name: 'Jose Reyes',
      email: 'jose.reyes@example.com', 
      phone: '+63 918 234 5678', 
      congregation: 'Taytay Congregation',
      circuit: 'PH-12',
      privilege: 'Ministerial Servant',
      approvedS73: true,
      attendedSeminar: true,
      active: true,
      notes: 'Prefers afternoon slots',
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    },
    { 
      id: 'vol-ana-cruz', 
      firstName: 'Ana', 
      lastName: 'Cruz', 
      name: 'Ana Cruz',
      email: 'ana.cruz@example.com', 
      phone: '+63 915 876 5432', 
      congregation: 'Taytay Congregation',
      circuit: 'PH-12',
      privilege: 'Publisher',
      approvedS73: true,
      attendedSeminar: false,
      active: true,
      notes: 'New volunteer, needs training',
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    },
    // Test volunteers for Angono Congregation (Elder should NOT see these)
    { 
      id: 'vol-pedro-garcia', 
      firstName: 'Pedro', 
      lastName: 'Garcia', 
      name: 'Pedro Garcia',
      email: 'pedro.garcia@example.com', 
      phone: '+63 920 111 2222', 
      congregation: 'Angono Congregation',
      circuit: 'PH-13',
      privilege: 'Elder',
      approvedS73: true,
      attendedSeminar: true,
      active: true,
      notes: 'Experienced coordinator',
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    },
    { 
      id: 'vol-linda-flores', 
      firstName: 'Linda', 
      lastName: 'Flores', 
      name: 'Linda Flores',
      email: 'linda.flores@example.com', 
      phone: '+63 917 333 4444', 
      congregation: 'Angono Congregation',
      circuit: 'PH-13',
      privilege: 'Regular Pioneer',
      approvedS73: true,
      attendedSeminar: true,
      active: true,
      notes: 'Bilingual (English/Tagalog)',
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    },
    // Test volunteers for Pritil Congregation
    { 
      id: 'vol-roberto-diaz', 
      firstName: 'Roberto', 
      lastName: 'Diaz', 
      name: 'Roberto Diaz',
      email: 'roberto.diaz@example.com', 
      phone: '+63 919 555 6666', 
      congregation: 'Pritil Congregation',
      circuit: 'PH-14',
      privilege: 'Ministerial Servant',
      approvedS73: false,
      attendedSeminar: true,
      active: true,
      notes: 'Pending S-73 approval',
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    },
    { 
      id: 'vol-carmen-lopez', 
      firstName: 'Carmen', 
      lastName: 'Lopez', 
      name: 'Carmen Lopez',
      email: 'carmen.lopez@example.com', 
      phone: '+63 916 777 8888', 
      congregation: 'Pritil Congregation',
      circuit: 'PH-14',
      privilege: 'Publisher',
      approvedS73: true,
      attendedSeminar: true,
      active: false,
      notes: 'Temporarily inactive - health issues',
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    }
  ];

  /* -------------------------
     LocalStorage helpers
     ------------------------- */
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('admin-volunteers: failed to save to localStorage', err);
    }
  }

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('admin-volunteers: failed to load from localStorage', err);
      return null;
    }
  }

  function ensureDefaultVolunteers() {
    const existing = load(LS_KEYS.VOLUNTEERS);
    if (!existing || !Array.isArray(existing)) {
      const seed = DEFAULT_VOLUNTEERS.map(v => Object.assign({}, v));
      save(LS_KEYS.VOLUNTEERS, seed);
      return seed;
    }
    return existing;
  }

  /* -------------------------
     Bookings queries (to count assigned shifts)
     ------------------------- */
  function loadBookings() {
    return load(LS_KEYS.BOOKINGS) || [];
  }

  function countShiftsForVolunteer(vol) {
    const bookings = loadBookings();
    if (!vol) return 0;
    const name = (vol.name || '').trim();
    const email = (vol.email || '').trim().toLowerCase();
    // count bookings where displayName or username matches volunteer
    const matches = bookings.filter(b => {
      if (!b) return false;
      if (b.displayName && String(b.displayName).trim() === name) return true;
      if (b.username && String(b.username).toLowerCase() === email && email) return true;
      if (b.username && String(b.username).trim() === name) return true;
      return false;
    });
    return matches.length;
  }

  /* -------------------------
     Modal utilities
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
    // options: { title, content (string|node), showConfirm, confirmText, onConfirm, showCancel, onClose }
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

      // allow clicking backdrop to close
      function onBackdropClick(e) {
        if (e.target === backdrop) close();
      }
      backdrop.addEventListener('click', onBackdropClick, { once: true });

      return { close };
    }

    // fallback: simple prompt/confirm/alert
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

  function closeModal() {
    const { backdrop } = findModalEls();
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  /* -------------------------
     Utilities
     ------------------------- */
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function uid(prefix = '') {
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeEmail(e) {
    return (e || '').toString().trim().toLowerCase();
  }

  /* -------------------------
     CSV parsing (simple, supports quoted fields)
     ------------------------- */
  function parseCSV(text) {
    const rows = [];
    const re = /(?:\s*("(?:[^"]|"")*"|[^,\r\n]*))(?:,|$)/g;
    const lines = text.split(/\r\n|\n|\r/);
    for (const line of lines) {
      if (line.trim() === '') continue;
      const row = [];
      let match;
      let idx = 0;
      // We cannot rely solely on the regex for complicated CSV; implement a small parser:
      let i = 0;
      while (i < line.length) {
        let ch = line[i];
        if (ch === '"') {
          // quoted
          i++;
          let out = '';
          while (i < line.length) {
            if (line[i] === '"') {
              if (line[i + 1] === '"') {
                out += '"';
                i += 2;
                continue;
              } else {
                i++;
                break;
              }
            } else {
              out += line[i++];
            }
          }
          // skip optional whitespace until comma
          while (i < line.length && line[i] !== ',') i++;
          if (line[i] === ',') i++;
          row.push(out);
        } else {
          // unquoted
          let start = i;
          while (i < line.length && line[i] !== ',') i++;
          let val = line.slice(start, i).trim();
          if (line[i] === ',') i++;
          row.push(val);
        }
      }
      rows.push(row);
    }
    return rows;
  }

  /* -------------------------
     Render volunteers table
     ------------------------- */
  function renderVolunteersTable(filter = '') {
    const tbody = document.getElementById('volunteers-table-body');
    if (!tbody) {
      console.warn('admin-volunteers: #volunteers-table-body not found');
      return;
    }
    const volunteers = ensureDefaultVolunteers();
    const q = (filter || '').trim().toLowerCase();
    const rows = volunteers
      .slice()
      .sort((a, b) => {
        const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim();
        const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim();
        return aName.localeCompare(bName);
      })
      .filter(v => {
        if (!q) return true;
        const hay = `${v.firstName || ''} ${v.lastName || ''} ${v.email || ''} ${v.phone || ''} ${v.congregation || ''} ${v.circuit || ''} ${v.privilege || ''}`.toLowerCase();
        return hay.indexOf(q) !== -1;
      });

    tbody.innerHTML = '';
    rows.forEach(vol => {
      const tr = document.createElement('tr');
      tr.dataset.volunteerId = vol.id;

      const tdFirstName = document.createElement('td');
      tdFirstName.setAttribute('data-label', 'First Name');
      tdFirstName.textContent = vol.firstName || '';

      const tdLastName = document.createElement('td');
      tdLastName.setAttribute('data-label', 'Last Name');
      tdLastName.textContent = vol.lastName || '';

      const tdCong = document.createElement('td');
      tdCong.setAttribute('data-label', 'Congregation');
      tdCong.textContent = vol.congregation || '';

      const tdCircuit = document.createElement('td');
      tdCircuit.setAttribute('data-label', 'Circuit');
      tdCircuit.textContent = vol.circuit || '';

      const tdPrivilege = document.createElement('td');
      tdPrivilege.setAttribute('data-label', 'Privilege');
      tdPrivilege.textContent = vol.privilege || '';

      const tdEmail = document.createElement('td');
      tdEmail.setAttribute('data-label', 'Email Address');
      tdEmail.textContent = vol.email || '';

      const tdPhone = document.createElement('td');
      tdPhone.setAttribute('data-label', 'Mobile Number');
      tdPhone.textContent = vol.phone || '';

      const tdS73 = document.createElement('td');
      tdS73.setAttribute('data-label', 'Approved S-73 Form?');
      tdS73.textContent = vol.approvedS73 ? 'Yes' : 'No';

      const tdSeminar = document.createElement('td');
      tdSeminar.setAttribute('data-label', 'Attended Seminar?');
      tdSeminar.textContent = vol.attendedSeminar ? 'Yes' : 'No';

      const tdActive = document.createElement('td');
      tdActive.setAttribute('data-label', 'Active?');
      tdActive.textContent = vol.active !== false ? 'Yes' : 'No';

      const tdActions = document.createElement('td');
      tdActions.setAttribute('data-label', 'Actions');
      tdActions.innerHTML = `
        <button class="edit-volunteer" data-volunteer-id="${escapeHtml(vol.id)}">Edit</button>
        <button class="delete-volunteer" data-volunteer-id="${escapeHtml(vol.id)}">Delete</button>
      `;

      tr.appendChild(tdFirstName);
      tr.appendChild(tdLastName);
      tr.appendChild(tdCong);
      tr.appendChild(tdCircuit);
      tr.appendChild(tdPrivilege);
      tr.appendChild(tdEmail);
      tr.appendChild(tdPhone);
      tr.appendChild(tdS73);
      tr.appendChild(tdSeminar);
      tr.appendChild(tdActive);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

    // wire actions
    tbody.querySelectorAll('.edit-volunteer').forEach(btn => btn.addEventListener('click', onEditVolunteer));
    tbody.querySelectorAll('.delete-volunteer').forEach(btn => btn.addEventListener('click', onDeleteVolunteer));
  }

  /* -------------------------
     Build volunteer form (used for add/edit)
     ------------------------- */
  function buildVolunteerForm(vol) {
    const form = document.createElement('form');
    form.className = 'volunteer-form';
    form.style.display = 'grid';
    form.style.gap = '0.5rem';

    // First Name
    const firstNameRow = document.createElement('div'); firstNameRow.className = 'form-row';
    const firstNameLabel = document.createElement('label'); firstNameLabel.textContent = 'First Name *';
    const firstNameInput = document.createElement('input'); firstNameInput.type = 'text'; firstNameInput.name = 'firstName'; firstNameInput.required = true;
    if (vol) firstNameInput.value = vol.firstName || '';
    firstNameRow.appendChild(firstNameLabel); firstNameRow.appendChild(firstNameInput);

    // Last Name
    const lastNameRow = document.createElement('div'); lastNameRow.className = 'form-row';
    const lastNameLabel = document.createElement('label'); lastNameLabel.textContent = 'Last Name *';
    const lastNameInput = document.createElement('input'); lastNameInput.type = 'text'; lastNameInput.name = 'lastName'; lastNameInput.required = true;
    if (vol) lastNameInput.value = vol.lastName || '';
    lastNameRow.appendChild(lastNameLabel); lastNameRow.appendChild(lastNameInput);

    // Congregation
    const congRow = document.createElement('div'); congRow.className = 'form-row';
    const congLabel = document.createElement('label'); congLabel.textContent = 'Congregation';
    const congInput = document.createElement('input'); congInput.type = 'text'; congInput.name = 'congregation';
    if (vol) congInput.value = vol.congregation || '';
    congRow.appendChild(congLabel); congRow.appendChild(congInput);

    // Circuit
    const circuitRow = document.createElement('div'); circuitRow.className = 'form-row';
    const circuitLabel = document.createElement('label'); circuitLabel.textContent = 'Circuit';
    const circuitInput = document.createElement('input'); circuitInput.type = 'text'; circuitInput.name = 'circuit';
    if (vol) circuitInput.value = vol.circuit || '';
    circuitRow.appendChild(circuitLabel); circuitRow.appendChild(circuitInput);

    // Privilege
    const privilegeRow = document.createElement('div'); privilegeRow.className = 'form-row';
    const privilegeLabel = document.createElement('label'); privilegeLabel.textContent = 'Privilege';
    const privilegeInput = document.createElement('input'); privilegeInput.type = 'text'; privilegeInput.name = 'privilege';
    if (vol) privilegeInput.value = vol.privilege || '';
    privilegeRow.appendChild(privilegeLabel); privilegeRow.appendChild(privilegeInput);

    // Email
    const emailRow = document.createElement('div'); emailRow.className = 'form-row';
    const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email Address';
    const emailInput = document.createElement('input'); emailInput.type = 'email'; emailInput.name = 'email';
    if (vol) emailInput.value = vol.email || '';
    emailRow.appendChild(emailLabel); emailRow.appendChild(emailInput);

    // Phone
    const phoneRow = document.createElement('div'); phoneRow.className = 'form-row';
    const phoneLabel = document.createElement('label'); phoneLabel.textContent = 'Mobile Number';
    const phoneInput = document.createElement('input'); phoneInput.type = 'text'; phoneInput.name = 'phone';
    if (vol) phoneInput.value = vol.phone || '';
    phoneRow.appendChild(phoneLabel); phoneRow.appendChild(phoneInput);

    // Approved S-73 Form
    const s73Row = document.createElement('div'); s73Row.className = 'form-row';
    const s73Label = document.createElement('label');
    const s73Checkbox = document.createElement('input'); s73Checkbox.type = 'checkbox'; s73Checkbox.name = 'approvedS73'; s73Checkbox.id = 'approvedS73';
    if (vol) s73Checkbox.checked = vol.approvedS73 || false;
    const s73LabelText = document.createElement('span'); s73LabelText.textContent = 'Approved S-73 Form?';
    s73Label.appendChild(s73Checkbox); s73Label.appendChild(s73LabelText);
    s73Label.style.display = 'flex'; s73Label.style.alignItems = 'center'; s73Label.style.gap = '0.5rem';
    s73Row.appendChild(s73Label);

    // Attended Seminar
    const seminarRow = document.createElement('div'); seminarRow.className = 'form-row';
    const seminarLabel = document.createElement('label');
    const seminarCheckbox = document.createElement('input'); seminarCheckbox.type = 'checkbox'; seminarCheckbox.name = 'attendedSeminar'; seminarCheckbox.id = 'attendedSeminar';
    if (vol) seminarCheckbox.checked = vol.attendedSeminar || false;
    const seminarLabelText = document.createElement('span'); seminarLabelText.textContent = 'Attended Seminar?';
    seminarLabel.appendChild(seminarCheckbox); seminarLabel.appendChild(seminarLabelText);
    seminarLabel.style.display = 'flex'; seminarLabel.style.alignItems = 'center'; seminarLabel.style.gap = '0.5rem';
    seminarRow.appendChild(seminarLabel);

    // Active
    const activeRow = document.createElement('div'); activeRow.className = 'form-row';
    const activeLabel = document.createElement('label');
    const activeCheckbox = document.createElement('input'); activeCheckbox.type = 'checkbox'; activeCheckbox.name = 'active'; activeCheckbox.id = 'active';
    if (vol) activeCheckbox.checked = vol.active !== false;
    else activeCheckbox.checked = true; // default to active for new volunteers
    const activeLabelText = document.createElement('span'); activeLabelText.textContent = 'Active?';
    activeLabel.appendChild(activeCheckbox); activeLabel.appendChild(activeLabelText);
    activeLabel.style.display = 'flex'; activeLabel.style.alignItems = 'center'; activeLabel.style.gap = '0.5rem';
    activeRow.appendChild(activeLabel);

    // Notes
    const notesRow = document.createElement('div'); notesRow.className = 'form-row';
    const notesLabel = document.createElement('label'); notesLabel.textContent = 'Notes (optional)';
    const notesInput = document.createElement('textarea'); notesInput.name = 'notes'; notesInput.rows = 3;
    if (vol) notesInput.value = vol.notes || '';
    notesRow.appendChild(notesLabel); notesRow.appendChild(notesInput);

    const errorRow = document.createElement('div'); errorRow.className = 'small'; errorRow.style.color = '#9b1c1c'; errorRow.style.display = 'none';

    form.appendChild(firstNameRow);
    form.appendChild(lastNameRow);
    form.appendChild(congRow);
    form.appendChild(circuitRow);
    form.appendChild(privilegeRow);
    form.appendChild(emailRow);
    form.appendChild(phoneRow);
    form.appendChild(s73Row);
    form.appendChild(seminarRow);
    form.appendChild(activeRow);
    form.appendChild(notesRow);
    form.appendChild(errorRow);

    form._collectAndValidate = function () {
      const firstName = (firstNameInput.value || '').trim();
      const lastName = (lastNameInput.value || '').trim();
      const email = normalizeEmail(emailInput.value || '');
      const phone = (phoneInput.value || '').trim();
      const congregation = (congInput.value || '').trim();
      const circuit = (circuitInput.value || '').trim();
      const privilege = (privilegeInput.value || '').trim();
      const notes = (notesInput.value || '').trim();
      const approvedS73 = s73Checkbox.checked;
      const attendedSeminar = seminarCheckbox.checked;
      const active = activeCheckbox.checked;
      const errors = [];
      if (!firstName) errors.push('First Name is required.');
      if (!lastName) errors.push('Last Name is required.');
      // email optional but if present must look like an email
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email looks invalid.');
      return { valid: errors.length === 0, errors, payload: { firstName, lastName, email, phone, congregation, circuit, privilege, notes, approvedS73, attendedSeminar, active } };
    };

    return form;
  }

  /* -------------------------
     Handlers: Add / Edit / Delete
     ------------------------- */
  function onAddVolunteerClick(e) {
    e && e.preventDefault();
    const form = buildVolunteerForm(null);
    openModal({
      title: 'Add Volunteer',
      content: form,
      showConfirm: true,
      confirmText: 'Save Volunteer',
      showCancel: true,
      onConfirm: () => {
        const { valid, errors, payload } = form._collectAndValidate();
        if (!valid) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = errors.map(x => `<div>${escapeHtml(x)}</div>`).join('');
          errEl.style.display = 'block';
          return false;
        }
        const volunteers = ensureDefaultVolunteers();
        // Prevent duplicate by email (if provided)
        if (payload.email && volunteers.some(v => normalizeEmail(v.email) === payload.email)) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = `<div>A volunteer with this email already exists.</div>`;
          errEl.style.display = 'block';
          return false;
        }
        // Check for duplicate name (firstName + lastName combination)
        const fullName = `${payload.firstName} ${payload.lastName}`.trim().toLowerCase();
        if (volunteers.some(v => `${v.firstName || ''} ${v.lastName || ''}`.trim().toLowerCase() === fullName)) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = `<div>A volunteer with this name already exists.</div>`;
          errEl.style.display = 'block';
          return false;
        }
        const newVol = {
          id: 'vol-' + uid(),
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          congregation: payload.congregation,
          circuit: payload.circuit,
          privilege: payload.privilege,
          approvedS73: payload.approvedS73,
          attendedSeminar: payload.attendedSeminar,
          active: payload.active,
          notes: payload.notes,
          // Keep legacy 'name' field for backward compatibility with bookings
          name: `${payload.firstName} ${payload.lastName}`.trim(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        volunteers.push(newVol);
        save(LS_KEYS.VOLUNTEERS, volunteers);
        renderVolunteersTable(qs('#vol-search') ? qs('#vol-search').value : '');
        // try to sync volunteer lists in other modules
        dispatchVolunteersUpdated();
      }
    });
  }

  function onEditVolunteer(e) {
    e && e.preventDefault();
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.volunteerId;
    if (!id) return;
    const volunteers = ensureDefaultVolunteers();
    const vol = volunteers.find(v => v.id === id);
    if (!vol) return openModal({ title: 'Error', content: 'Volunteer not found.' });

    const form = buildVolunteerForm(vol);
    const displayName = vol.firstName && vol.lastName ? `${vol.firstName} ${vol.lastName}` : (vol.name || 'Unknown');
    openModal({
      title: `Edit Volunteer — ${displayName}`,
      content: form,
      showConfirm: true,
      confirmText: 'Save changes',
      showCancel: true,
      onConfirm: () => {
        const { valid, errors, payload } = form._collectAndValidate();
        if (!valid) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = errors.map(x => `<div>${escapeHtml(x)}</div>`).join('');
          errEl.style.display = 'block';
          return false;
        }
        // Prevent duplicate email/name (except this record)
        const idx = volunteers.findIndex(v => v.id === id);
        if (idx < 0) return openModal({ title: 'Error', content: 'Could not locate volunteer to update.' });

        if (payload.email && volunteers.some((other, i) => i !== idx && normalizeEmail(other.email) === payload.email)) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = `<div>Another volunteer already uses this email.</div>`;
          errEl.style.display = 'block';
          return false;
        }
        // Check for duplicate name (firstName + lastName combination)
        const fullName = `${payload.firstName} ${payload.lastName}`.trim().toLowerCase();
        if (volunteers.some((other, i) => i !== idx && `${other.firstName || ''} ${other.lastName || ''}`.trim().toLowerCase() === fullName)) {
          const errEl = form.querySelector('.small');
          errEl.innerHTML = `<div>Another volunteer already uses this name.</div>`;
          errEl.style.display = 'block';
          return false;
        }

        volunteers[idx] = Object.assign({}, volunteers[idx], {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          congregation: payload.congregation,
          circuit: payload.circuit,
          privilege: payload.privilege,
          approvedS73: payload.approvedS73,
          attendedSeminar: payload.attendedSeminar,
          active: payload.active,
          notes: payload.notes,
          // Keep legacy 'name' field for backward compatibility with bookings
          name: `${payload.firstName} ${payload.lastName}`.trim(),
          updatedAt: Date.now()
        });
        save(LS_KEYS.VOLUNTEERS, volunteers);
        renderVolunteersTable(qs('#vol-search') ? qs('#vol-search').value : '');
        dispatchVolunteersUpdated();
      }
    });
  }

  function onDeleteVolunteer(e) {
    e && e.preventDefault();
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.volunteerId;
    if (!id) return;
    const volunteers = ensureDefaultVolunteers();
    const vol = volunteers.find(v => v.id === id);
    if (!vol) return openModal({ title: 'Error', content: 'Volunteer not found.' });

    const assigned = countShiftsForVolunteer(vol);
    if (assigned > 0) {
      return openModal({
        title: 'Cannot delete volunteer',
        content: `<p>This volunteer has <strong>${assigned}</strong> assigned shift(s). Remove the assignments before deleting the volunteer.</p>`,
        showConfirm: false
      });
    }

    openModal({
      title: 'Delete volunteer',
      content: `<p>Are you sure you want to permanently delete <strong>${escapeHtml(vol.name)}</strong>? This action cannot be undone.</p>`,
      showConfirm: true,
      confirmText: 'Delete',
      onConfirm: () => {
        const updated = volunteers.filter(v => v.id !== id);
        save(LS_KEYS.VOLUNTEERS, updated);
        renderVolunteersTable(qs('#vol-search') ? qs('#vol-search').value : '');
        dispatchVolunteersUpdated();
      }
    });
  }

  /* -------------------------
     CSV import flow
     ------------------------- */
  function setupImportControls() {
    const container = document.querySelector('#tab-volunteers');
    if (!container) return;
    // create a small control bar (search + import)
    let ctrlBar = container.querySelector('.vol-control-bar');
    if (!ctrlBar) {
      ctrlBar = document.createElement('div');
      ctrlBar.className = 'vol-control-bar';
      ctrlBar.style.display = 'flex';
      ctrlBar.style.gap = '0.5rem';
      ctrlBar.style.alignItems = 'center';
      ctrlBar.style.marginBottom = '0.6rem';
      // insert before the table
      const table = container.querySelector('table');
      container.insertBefore(ctrlBar, table);
    } else {
      ctrlBar.innerHTML = '';
    }

    // Search input
    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'vol-search';
    search.placeholder = 'Search volunteers (name, email, phone, congregation)';
    search.style.flex = '1';
    search.addEventListener('input', () => renderVolunteersTable(search.value));
    ctrlBar.appendChild(search);

    // Import button (with hidden file input)
    const importBtn = document.createElement('button');
    importBtn.id = 'import-volunteers-btn';
    importBtn.className = 'muted-btn';
    importBtn.textContent = 'Import CSV';
    ctrlBar.appendChild(importBtn);

    const sampleLink = document.createElement('button');
    sampleLink.className = 'muted-btn';
    sampleLink.textContent = 'Download sample CSV';
    sampleLink.addEventListener('click', () => {
      const sample = 'name,email,phone,congregation,notes\nMaria Santos,maria@example.com,+639123456789,Taytay,Available mornings\nJose Perez,jose@example.com,+639198765432,Angono,Prefers afternoons\n';
      const blob = new Blob([sample], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'volunteers-sample.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
    ctrlBar.appendChild(sampleLink);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,text/csv';
    fileInput.style.display = 'none';
    fileInput.id = 'vol-import-input';
    ctrlBar.appendChild(fileInput);

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const text = e.target.result;
          handleCSVImport(text);
        } catch (err) {
          openModal({ title: 'Import error', content: 'Failed to parse the CSV file.' });
        }
      };
      reader.readAsText(file);
      // reset file input so selecting same file again triggers change
      fileInput.value = '';
    });

    // Add volunteer button (existing id might be present elsewhere; ensure it triggers our handler)
    const addBtn = document.getElementById('add-volunteer-btn');
    if (addBtn) {
      addBtn.removeEventListener('click', onAddVolunteerClick);
      addBtn.addEventListener('click', onAddVolunteerClick);
    }
  }

  function handleCSVImport(csvText) {
    if (!csvText || !csvText.trim()) return openModal({ title: 'Import', content: 'CSV file is empty.' });
    const rows = parseCSV(csvText);
    if (!rows.length) return openModal({ title: 'Import', content: 'No rows found in CSV.' });

    // Determine header
    const headerRow = rows[0].map(h => (h || '').toString().trim().toLowerCase());
    let startIdx = 0;
    const headerNames = ['firstname', 'first name', 'lastname', 'last name', 'email', 'phone', 'mobile', 'congregation', 'circuit', 'privilege', 'notes', 'approveds73', 'approved s-73', 's-73', 'attendedseminar', 'attended seminar', 'seminar', 'active'];
    const hasHeader = headerRow.some(h => headerNames.some(hn => h.includes(hn.replace(/\s+/g, ''))));
    if (hasHeader) startIdx = 1;

    const volunteers = ensureDefaultVolunteers();
    const added = [];
    const skipped = [];
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      // Map fields - attempt to be flexible: use header if present, otherwise fixed columns
      let firstName = '', lastName = '', email = '', phone = '', congregation = '', circuit = '', privilege = '', notes = '';
      let approvedS73 = false, attendedSeminar = false, active = true;
      
      if (hasHeader) {
        for (let j = 0; j < headerRow.length; j++) {
          const key = headerRow[j].replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
          const val = (row[j] || '').toString().trim();
          if (key === 'firstname' || key === 'first') firstName = val;
          else if (key === 'lastname' || key === 'last') lastName = val;
          else if (key.includes('email')) email = val;
          else if (key.includes('phone') || key.includes('mobile')) phone = val;
          else if (key.includes('congregation')) congregation = val;
          else if (key.includes('circuit')) circuit = val;
          else if (key.includes('privilege')) privilege = val;
          else if (key.includes('notes')) notes = val;
          else if (key.includes('s73') || key.includes('approved')) approvedS73 = ['yes', 'true', '1', 'y'].includes(val.toLowerCase());
          else if (key.includes('seminar') || key.includes('attended')) attendedSeminar = ['yes', 'true', '1', 'y'].includes(val.toLowerCase());
          else if (key === 'active') active = ['yes', 'true', '1', 'y'].includes(val.toLowerCase()) || val === '';
        }
      } else {
        // fixed columns: firstName,lastName,congregation,circuit,privilege,email,phone,approvedS73,attendedSeminar,active
        firstName = (row[0] || '').toString().trim();
        lastName = (row[1] || '').toString().trim();
        congregation = (row[2] || '').toString().trim();
        circuit = (row[3] || '').toString().trim();
        privilege = (row[4] || '').toString().trim();
        email = (row[5] || '').toString().trim();
        phone = (row[6] || '').toString().trim();
        approvedS73 = ['yes', 'true', '1', 'y'].includes((row[7] || '').toString().trim().toLowerCase());
        attendedSeminar = ['yes', 'true', '1', 'y'].includes((row[8] || '').toString().trim().toLowerCase());
        active = (row[9] || '').toString().trim() === '' ? true : ['yes', 'true', '1', 'y'].includes((row[9] || '').toString().trim().toLowerCase());
      }
      
      if (!firstName || !lastName) {
        skipped.push({ row: i + 1, reason: 'Missing first or last name' });
        continue;
      }
      
      const normEmail = normalizeEmail(email);
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
      // Duplicate check by email (if provided) or exact name
      const duplicate = (normEmail && volunteers.some(v => normalizeEmail(v.email) === normEmail))
        || volunteers.some(v => `${v.firstName || ''} ${v.lastName || ''}`.trim().toLowerCase() === fullName);
      if (duplicate) {
        skipped.push({ row: i + 1, reason: 'Duplicate by email or name' });
        continue;
      }
      const newVol = {
        id: 'vol-' + uid(),
        firstName,
        lastName,
        email: normEmail,
        phone,
        congregation,
        circuit,
        privilege,
        approvedS73,
        attendedSeminar,
        active,
        notes,
        // Keep legacy 'name' field for backward compatibility
        name: `${firstName} ${lastName}`.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      volunteers.push(newVol);
      added.push(newVol);
    }

    save(LS_KEYS.VOLUNTEERS, volunteers);
    renderVolunteersTable(qs('#vol-search') ? qs('#vol-search').value : '');
    dispatchVolunteersUpdated();

    const summaryLines = [
      `<div class="small">Imported: <strong>${added.length}</strong></div>`,
      `<div class="small">Skipped: <strong>${skipped.length}</strong></div>`,
      skipped.length ? `<div class="small">Details:<br>${skipped.map(s => `Row ${s.row}: ${escapeHtml(s.reason)}`).join('<br>')}</div>` : ''
    ].join('');
    openModal({ title: 'Import result', content: summaryLines, showConfirm: false });
  }

  /* -------------------------
     Helpers
     ------------------------- */
  function qs(selector, root = document) { return root.querySelector(selector); }

  function dispatchVolunteersUpdated() {
    // notify other modules
    try {
      document.dispatchEvent(new Event('cvsa:volunteers:updated'));
      if (window.AdminLocations && typeof window.AdminLocations.renderLocationsTable === 'function') {
        window.AdminLocations.renderLocationsTable();
      }
    } catch (err) { /* no-op */ }
  }

  /* -------------------------
     Initialization
     ------------------------- */
  function init() {
    ensureDefaultVolunteers();
    function startup() {
      setupImportControls();
      renderVolunteersTable();

      // wire search if it already exists (safety)
      const search = document.getElementById('vol-search');
      if (search) search.addEventListener('input', () => renderVolunteersTable(search.value));

      // Listen for external triggers (e.g., after CSV import or other module update)
      document.addEventListener('cvsa:volunteers:refresh', () => renderVolunteersTable(qs('#vol-search') ? qs('#vol-search').value : ''));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startup);
    else startup();
  }

  // Expose API
  window.AdminVolunteers = {
    init,
    renderVolunteersTable,
    getVolunteers: () => ensureDefaultVolunteers(),
    saveVolunteers: (arr) => { save(LS_KEYS.VOLUNTEERS, arr); renderVolunteersTable(); dispatchVolunteersUpdated(); },
    countShiftsForVolunteer
  };

  // Auto-init
  init();

})();