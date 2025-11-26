# Congregation Volunteer Scheduler - AI Coding Agent Guide

## Architecture Overview

This is a **pure vanilla JavaScript** (zero dependencies) single-page application with role-based access for managing volunteer scheduling. All data persists in browser `localStorage` - **this is client-side demo code only**.

### Core Module Pattern

Every module follows an IIFE pattern with delayed initialization:
```javascript
(function() {
  'use strict';
  function init() {
    if (typeof SharedUtils === 'undefined') {
      setTimeout(init, 50); // Wait for dependencies
      return;
    }
    document.addEventListener('DOMContentLoaded', setup);
  }
  window.ModuleName = { /* public API */ };
  init();
})();
```

### Critical Script Load Order

**NEVER reorder these** - modules depend on each other sequentially:
1. `runtime-fixes.js` - Browser polyfills (CustomEvent, Element.closest)
2. `shared-utils.js` - Core utilities library (modals, toast, validation, storage)
3. `integration-bridge.js` - Backward compatibility layer, global helpers
4. `localstore.js` - Storage wrapper (backward compat for SharedUtils.Storage)
5. `auth.js` - Authentication system (role-based access control)
6. All other modules (order doesn't matter): admin-*.js, volunteer-dashboard.js, elder-dashboard.js, advanced-features.js

### Key Data Flow

```
localStorage (cvsa_* keys)
    ↓
SharedUtils.Storage (versioned, error-handled)
    ↓
Module APIs (AdminLocations, AdminSchedules, etc.)
    ↓
UI updates (DOM manipulation + Toast/Modal feedback)
```

## Essential APIs

### SharedUtils (Global Singleton)
**Location**: `shared-utils.js` (750+ lines)  
**Purpose**: Centralized utilities to prevent code duplication

```javascript
// Modal with accessibility (focus trap, ARIA, keyboard nav)
SharedUtils.Modal.open({ title, content, showConfirm, onConfirm });
SharedUtils.Modal.close();

// Toast notifications (auto-dismiss, non-blocking)
SharedUtils.Toast.success('Operation successful');
SharedUtils.Toast.error('Operation failed');

// Storage (automatic error handling, versioning)
SharedUtils.Storage.save(key, value);  // Returns { success, error }
SharedUtils.Storage.load(key, defaultValue);
SharedUtils.Storage.backup();  // Returns JSON blob

// Validation (always validate before saving)
SharedUtils.Validator.email(email);  // Boolean
SharedUtils.Validator.required(value, 'Field Name');  // { valid, error }
SharedUtils.Validator.date(dateStr);

// Error logging (max 100 entries, exportable)
SharedUtils.ErrorHandler.error('Message', dataObject);
SharedUtils.ErrorHandler.getLogs();

// Performance
SharedUtils.Performance.debounce(fn, 300);
SharedUtils.Performance.throttle(fn, 300);

// Date utilities
SharedUtils.DateUtils.format(date, 'YYYY-MM-DD');
SharedUtils.DateUtils.today();  // Returns 'YYYY-MM-DD'
SharedUtils.DateUtils.isPast(dateStr);
```

### Auth System
**Location**: `auth.js`  
**Demo Users**: 
- admin/admin (full access)
- volunteer/volunteer (book slots)
- elder/elder (read-only, Taytay Congregation only)

```javascript
// Check auth before any protected operation
if (!Auth.requireAuth('admin')) return; // Shows toast, returns false

const user = Auth.getCurrentUser();  // { id, username, role, displayName, congregation }
Auth.hasRole('admin');  // Boolean
Auth.login(username, password, role);  // Returns { success, user, error }
Auth.logout();
```

**Note**: Elder accounts have `congregation` field - used for filtering data by congregation

### Module Namespaces
All modules expose APIs via `window.*`:
- `window.AdminLocations` - CRUD for service locations
- `window.AdminSchedules` - Time slot configuration per location
- `window.AdminVolunteers` - Volunteer database management
- `window.AdminAssignments` - Assignment/booking logic
- `window.VDB` (volunteer-dashboard.js) - Volunteer UI
- `window.Auth` - Authentication

## localStorage Keys Convention

**NEVER use raw localStorage** - always use `SharedUtils.Storage`:
```javascript
// Key naming: cvsa_<entity>
STORAGE_KEYS = {
  VERSION: 'cvsa_version',
  LOCATIONS: 'cvsa_locations',
  VOLUNTEERS: 'cvsa_volunteers',
  BOOKINGS: 'cvsa_bookings',
  SESSION: 'cvsa_session',
  SCHEDULES: 'cvsa_location_slots',
  PREFERENCES: 'cvsa_preferences'
}
```

## Development Workflows

### Adding a New Feature

1. **Create module file** following IIFE pattern with delayed init
2. **Use try-catch** around all operations:
   ```javascript
   try {
     // Your code
     SharedUtils.Toast.success('Success message');
   } catch (err) {
     SharedUtils.ErrorHandler.error('Feature failed', err);
     SharedUtils.Toast.error('User-friendly message');
   }
   ```
3. **Validate all inputs** before saving:
   ```javascript
   const check = SharedUtils.Validator.required(value, 'Field');
   if (!check.valid) {
     SharedUtils.Toast.error(check.error);
     return;
   }
   ```
4. **Add to index.html** after dependencies: `<script src="my-feature.js"></script>`

### Debugging
- Click red ⚠ button (bottom-left) to view error log
- Check browser console for SharedUtils availability
- Use `SharedUtils.ErrorHandler.getLogs()` in console
- Test backup/restore: Admin > Settings > Download/Restore Backup

### Testing Checklist
- Test in Chrome, Firefox (Safari/Edge if possible)
- Test mobile responsiveness (<768px breakpoint)
- Test keyboard navigation (Tab, Enter, Escape)
- Test with empty data state
- Test error scenarios (invalid inputs, storage full)
- Check console for errors/warnings

## Project-Specific Patterns

### Modal Usage
**Always use SharedUtils.Modal**, not raw DOM manipulation:
```javascript
SharedUtils.Modal.open({
  title: 'Confirm Action',
  content: '<p>Are you sure?</p>',
  showConfirm: true,
  confirmText: 'Yes, Delete',
  onConfirm: () => {
    // Confirmed action
  }
});
```

### Form Validation Pattern
```javascript
function validateForm(data) {
  const checks = [
    SharedUtils.Validator.required(data.name, 'Name'),
    SharedUtils.Validator.email(data.email) ? { valid: true } : { valid: false, error: 'Invalid email' }
  ];
  const invalid = checks.find(c => !c.valid);
  if (invalid) {
    SharedUtils.Toast.error(invalid.error);
    return false;
  }
  return true;
}
```

### Event Communication
Modules communicate via custom events:
```javascript
// Emit
document.dispatchEvent(new CustomEvent('cvsa:schedules:updated', { detail: { locationId } }));

// Listen
document.addEventListener('cvsa:schedules:updated', (e) => {
  console.log('Location updated:', e.detail.locationId);
});
```

### Time Slot Configuration
- **Default slots**: 7 slots from 6am-8pm (2-hour blocks) in `admin-schedules.js`
- **Per-location override**: Admins can customize via `AdminSchedules.setSlotsForLocation(locationId, slotsArray)`
- **Volunteers see**: Location-specific slots or fallback to defaults

### Role-Based UI Visibility
Check current user role before rendering:
```javascript
const user = Auth.getCurrentUser();
if (user && user.role === 'admin') {
  // Show admin controls
}
```

## Common Pitfalls

❌ **DON'T** use `localStorage.setItem()` directly - quota errors won't be handled  
✅ **DO** use `SharedUtils.Storage.save(key, value)` which returns `{ success, error }`

❌ **DON'T** create modals with raw DOM - accessibility will be broken  
✅ **DO** use `SharedUtils.Modal.open()` with proper ARIA, focus trap, keyboard nav

❌ **DON'T** forget error handling - app will crash for users  
✅ **DO** wrap operations in try-catch + log with `SharedUtils.ErrorHandler.error()`

❌ **DON'T** show `alert()` or `confirm()` - breaks UX  
✅ **DO** use `SharedUtils.Toast.*` and `SharedUtils.Modal.open({ showConfirm: true })`

❌ **DON'T** add external dependencies (npm packages)  
✅ **DO** keep it vanilla JS - that's the whole point of this project

## Mobile Responsiveness

- **Breakpoints**: 640px, 768px (defined in index.html `<style>`)
- **Tables**: Convert to cards on mobile using `data-label` attributes
- **Touch targets**: Minimum 44x44px (already styled)
- **Test**: Chrome DevTools mobile emulation (F12 > Toggle Device Toolbar)

## Security Notes

⚠️ **This is demo code** - authentication is client-side only. For production:
- Replace localStorage with backend database
- Use server-side authentication (JWT/OAuth)
- Hash passwords with bcrypt/argon2
- Add HTTPS, CSRF protection, rate limiting
- Sanitize inputs on server (client validation is UX, not security)

See README.md "Before Production" checklist for full details.

## Documentation Files

- **README.md** - Comprehensive feature list, setup, architecture (500+ lines)
- **DEVELOPER_GUIDE.md** - Detailed API docs, code standards, troubleshooting
- **IMPLEMENTATION_SUMMARY.md** - What was built, stats, testing checklist
- **QUICKSTART.md** - 5-minute getting started guide
- **TESTING_GUIDE.md** - Complete test scenarios for 30-min cancellation & congregation filtering
- **TEST_ACCOUNTS.md** - Quick reference for test accounts and data

## Useful Commands (Browser Console)

```javascript
// Check dependencies loaded
console.log(SharedUtils, Auth);

// View current user
Auth.getCurrentUser()

// Check storage data
SharedUtils.Storage.load('cvsa_locations')

// Test modal
SharedUtils.Modal.open({ title: 'Test', content: 'Hello' })

// Test toast
SharedUtils.Toast.success('Test notification')

// Export error log
SharedUtils.ErrorHandler.exportLogs()
```

---

**Last Updated**: November 25, 2025  
**Codebase Stats**: ~3,500 lines JS, 927 lines HTML, zero dependencies  
**Key Philosophy**: Vanilla JS, accessibility-first, client-side demo with production-ready patterns
