# Developer Guide
## Congregation Volunteer Scheduler

### 🛠️ Development Setup

#### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Text editor (VS Code, Sublime, Atom, etc.)
- Basic knowledge of HTML, CSS, JavaScript

#### Getting Started
1. Open `index.html` in your browser
2. Open browser DevTools (F12)
3. Edit JS files in your text editor
4. Refresh browser to see changes

---

## 📚 Architecture Overview

### File Dependencies

```
runtime-fixes.js (browser polyfills)
    ↓
shared-utils.js (core utilities)
    ↓
integration-bridge.js (compatibility layer)
    ↓
localstore.js (storage wrapper)
    ↓
auth.js (authentication)
    ↓
├── admin-locations.js
├── admin-schedules.js
├── admin-volunteers.js
├── admin-assignments.js
├── admin-reports.js
├── volunteer-dashboard.js
├── elder-dashboard.js
└── advanced-features.js
```

### Load Order (Critical!)
Scripts MUST be loaded in this order:
1. runtime-fixes.js
2. shared-utils.js
3. integration-bridge.js
4. localstore.js
5. auth.js
6. Module files (any order)

---

## 🧩 Core APIs

### SharedUtils

```javascript
// Available globally as window.SharedUtils

// Storage
SharedUtils.Storage.save(key, value)
SharedUtils.Storage.load(key, defaultValue)
SharedUtils.Storage.remove(key)
SharedUtils.Storage.backup()
SharedUtils.Storage.restore(file)

// Modal
SharedUtils.Modal.open({
  title: 'Modal Title',
  content: 'Content or DOM element',
  showConfirm: true,
  confirmText: 'OK',
  onConfirm: () => { /* callback */ }
})
SharedUtils.Modal.close()

// Toast
SharedUtils.Toast.success('Success message')
SharedUtils.Toast.error('Error message')
SharedUtils.Toast.warning('Warning message')
SharedUtils.Toast.info('Info message')

// Date
SharedUtils.DateUtils.format(date, 'YYYY-MM-DD')
SharedUtils.DateUtils.parse('2025-11-25')
SharedUtils.DateUtils.today()
SharedUtils.DateUtils.isPast(dateStr)
SharedUtils.DateUtils.isFuture(dateStr)

// Validation
SharedUtils.Validator.email(email) // returns boolean
SharedUtils.Validator.phone(phone)
SharedUtils.Validator.required(value, fieldName)
SharedUtils.Validator.date(dateStr)

// Sanitizer
SharedUtils.Sanitizer.escape(html)
SharedUtils.Sanitizer.stripTags(html)

// Error Handler
SharedUtils.ErrorHandler.error(message, data)
SharedUtils.ErrorHandler.warn(message, data)
SharedUtils.ErrorHandler.info(message, data)
SharedUtils.ErrorHandler.getLogs()

// Performance
const debounced = SharedUtils.Performance.debounce(fn, 300)
const throttled = SharedUtils.Performance.throttle(fn, 300)

// Loading
const loader = SharedUtils.Loading.show('#container', 'Loading...')
SharedUtils.Loading.hide(loader)

// UID
const id = SharedUtils.uid('prefix-')
```

### Auth

```javascript
// Available globally as window.Auth

// Login
const result = Auth.login(username, password, role)
// Returns: { success: true/false, user: {...}, error: '...' }

// Logout
Auth.logout()

// Get current user
const user = Auth.getCurrentUser()
// Returns: { id, username, role, displayName, email } or null

// Check authentication
if (Auth.isAuthenticated()) { /* ... */ }

// Check role
if (Auth.hasRole('admin')) { /* ... */ }

// Require authentication
if (!Auth.requireAuth('admin')) return; // Shows toast and returns false
```

### Integration Bridge

```javascript
// Global helpers (backward compatibility)

openModal({
  title: 'Title',
  content: 'Content',
  showConfirm: true,
  onConfirm: () => {}
})

closeModal()

showToast('Message', 'success')

escapeHtml(str)

uid('prefix-')
```

---

## 🎨 Adding New Features

### 1. Create a New Module

```javascript
// my-feature.js
(function() {
  'use strict';

  function init() {
    // Wait for dependencies
    if (typeof SharedUtils === 'undefined') {
      setTimeout(init, 50);
      return;
    }

    SharedUtils.ErrorHandler.info('My Feature initialized');
    document.addEventListener('DOMContentLoaded', setup);
  }

  function setup() {
    // Your setup code
  }

  function myFunction() {
    try {
      // Your code
      SharedUtils.Toast.success('Success!');
    } catch (err) {
      SharedUtils.ErrorHandler.error('My feature error', err);
      SharedUtils.Toast.error('Operation failed');
    }
  }

  // Expose API
  window.MyFeature = {
    init,
    myFunction
  };

  // Auto-init
  init();
})();
```

### 2. Add Script to index.html

```html
<script src="my-feature.js"></script>
```

### 3. Use Your Feature

```javascript
MyFeature.myFunction();
```

---

## 🧪 Testing Checklist

### Before Committing Code

#### Functionality
- [ ] Feature works in Chrome
- [ ] Feature works in Firefox
- [ ] Feature works in Safari
- [ ] Feature works in Edge
- [ ] No console errors
- [ ] No console warnings

#### UI/UX
- [ ] Mobile responsive
- [ ] Touch-friendly
- [ ] Loading states shown
- [ ] Success/error feedback
- [ ] Empty states handled

#### Accessibility
- [ ] Keyboard navigable
- [ ] Focus visible
- [ ] ARIA labels added
- [ ] Screen reader friendly
- [ ] Color contrast OK

#### Error Handling
- [ ] Try-catch blocks added
- [ ] Errors logged properly
- [ ] User-friendly error messages
- [ ] Graceful degradation

#### Performance
- [ ] No memory leaks
- [ ] Event listeners cleaned up
- [ ] Debounced where needed
- [ ] No blocking operations

---

## 🐛 Debugging Tips

### View Error Log
1. Click red ⚠ button (bottom-left)
2. View all errors with timestamps
3. Export log as JSON

### Browser Console
```javascript
// Check if utilities loaded
console.log(SharedUtils)
console.log(Auth)

// Get current user
console.log(Auth.getCurrentUser())

// Check storage
console.log(SharedUtils.Storage.load('cvsa_locations'))

// View error logs
console.log(SharedUtils.ErrorHandler.getLogs())

// Test validation
console.log(SharedUtils.Validator.email('test@example.com'))
```

### Common Issues

#### "SharedUtils is undefined"
- Check script load order
- Wait for DOMContentLoaded
- Use init() pattern with setTimeout

#### "Modal not showing"
- Check if modal elements exist in HTML
- Check z-index conflicts
- Check console for errors

#### "Data not persisting"
- Check localStorage quota
- Check browser privacy settings
- Try backup/restore

#### "Styles not applying"
- Check CSS specificity
- Check browser DevTools
- Clear browser cache

---

## 📋 Code Standards

### JavaScript

```javascript
// Use IIFE to avoid global pollution
(function() {
  'use strict';

  // Constants at top
  const CONSTANT_NAME = 'value';

  // Helper functions
  function helperFunction() {
    // ...
  }

  // Public API
  window.ModuleName = {
    publicFunction: helperFunction
  };

  // Auto-init
  init();
})();
```

### Error Handling

```javascript
function myFunction() {
  try {
    // Your code
    const result = dangerousOperation();
    SharedUtils.Toast.success('Success!');
    return result;
  } catch (err) {
    SharedUtils.ErrorHandler.error('Operation failed', err);
    SharedUtils.Toast.error('Could not complete operation');
    return null;
  }
}
```

### Validation

```javascript
function validateForm(data) {
  const errors = [];

  // Check required
  const nameCheck = SharedUtils.Validator.required(data.name, 'Name');
  if (!nameCheck.valid) errors.push(nameCheck.error);

  // Check email
  if (data.email && !SharedUtils.Validator.email(data.email)) {
    errors.push('Invalid email address');
  }

  if (errors.length > 0) {
    SharedUtils.Toast.error(errors[0]);
    return { valid: false, errors };
  }

  return { valid: true };
}
```

### Modal Usage

```javascript
function showConfirmation() {
  SharedUtils.Modal.open({
    title: 'Confirm Action',
    content: '<p>Are you sure?</p>',
    showConfirm: true,
    confirmText: 'Yes',
    onConfirm: () => {
      // Action confirmed
      doSomething();
    }
  });
}
```

---

## 🎨 Styling

### CSS Classes

```css
/* Utility Classes */
.card          /* White card with shadow */
.muted         /* Gray text */
.small         /* Smaller font */
.danger        /* Red button */
.success       /* Green button */
.muted-btn     /* Outlined button */

/* State Classes */
.loading       /* Loading state */
.empty-state   /* Empty state */
.active        /* Active state */

/* Layout Classes */
.grid          /* Auto-fit grid */
.btn-row       /* Button row */
.form-row      /* Form row */
```

### Custom Styles

```css
/* Add to <head> or external CSS */
.my-custom-class {
  /* Your styles */
}
```

---

## 📦 Extending the App

### Add New Role

1. Update auth.js DEMO_USERS
2. Add page section in index.html
3. Add role check in modules
4. Update AUTH_CONFIG.roleToPageId

### Add New Location Field

1. Update DEFAULT_LOCATIONS in admin-locations.js
2. Update form in buildLocationForm()
3. Update table columns
4. Test add/edit/delete

### Add New Report

1. Create function in admin-reports.js
2. Add button to reports tab
3. Generate data
4. Export as CSV/JSON

### Add New Validation

1. Add validator to SharedUtils.Validator
2. Use in forms: `Validator.myNewValidator(value)`
3. Show error with Toast

---

## 🔍 Performance Optimization

### Debounce Search

```javascript
const searchInput = document.getElementById('search');
searchInput.oninput = SharedUtils.Performance.debounce((e) => {
  performSearch(e.target.value);
}, 300);
```

### Lazy Load Data

```javascript
function loadWhenVisible(element) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadData();
        observer.disconnect();
      }
    });
  });
  observer.observe(element);
}
```

### Batch DOM Updates

```javascript
// Bad
items.forEach(item => {
  container.appendChild(renderItem(item));
});

// Good
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(renderItem(item));
});
container.appendChild(fragment);
```

---

## 🔐 Security Best Practices

### Sanitize HTML

```javascript
// Always escape user input
element.textContent = SharedUtils.Sanitizer.escape(userInput);

// Or use innerHTML carefully
element.innerHTML = `<div>${SharedUtils.Sanitizer.escape(userInput)}</div>`;
```

### Validate Input

```javascript
// Server-side validation is still required!
const email = input.value.trim();
if (!SharedUtils.Validator.email(email)) {
  SharedUtils.Toast.error('Invalid email');
  return;
}
```

### Safe Data Access

```javascript
// Use optional chaining
const value = obj?.property?.nested;

// Or check first
if (obj && obj.property) {
  const value = obj.property.nested;
}
```

---

## 📚 Useful Resources

### JavaScript
- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript.info](https://javascript.info/)

### Accessibility
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)

### Testing
- Browser DevTools (F12)
- Lighthouse (Chrome)
- WAVE (accessibility)

---

## 💡 Tips & Tricks

### Quick Console Tests

```javascript
// Test modal
SharedUtils.Modal.open({ title: 'Test', content: 'Hello' })

// Test toast
SharedUtils.Toast.success('Test')

// Check user
Auth.getCurrentUser()

// View data
SharedUtils.Storage.load('cvsa_locations')
```

### Keyboard Shortcuts
- **F12**: Open DevTools
- **Ctrl+Shift+I**: Open DevTools (alternative)
- **Ctrl+R**: Reload page
- **Ctrl+Shift+R**: Hard reload (clear cache)
- **Ctrl+Shift+C**: Inspect element

### Browser DevTools
- **Console**: Run JavaScript
- **Elements**: Inspect HTML/CSS
- **Network**: Monitor requests
- **Application**: View localStorage
- **Sources**: Debug JavaScript

---

## 🤝 Contributing Guidelines

### Before You Start
1. Read all documentation
2. Test in multiple browsers
3. Follow code standards
4. Add error handling
5. Update documentation

### Making Changes
1. Test your changes
2. Check console for errors
3. Verify accessibility
4. Test on mobile
5. Document new features

### Code Review Checklist
- [ ] Follows code standards
- [ ] No console errors
- [ ] Accessible
- [ ] Mobile-friendly
- [ ] Documented
- [ ] Tested

---

**Happy Coding! 🚀**
