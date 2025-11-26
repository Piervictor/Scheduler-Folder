/**
 * runtime-fixes.js
 * Runtime helpers to ensure CVSAStorage-driven initialization, role enforcement,
 * form validation, and UI re-rendering. Designed as a drop-in enhancement to
 * the demo app so you can test behavior and catch common runtime issues.
 *
 * NOTE: This script does not change persisted data structures. It only wires
 * events, attaches validators, and calls exposed module functions (if present).
 */

(function () {
  // Config: map roles to page ids in your HTML
  const ROLE_PAGE_MAP = {
    volunteer: 'volunteer-dashboard',
    admin: 'admin-panel',
    elder: 'elder-dashboard',
    coordinator: 'coordinator-dashboard',
    'shift-manager': 'shift-manager-dashboard',
    reporter: 'reporter-dashboard'
  };

  // Helper selectors used in original app
  const IDS = {
    loginForm: 'login-form',
    logoutBtn: 'demo-logout',
    addLocationBtn: 'add-location-btn',
    addVolunteerBtn: 'add-volunteer-btn',
    modalBackdrop: 'modal-backdrop',
    exportReportBtn: null // optional: if you add a dedicated export button
  };

  // Safe call wrapper
  function safeCall(fn) {
    try { return fn(); } catch (err) { console.error('runtime-fixes safeCall error', err); return null; }
  }

  // Show/hide pages based on role
  function showPageForRole(role) {
    // hide all .page first
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));

    const pageId = ROLE_PAGE_MAP[role];
    if (pageId) {
      const el = document.getElementById(pageId);
      if (el) {
        el.classList.add('active');
        return;
      }
    }
    // fallback: show login
    const login = document.getElementById('login-page');
    if (login) login.classList.add('active');
  }

  // Enforce role-based restrictions on UI elements that declare required roles
  function attachRoleGuards() {
    document.body.addEventListener('click', function (ev) {
      const el = ev.target.closest('[data-required-roles]');
      if (!el) return;
      const rolesAttr = el.getAttribute('data-required-roles') || '';
      const allowed = rolesAttr.split(',').map(s => s.trim()).filter(Boolean);
      const session = safeCall(() => (window.CVSAStorage && window.CVSAStorage.getSession ? window.CVSAStorage.getSession() : JSON.parse(localStorage.getItem('cvsa_session') || 'null')));
      const role = session && session.role;
      if (!role || !allowed.includes(role)) {
        ev.preventDefault();
        ev.stopPropagation();
        // show modal if available, otherwise alert
        if (document.getElementById('modal-backdrop')) {
          const title = 'Permission denied';
          const content = `<div class="small">You do not have permission to perform this action. Required role(s): ${allowed.join(', ')}</div>`;
          const backdrop = document.getElementById('modal-backdrop');
          const mt = document.getElementById('modal-title'); const mb = document.getElementById('modal-body');
          mt.textContent = title; mb.innerHTML = content; backdrop.style.display = 'flex'; backdrop.setAttribute('aria-hidden', 'false');
          document.getElementById('modal-confirm').style.display = 'none';
        } else {
          alert('Permission denied. Required roles: ' + allowed.join(', '));
        }
        return false;
      }
    }, true);
  }

  // Wire logout to CVSAStorage if present, otherwise fallback
  function attachLogout() {
    const btn = document.getElementById(IDS.logoutBtn);
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (window.CVSAStorage && typeof window.CVSAStorage.clearSession === 'function') {
        window.CVSAStorage.clearSession();
      } else {
        localStorage.removeItem('cvsa_session');
      }
      // show login page
      const pages = document.querySelectorAll('.page');
      pages.forEach(p => p.classList.remove('active'));
      const login = document.getElementById('login-page');
      if (login) login.classList.add('active');
      // try to call CVSAuth.logout if available
      if (window.CVSAuth && typeof window.CVSAuth.logout === 'function') {
        try { window.CVSAuth.logout(); } catch (e) { /* ignore */ }
      }
    });
  }

  // Trigger UI renderers exposed by modules after storage load
  function triggerRenders() {
    // Give modules time to register; call after data loaded
    setTimeout(() => {
      if (window.VDB && typeof window.VDB.renderLocationCards === 'function') safeCall(() => window.VDB.renderLocationCards());
      if (window.AdminLocations && typeof window.AdminLocations.renderLocationsTable === 'function') safeCall(() => window.AdminLocations.renderLocationsTable());
      if (window.AdminVolunteers && typeof window.AdminVolunteers.renderVolunteersTable === 'function') safeCall(() => window.AdminVolunteers.renderVolunteersTable());
      if (window.AdminSchedules && typeof window.AdminSchedules.renderSchedulesOverview === 'function') safeCall(() => window.AdminSchedules.renderSchedulesOverview());
      if (window.AdminAssignments && typeof window.AdminAssignments.buildAssignmentsUI === 'function') safeCall(() => window.AdminAssignments.buildAssignmentsUI());
      if (window.AdminReports && typeof window.AdminReports.generateReport === 'function') {
        const typeEl = document.querySelector('#report-type');
        const from = document.querySelector('#report-from') ? document.querySelector('#report-from').value : '';
        const to = document.querySelector('#report-to') ? document.querySelector('#report-to').value : '';
        const type = typeEl ? typeEl.value : 'location';
        safeCall(() => window.AdminReports.generateReport(type, from, to));
      }
      if (window.ElderDashboard && typeof window.ElderDashboard.refresh === 'function') safeCall(() => window.ElderDashboard.refresh());
    }, 150);
  }

  // Attach basic validation to forms to ensure client-side validation triggers and messages are visible
  function attachFormValidation() {
    // list of common forms
    const ids = ['login-form', 'location-form', 'volunteer-form', 'settings-form', 'location-form-template', 'volunteer-form-template'];
    ids.forEach(id => {
      const form = document.getElementById(id) || document.querySelector(`#${id} form`);
      if (!form) return;
      form.addEventListener('submit', function (ev) {
        if (!form.checkValidity()) {
          ev.preventDefault();
          ev.stopPropagation();
          // show native validation by focusing first invalid element
          const invalid = form.querySelector(':invalid');
          if (invalid) invalid.focus();
          console.warn('Form validation prevented submission for', id);
        }
      }, true);
    });

    // Also add a handler to show inline error containers for login
    const login = document.getElementById('login-form');
    if (login) {
      login.addEventListener('submit', (ev) => {
        const user = login.querySelector('#username');
        const pass = login.querySelector('#password');
        const errs = [];
        if (!user.value || !user.value.trim()) errs.push('Username is required.');
        if (!pass.value || pass.value.length < 1) errs.push('Password is required.');
        if (errs.length) {
          ev.preventDefault();
          ev.stopPropagation();
          const existing = document.getElementById('login-error');
          const container = existing || document.createElement('div');
          container.id = 'login-error';
          container.setAttribute('role', 'alert');
          container.style.background = '#FFF5F5';
          container.style.border = '1px solid rgba(239,68,68,0.12)';
          container.style.color = '#7F1D1D';
          container.style.padding = '0.6rem';
          container.style.borderRadius = '8px';
          container.innerHTML = errs.map(e => `<div>${e}</div>`).join('');
          if (!existing) {
            const wrap = document.querySelector('.login-wrap') || document.getElementById('login-page');
            if (wrap) wrap.appendChild(container);
          }
        }
      }, true);
    }
  }

  // Global console error capture to fail tests early and surface to UI during QA
  function attachGlobalErrorHandler() {
    window.addEventListener('error', function (ev) {
      console.error('Global error captured:', ev.error || ev.message, ev);
      // show an unobtrusive banner for QA (not for production)
      showBanner('JavaScript error captured — check console for details', 'danger');
    });
    window.addEventListener('unhandledrejection', function (ev) {
      console.error('Unhandled rejection', ev.reason);
      showBanner('Unhandled promise rejection — check console', 'danger');
    });
  }

  // Add a small transient banner for QA feedback
  function showBanner(text, tone = 'info') {
    let banner = document.getElementById('cvsa-qa-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'cvsa-qa-banner';
      banner.style.position = 'fixed';
      banner.style.left = '12px';
      banner.style.right = '12px';
      banner.style.bottom = '12px';
      banner.style.padding = '10px 12px';
      banner.style.borderRadius = '8px';
      banner.style.zIndex = 99999;
      banner.style.fontWeight = 700;
      banner.style.boxShadow = '0 6px 18px rgba(2,6,23,0.12)';
      document.body.appendChild(banner);
    }
    banner.textContent = text;
    banner.style.background = tone === 'danger' ? '#fee2e2' : '#ecfeff';
    banner.style.color = tone === 'danger' ? '#7f1d1d' : '#065f46';
    setTimeout(() => { try { banner.remove(); } catch (e) {} }, 5000);
  }

  // Ensure export CSV button is wired to AdminReports.exportCurrentReport
  function attachExportHandler() {
    const exportBtn = document.querySelector('[data-cvsa-export="true"]') || document.querySelector('#export-report-btn');
    if (!exportBtn) return;
    exportBtn.addEventListener('click', function () {
      if (window.AdminReports && typeof window.AdminReports.exportCurrentReport === 'function') {
        const type = document.querySelector('#report-type') ? document.querySelector('#report-type').value : 'location';
        const from = document.querySelector('#report-from') ? document.querySelector('#report-from').value : '';
        const to = document.querySelector('#report-to') ? document.querySelector('#report-to').value : '';
        try {
          window.AdminReports.exportCurrentReport(type, from, to);
        } catch (err) {
          console.error('Export failed', err);
          showBanner('Export failed — see console', 'danger');
        }
      } else {
        showBanner('Export API not available', 'danger');
      }
    });
  }

  // After CVSAStorage/data loaded, re-render UI and enforce role page if session exists
  function onDataLoaded() {
    triggerRenders();
    // Enforce role-based landing
    const session = safeCall(() => (window.CVSAStorage && window.CVSAStorage.getSession ? window.CVSAStorage.getSession() : JSON.parse(localStorage.getItem('cvsa_session') || 'null')));
    if (session && session.role) {
      showPageForRole(session.role);
      // show logout button
      const logout = document.getElementById(IDS.logoutBtn);
      if (logout) logout.style.display = 'inline-block';
    }
  }

  // wire initialization
  function init() {
    attachRoleGuards();
    attachLogout();
    attachFormValidation();
    attachGlobalErrorHandler();
    attachExportHandler();

    // If CVSAStorage exists, wait for its data loaded event; otherwise attempt to render right away
    if (window.CVSAStorage && typeof window.CVSAStorage.on === 'function') {
      window.CVSAStorage.on('cvsa:data:loaded', onDataLoaded);
      // also call now in case storage already loaded
      onDataLoaded();
    } else {
      document.addEventListener('cvsa:data:loaded', onDataLoaded);
      // fallback try
      setTimeout(onDataLoaded, 300);
    }

    // Also watch for booking/location/volunteer changes to trigger renders
    const events = ['cvsa:volunteers:updated','cvsa:locations:updated','cvsa:schedules:updated','cvsa:bookings:updated','cvsa:session:updated'];
    events.forEach(ev => document.addEventListener(ev, () => {
      triggerRenders();
    }));
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // expose small global helpers for QA/demo
  window.CVSA_QA = {
    showBanner,
    triggerRenders,
    showPageForRole,
    attachFormValidation,
    attachRoleGuards,
  };
})();