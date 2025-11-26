# 🔑 Test Accounts Quick Reference

## System Accounts

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| **Admin** | admin | admin | Full system access - see all congregations |
| **Volunteer** | volunteer | volunteer | Book and manage own assignments |
| **Elder** | elder | elder | Read-only for Taytay Congregation only |

## Test Volunteer Accounts (can login as volunteers)

### Taytay Congregation (Elder CAN see)
| Name | Email | Privilege | S-73 | Seminar |
|------|-------|-----------|------|---------|
| Maria Santos | maria.santos@example.com | Regular Pioneer | ✓ | ✓ |
| Jose Reyes | jose.reyes@example.com | Ministerial Servant | ✓ | ✓ |
| Ana Cruz | ana.cruz@example.com | Publisher | ✓ | ✗ |

### Angono Congregation (Elder CANNOT see)
| Name | Email | Privilege | S-73 | Seminar |
|------|-------|-----------|------|---------|
| Pedro Garcia | pedro.garcia@example.com | Elder | ✓ | ✓ |
| Linda Flores | linda.flores@example.com | Regular Pioneer | ✓ | ✓ |

### Pritil Congregation
| Name | Email | Privilege | S-73 | Seminar |
|------|-------|-----------|------|---------|
| Roberto Diaz | roberto.diaz@example.com | Ministerial Servant | ✗ | ✓ |
| Carmen Lopez | carmen.lopez@example.com | Publisher | ✓ | ✓ |

---

## 🧪 Quick Test Commands

### Browser Console Commands

```javascript
// View all test bookings
JSON.parse(localStorage.getItem('cvsa_bookings'))

// View all volunteers
JSON.parse(localStorage.getItem('cvsa_volunteers'))

// Check current session
JSON.parse(localStorage.getItem('cvsa_session'))

// Reset test data
localStorage.removeItem('cvsa_test_data_initialized');
localStorage.removeItem('cvsa_bookings');
location.reload();

// Clear everything
localStorage.clear();
location.reload();
```

---

## 📋 Quick Test Scenarios

### Test 1: 30-Minute Cancellation
1. Login: `jose.reyes@example.com` (Volunteer)
2. Click "My Assignments"
3. Try to cancel TODAY's booking → Should FAIL ⛔

### Test 2: Elder Filtering
1. Login: `elder/elder` (Elder)
2. Check volunteers count → Should show **3** (not 7) ✓
3. Check congregation → Fixed to "Taytay Congregation" ✓

### Test 3: Admin Full Access
1. Login: `admin/admin`
2. Admin Panel > Volunteers
3. Should see **7 volunteers** from all congregations ✓

---

## 🎯 Expected Results Summary

| Feature | Expected Behavior |
|---------|------------------|
| **Cancellation Window** | 30 minutes before duty |
| **Taytay Volunteers** | 3 volunteers (Maria, Jose, Ana) |
| **Elder Can See** | Only Taytay Congregation data |
| **Elder Cannot See** | Angono or Pritil congregation data |
| **Cancellation Note** | Visible in 2 places (modal + assignments) |
| **Admin Access** | All 7 volunteers, all congregations |

---

## ⏱️ Test Booking Schedule

| When | Who | Location | Cancellable? |
|------|-----|----------|--------------|
| **TODAY (current hour)** | Jose Reyes | Taytay Market | ❌ NO (too close) |
| **TODAY (+3 hours)** | Maria Santos | Taytay Market | ✅ YES |
| **TOMORROW** | Ana Cruz | Angono Plaza | ✅ YES |
| **NEXT WEEK** | Multiple | Various | ✅ YES |

---

**Print this for quick reference during testing!**
