/**
 * advanced-features.js
 * Additional features: Calendar view, export enhancements, volunteer preferences
 */

(function() {
  'use strict';

  function init() {
    if (typeof SharedUtils === 'undefined') {
      setTimeout(init, 50);
      return;
    }

    SharedUtils.ErrorHandler.info('Advanced Features initialized');
    
    document.addEventListener('DOMContentLoaded', setupFeatures);
    document.addEventListener('cvsa:bridge:ready', setupFeatures);
  }

  function setupFeatures() {
    setupCalendarView();
    setupVolunteerPreferences();
    setupAdvancedExports();
    setupSearchEnhancements();
  }

  /* -------------------------
     Calendar View
     ------------------------- */
  function setupCalendarView() {
    // Add calendar view button to schedules tab
    const schedulesTab = document.getElementById('tab-schedules');
    if (!schedulesTab) return;

    const calendarBtn = document.createElement('button');
    calendarBtn.id = 'show-calendar';
    calendarBtn.className = 'muted-btn';
    calendarBtn.textContent = '📅 Calendar View';
    calendarBtn.style.cssText = 'margin-bottom: 1rem;';
    calendarBtn.addEventListener('click', showCalendarModal);

    const firstCard = schedulesTab.querySelector('.card') || schedulesTab.querySelector('.schedules-controls');
    if (firstCard) {
      schedulesTab.insertBefore(calendarBtn, firstCard);
    }
  }

  function showCalendarModal() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const calendar = buildCalendar(year, month);
    
    SharedUtils.Modal.open({
      title: 'Assignment Calendar',
      content: calendar,
      showConfirm: false,
      showCancel: true,
      cancelText: 'Close'
    });
  }

  function buildCalendar(year, month) {
    const container = document.createElement('div');
    container.className = 'calendar-container';
    container.style.cssText = 'max-width: 100%; overflow-x: auto;';

    // Header with month navigation
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;';
    
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.className = 'muted-btn';
    prevBtn.onclick = () => {
      const newMonth = month - 1;
      const newYear = newMonth < 0 ? year - 1 : year;
      const adjustedMonth = newMonth < 0 ? 11 : newMonth;
      const newCal = buildCalendar(newYear, adjustedMonth);
      container.parentNode.replaceChild(newCal, container);
    };

    const monthLabel = document.createElement('h3');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    monthLabel.textContent = `${monthNames[month]} ${year}`;

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.className = 'muted-btn';
    nextBtn.onclick = () => {
      const newMonth = month + 1;
      const newYear = newMonth > 11 ? year + 1 : year;
      const adjustedMonth = newMonth > 11 ? 0 : newMonth;
      const newCal = buildCalendar(newYear, adjustedMonth);
      container.parentNode.replaceChild(newCal, container);
    };

    header.appendChild(prevBtn);
    header.appendChild(monthLabel);
    header.appendChild(nextBtn);
    container.appendChild(header);

    // Calendar grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      min-width: 500px;
    `;

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(name => {
      const dayHeader = document.createElement('div');
      dayHeader.textContent = name;
      dayHeader.style.cssText = 'text-align: center; font-weight: 700; padding: 0.5rem; background: #f8fafc;';
      grid.appendChild(dayHeader);
    });

    // Get days in month
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Load bookings for the month
    const bookings = SharedUtils.Storage.load(SharedUtils.STORAGE_KEYS.BOOKINGS, []);
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.style.cssText = 'min-height: 60px; background: #f9fafb;';
      grid.appendChild(emptyCell);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.date === dateStr);

      const dayCell = document.createElement('div');
      dayCell.style.cssText = `
        min-height: 60px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 4px;
        background: white;
        cursor: pointer;
        transition: background 0.2s;
      `;

      const dayNum = document.createElement('div');
      dayNum.textContent = day;
      dayNum.style.cssText = 'font-weight: 700; margin-bottom: 4px;';
      
      // Highlight today
      const today = SharedUtils.DateUtils.today();
      if (dateStr === today) {
        dayCell.style.background = '#dbeafe';
        dayCell.style.borderColor = '#3b82f6';
      }

      const badge = document.createElement('div');
      badge.style.cssText = 'font-size: 0.75rem; color: #6b7280;';
      badge.textContent = dayBookings.length > 0 ? `${dayBookings.length} assignments` : '';

      dayCell.appendChild(dayNum);
      dayCell.appendChild(badge);

      dayCell.onclick = () => showDayDetails(dateStr, dayBookings);

      dayCell.onmouseenter = () => {
        dayCell.style.background = '#f3f4f6';
      };

      dayCell.onmouseleave = () => {
        if (dateStr !== today) {
          dayCell.style.background = 'white';
        }
      };

      grid.appendChild(dayCell);
    }

    container.appendChild(grid);
    return container;
  }

  function showDayDetails(dateStr, bookings) {
    const content = document.createElement('div');
    
    if (bookings.length === 0) {
      content.innerHTML = `<p class="empty-state">No assignments for ${dateStr}</p>`;
    } else {
      content.innerHTML = `
        <h4 style="margin-bottom: 0.75rem;">Assignments for ${dateStr}</h4>
        <div style="display: grid; gap: 0.5rem;">
          ${bookings.map(b => `
            <div class="card" style="padding: 0.75rem;">
              <div style="font-weight: 700;">${SharedUtils.Sanitizer.escape(b.displayName || b.username)}</div>
              <div class="small muted">${SharedUtils.Sanitizer.escape(b.locationName)} • ${SharedUtils.Sanitizer.escape(b.slotLabel || b.slotId)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    SharedUtils.Modal.open({
      title: `Details - ${dateStr}`,
      content,
      showConfirm: false,
      showCancel: true,
      cancelText: 'Close'
    });
  }

  /* -------------------------
     Volunteer Preferences
     ------------------------- */
  function setupVolunteerPreferences() {
    // Add preferences button to volunteer dashboard
    const volDashboard = document.getElementById('volunteer-dashboard');
    if (!volDashboard) return;

    const prefBtn = document.createElement('button');
    prefBtn.id = 'edit-preferences';
    prefBtn.className = 'muted-btn';
    prefBtn.textContent = '⚙️ My Preferences';
    prefBtn.style.cssText = 'margin-top: 1rem;';
    prefBtn.addEventListener('click', showPreferencesModal);

    const firstCard = volDashboard.querySelector('.card');
    if (firstCard) {
      firstCard.appendChild(prefBtn);
    }
  }

  function showPreferencesModal() {
    const user = Auth?.getCurrentUser();
    if (!user) {
      SharedUtils.Toast.warning('Please sign in to manage preferences');
      return;
    }

    const prefs = loadUserPreferences(user.id);
    const form = buildPreferencesForm(prefs);

    SharedUtils.Modal.open({
      title: 'My Preferences',
      content: form,
      showConfirm: true,
      confirmText: 'Save Preferences',
      onConfirm: () => {
        savePreferencesFromForm(form, user.id);
        SharedUtils.Toast.success('Preferences saved');
      }
    });
  }

  function buildPreferencesForm(prefs) {
    const form = document.createElement('form');
    form.style.cssText = 'display: grid; gap: 1rem;';

    // Preferred locations
    const locSection = document.createElement('div');
    locSection.innerHTML = `
      <label style="font-weight: 700; margin-bottom: 0.5rem; display: block;">Preferred Locations</label>
      <div class="small muted" style="margin-bottom: 0.5rem;">Select locations you prefer to serve at</div>
    `;

    const locations = SharedUtils.Storage.load(SharedUtils.STORAGE_KEYS.LOCATIONS, []);
    const locChecks = document.createElement('div');
    locChecks.style.cssText = 'display: grid; gap: 0.5rem;';
    
    locations.forEach(loc => {
      const label = document.createElement('label');
      label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'preferredLocations';
      checkbox.value = loc.id;
      checkbox.checked = prefs.preferredLocations?.includes(loc.id);
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(loc.name));
      locChecks.appendChild(label);
    });

    locSection.appendChild(locChecks);
    form.appendChild(locSection);

    // Preferred time slots
    const timeSection = document.createElement('div');
    timeSection.innerHTML = `
      <label style="font-weight: 700; margin-bottom: 0.5rem; display: block;">Preferred Time Slots</label>
      <div class="small muted" style="margin-bottom: 0.5rem;">Select times when you are available</div>
    `;

    const timeChecks = document.createElement('div');
    timeChecks.style.cssText = 'display: grid; gap: 0.5rem;';

    const slots = [
      '6-8am', '8-10am', '10-12pm', '12-2pm', '2-4pm', '4-6pm', '6-8pm'
    ];

    slots.forEach(slot => {
      const label = document.createElement('label');
      label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'preferredSlots';
      checkbox.value = slot;
      checkbox.checked = prefs.preferredSlots?.includes(slot);
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(slot));
      timeChecks.appendChild(label);
    });

    timeSection.appendChild(timeChecks);
    form.appendChild(timeSection);

    // Notification preferences
    const notifSection = document.createElement('div');
    notifSection.innerHTML = `
      <label style="font-weight: 700; margin-bottom: 0.5rem; display: block;">Notifications</label>
    `;

    const notifChecks = document.createElement('div');
    notifChecks.style.cssText = 'display: grid; gap: 0.5rem;';

    const notifOptions = [
      { value: 'email', label: 'Email reminders' },
      { value: 'sms', label: 'SMS reminders' },
      { value: 'dayBefore', label: 'Day before reminder' },
      { value: 'hourBefore', label: 'Hour before reminder' }
    ];

    notifOptions.forEach(opt => {
      const label = document.createElement('label');
      label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'notifications';
      checkbox.value = opt.value;
      checkbox.checked = prefs.notifications?.[opt.value];
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(opt.label));
      notifChecks.appendChild(label);
    });

    notifSection.appendChild(notifChecks);
    form.appendChild(notifSection);

    return form;
  }

  function loadUserPreferences(userId) {
    const allPrefs = SharedUtils.Storage.load(SharedUtils.STORAGE_KEYS.PREFERENCES, {});
    return allPrefs[userId] || {
      preferredLocations: [],
      preferredSlots: [],
      notifications: {}
    };
  }

  function savePreferencesFromForm(form, userId) {
    const preferredLocations = Array.from(form.querySelectorAll('input[name="preferredLocations"]:checked')).map(cb => cb.value);
    const preferredSlots = Array.from(form.querySelectorAll('input[name="preferredSlots"]:checked')).map(cb => cb.value);
    const notifications = {};
    form.querySelectorAll('input[name="notifications"]').forEach(cb => {
      notifications[cb.value] = cb.checked;
    });

    const allPrefs = SharedUtils.Storage.load(SharedUtils.STORAGE_KEYS.PREFERENCES, {});
    allPrefs[userId] = {
      preferredLocations,
      preferredSlots,
      notifications,
      updatedAt: Date.now()
    };

    SharedUtils.Storage.save(SharedUtils.STORAGE_KEYS.PREFERENCES, allPrefs);
  }

  /* -------------------------
     Advanced Exports
     ------------------------- */
  function setupAdvancedExports() {
    // Already handled in admin-reports.js
    // This is a placeholder for future PDF export functionality
  }

  /* -------------------------
     Enhanced Search
     ------------------------- */
  function setupSearchEnhancements() {
    // Add debounced search to improve performance
    const searchInputs = document.querySelectorAll('input[type="search"]');
    
    searchInputs.forEach(input => {
      const originalHandler = input.oninput || input.onchange;
      if (originalHandler) {
        const debouncedHandler = SharedUtils.Performance.debounce(originalHandler, 300);
        input.oninput = debouncedHandler;
      }
    });
  }

  window.AdvancedFeatures = {
    init,
    showCalendarModal,
    showPreferencesModal
  };

  init();
})();
