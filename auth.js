/**
 * auth.js
 * Congregation Volunteer Scheduler — Authentication & Role-based Access (client-side demo)
 *
 * Features:
 * - Login with username/password (demo accounts)
 * - Role-based access control (Volunteer, Elder, Admin, Coordinator, Shift Manager, Reporter)
 * - Session management in localStorage (token + expiry)
 * - Logout
 * - Role-specific dashboard display (maps roles to page IDs; creates simple placeholders if missing)
 * - Form validation and inline error messages
 * - Error messages for invalid credentials
 *
 * Usage:
 * - Include this file after your HTML body or at the end of the document:
 *     <script src="auth.js"></script>
 *
 * Notes:
 * - This is a client-side demo only. For production, replace with server-side authentication,
 *   secure cookies, proper hashing, HTTPS, CSRF protection, and role checks on the backend.
 */

/* -----------------------------
   Configuration & Demo Accounts
   ----------------------------- */
const AUTH_CONFIG = {
  storageKey: 'cvsa_session',
  sessionDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  minPasswordLength: 4,
  // Map role names to target page element ids (these should exist in your HTML).
  // If a page ID does not exist, the script will create a simple placeholder page so role navigation still works.
  roleToPageId: {
    volunteer: 'volunteer-dashboard',
    elder: 'elder-dashboard',
    admin: 'admin-panel',
    coordinator: 'coordinator-dashboard',
    'shift-manager': 'shift-manager-dashboard',
    reporter: 'reporter-dashboard'
  }
};

// Demo user database (client-side). Replace with server calls in production.
const DEMO_USERS = [
  { username: 'admin', password: 'admin', role: 'admin', displayName: 'Administrator' },
  { username: 'volunteer', password: 'volunteer', role: 'volunteer', displayName: 'Volunteer Demo' },
  { username: 'elder', password: 'elder', role: 'elder', displayName: 'Elder Demo', congregation: 'Taytay Congregation' },

  // Extra demo accounts for other roles:
  { username: 'coordinator', password: 'coord', role: 'coordinator', displayName: 'Coordinator Demo' },
  { username: 'shiftmgr', password: 'shiftmgr', role: 'shift-manager', displayName: 'Shift Manager Demo' },
  { username: 'reporter', password: 'reporter', role: 'reporter', displayName: 'Reporter Demo' }
];

/* -----------------------------
   Utility helpers
   ----------------------------- */
function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

function nowMs() { return Date.now(); }
function makeToken(len = 32) {
  // quick random token generator (not cryptographically secure)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/* -----------------------------
   Session management (localStorage)
   ----------------------------- */
function saveSession(session) {
  try {
    localStorage.setItem(AUTH_CONFIG.storageKey, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save session to localStorage', err);
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG.storageKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.token || !session.expiry) return null;
    if (nowMs() > session.expiry) {
      // expired
      clearSession();
      return null;
    }
    return session;
  } catch (err) {
    console.error('Failed to load session from localStorage', err);
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(AUTH_CONFIG.storageKey);
  } catch (err) {
    console.error('Failed to clear session', err);
  }
}

/* -----------------------------
   Auth logic
   ----------------------------- */
function findUser(username) {
  return DEMO_USERS.find(u => u.username.toLowerCase() === (username || '').toLowerCase()) || null;
}

function validateCredentials({ username, password }) {
  const errors = [];
  if (!username || !username.trim()) errors.push('Username is required.');
  if (!password) errors.push('Password is required.');
  else if (password.length < AUTH_CONFIG.minPasswordLength) {
    errors.push(`Password must be at least ${AUTH_CONFIG.minPasswordLength} characters.`);
  }
  return errors;
}

/**
 * Authenticate user (demo): returns { ok: boolean, message, user? }
 * Production: replace with API call to validate username/password and return token + role.
 */
function authenticate(username, password) {
  const user = findUser(username);
  if (!user) return { ok: false, message: 'Invalid username or password.' };
  if (user.password !== password) return { ok: false, message: 'Invalid username or password.' };
  return { ok: true, user };
}

/* -----------------------------
   UI helpers: show/hide pages & placeholders
   ----------------------------- */
function getPageElementForRole(role) {
  const pageId = AUTH_CONFIG.roleToPageId[role] || null;
  if (!pageId) return null;
  let el = document.getElementById(pageId);
  if (!el) {
    // Create a placeholder page so navigation still works for less-common roles.
    const main = document.querySelector('main') || document.body;
    el = document.createElement('section');
    el.id = pageId;
    el.className = 'page';
    el.innerHTML = `
      <div class="card">
        <h2>${capitalize(role)} Dashboard</h2>
        <p class="muted">This is a generated placeholder dashboard for the <strong>${role}</strong> role.</p>
        <p class="small">Integrate or expand this page in your HTML for a custom experience.</p>
      </div>
    `;
    main.appendChild(el);
  }
  return el;
}

function showPageById(id) {
  // Hide all .page elements, show the one with id
  const pages = qsa('.page');
  pages.forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  // Toggle top logout button if present
  const logoutBtn = document.getElementById('demo-logout');
  if (logoutBtn) {
    if (id === 'login-page') logoutBtn.style.display = 'none';
    else logoutBtn.style.display = 'inline-block';
  }
}

function showDashboardForRole(role) {
  const page = getPageElementForRole(role);
  if (page) {
    showPageById(page.id);
    onEnterRole(role);
  } else {
    // fallback to login page
    showPageById('login-page');
  }
}

/* Optional hook: run when entering a role-based dashboard (for custom behaviour) */
function onEnterRole(role) {
  // Example: set a welcome message if there's an element to receive it
  try {
    const welcomeEl = qs('.welcome-message');
    if (welcomeEl) {
      const session = loadSession();
      welcomeEl.textContent = session ? `Welcome, ${session.displayName || session.username} (${capitalize(role)})` : '';
    }
  } catch (e) { /* ignore */ }
}

/* -----------------------------
   Login flow & form handling
   ----------------------------- */
function createLoginErrorContainer() {
  let container = document.getElementById('login-error');
  if (!container) {
    const loginWrap = qs('.login-wrap') || qs('#login-page') || document.body;
    container = document.createElement('div');
    container.id = 'login-error';
    container.setAttribute('role', 'alert');
    container.style.marginTop = '0.6rem';
    loginWrap.appendChild(container);
  }
  return container;
}

function setLoginError(messages) {
  const container = createLoginErrorContainer();
  if (!messages) { container.innerHTML = ''; container.style.display = 'none'; return; }
  const lines = Array.isArray(messages) ? messages : [messages];
  container.style.display = 'block';
  container.style.background = '#FFF5F5';
  container.style.border = '1px solid rgba(239,68,68,0.12)';
  container.style.color = '#7F1D1D';
  container.style.padding = '0.6rem';
  container.style.borderRadius = '8px';
  container.style.fontSize = '0.95rem';
  container.innerHTML = lines.map(l => `<div>${escapeHtml(l)}</div>`).join('');
}

function clearLoginError() { setLoginError(null); }

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function handleLoginSubmit(ev) {
  ev.preventDefault();
  clearLoginError();

  const username = (qs('#username') || {}).value || '';
  const password = (qs('#password') || {}).value || '';
  const roleSelect = qs('#role');
  const selectedRole = roleSelect ? roleSelect.value : null;

  // Basic validation
  const validationErrors = validateCredentials({ username, password });
  if (validationErrors.length > 0) {
    setLoginError(validationErrors);
    return;
  }

  const result = authenticate(username, password);
  if (!result.ok) {
    setLoginError(result.message);
    return;
  }

  // If a role was explicitly selected in the login form (demo), respect it; otherwise use assigned role.
  const roleToUse = selectedRole || result.user.role;

  // Create session
  const session = {
    username: result.user.username,
    role: roleToUse,
    displayName: result.user.displayName || result.user.username,
    congregation: result.user.congregation || null,
    token: makeToken(40),
    issuedAt: nowMs(),
    expiry: nowMs() + AUTH_CONFIG.sessionDurationMs
  };
  saveSession(session);

  // Navigate to role dashboard
  showDashboardForRole(roleToUse);

  // Optionally show a success toast / message (use modal-backdrop if exists)
  showModalOnce('Signed in', `<p>Signed in as <strong>${escapeHtml(session.displayName)}</strong> (${escapeHtml(roleToUse)}) — demo session stored in localStorage.</p>`);
}

/* -----------------------------
   Logout
   ----------------------------- */
function logout() {
  clearSession();
  // hide pages & go to login
  showPageById('login-page');
  // remove any login errors
  clearLoginError();
  // show small feedback
  showModalOnce('Signed out', '<p>You have been signed out.</p>');
}

/* -----------------------------
   Access enforcement (role-based)
   ----------------------------- */
function getCurrentSession() { return loadSession(); }
function isAuthenticated() { return !!getCurrentSession(); }
function hasRole(role) {
  const s = getCurrentSession();
  if (!s) return false;
  return s.role === role;
}
function isInRoles(roles = []) {
  const s = getCurrentSession();
  if (!s) return false;
  return roles.includes(s.role);
}

/* Call this before showing a sensitive page if you want to enforce server-like checks */
function requireRole(allowedRoles = [], onDeny = null) {
  if (!isAuthenticated()) {
    showModalOnce('Access denied', '<p>You must be signed in to access this section.</p>');
    showPageById('login-page');
    return false;
  }
  if (!isInRoles(allowedRoles)) {
    const role = getCurrentSession().role;
    showModalOnce('Insufficient permissions', `<p>Your role (${escapeHtml(role)}) cannot access this area.</p>`);
    return false;
  }
  return true;
}

/* -----------------------------
   Lightweight modal / toast
   - Uses existing modal-backdrop/.modal in the page if present.
   - Falls back to alert() if not found.
   ----------------------------- */
function showModalOnce(title, htmlBody = '', timeoutMs = 3500) {
  const backdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');

  if (backdrop && modalTitle && modalBody) {
    modalTitle.innerHTML = escapeHtml(title);
    modalBody.innerHTML = htmlBody;
    // hide confirm/cancel buttons for transient modal
    if (modalConfirm) modalConfirm.style.display = 'none';
    if (modalCancel) modalCancel.style.display = 'none';
    backdrop.style.display = 'flex';
    backdrop.setAttribute('aria-hidden', 'false');

    // auto-close
    const t = setTimeout(() => {
      backdrop.style.display = 'none';
      backdrop.setAttribute('aria-hidden', 'true');
      if (modalConfirm) modalConfirm.style.display = '';
      if (modalCancel) modalCancel.style.display = '';
      clearTimeout(t);
    }, timeoutMs);
    return;
  }

  // fallback
  try { alert(`${title}\n\n${(htmlBody || '').replace(/<[^>]+>/g, '')}`); } catch (e) { console.log(title, htmlBody); }
}

/* -----------------------------
   Initialization: wire up forms and session restore
   ----------------------------- */
function initAuthUI() {
  // Wire login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // Wire logout button
  const logoutBtn = document.getElementById('demo-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Wire demo-create to show a simple message (keeps behavior of sample HTML)
  const demoCreate = document.getElementById('demo-create');
  if (demoCreate) {
    demoCreate.addEventListener('click', (e) => {
      e.preventDefault();
      showModalOnce('Create account', '<p>This demo does not create a real account. Use the following demo credentials:<ul><li>admin/admin</li><li>volunteer/volunteer</li><li>elder/elder</li></ul></p>', 6000);
    });
  }

  // Always show login page first - do not auto-restore session
  // Users must explicitly log in each time they open the page
  showPageById('login-page');
  
  // Clear any existing session on page load to force fresh login
  clearSession();

  // Intercept clicks on links or buttons that should be role-protected (example)
  // Elements can include data-required-roles="admin,shift-manager" attribute with comma-separated roles
  document.body.addEventListener('click', (ev) => {
    const target = ev.target.closest('[data-required-roles]');
    if (!target) return;
    const rolesStr = target.getAttribute('data-required-roles');
    if (!rolesStr) return;
    const allowedRoles = rolesStr.split(',').map(r => r.trim()).filter(Boolean);
    if (!requireRole(allowedRoles)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });
}

/* -----------------------------
   Helper: capitalize
   ----------------------------- */
function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* -----------------------------
   Expose a small API on window for integration & testing
   ----------------------------- */
window.CVSAuth = {
  init: initAuthUI,
  login: (username, password, role) => {
    // programatic login helper (returns { ok, message })
    const validationErrors = validateCredentials({ username, password });
    if (validationErrors.length) return { ok: false, message: validationErrors.join(' ') };
    const res = authenticate(username, password);
    if (!res.ok) return res;
    const roleToUse = role || res.user.role;
    const session = {
      username: res.user.username,
      role: roleToUse,
      displayName: res.user.displayName || res.user.username,
      congregation: res.user.congregation || null,
      token: makeToken(40),
      issuedAt: nowMs(),
      expiry: nowMs() + AUTH_CONFIG.sessionDurationMs
    };
    saveSession(session);
    showDashboardForRole(roleToUse);
    return { ok: true, session };
  },
  logout,
  currentSession: loadSession,
  requireRole,
  isAuthenticated,
  demoUsers: DEMO_USERS
};

/* -----------------------------
   Auto-init on DOMContentLoaded
   ----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  try {
    initAuthUI();
  } catch (err) {
    console.error('Failed to initialize auth UI', err);
  }
});