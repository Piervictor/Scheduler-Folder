# Testing Guide - Volunteer Scheduler
**Testing Recommendations Applied**

## 🎯 Overview

This guide walks you through testing the two main features:
1. **30-minute cancellation policy** for volunteers
2. **Congregation-based filtering** for elders

Test data has been automatically initialized with realistic scenarios.

---

## 📊 Test Data Summary

### Volunteers Created (7 total)

#### Taytay Congregation (3 volunteers - Elder can see)
1. **Maria Santos** - maria.santos@example.com
   - Regular Pioneer, S-73 ✓, Seminar ✓, Active ✓
   
2. **Jose Reyes** - jose.reyes@example.com
   - Ministerial Servant, S-73 ✓, Seminar ✓, Active ✓
   
3. **Ana Cruz** - ana.cruz@example.com
   - Publisher, S-73 ✓, Seminar ✗, Active ✓

#### Angono Congregation (2 volunteers - Elder should NOT see)
4. **Pedro Garcia** - pedro.garcia@example.com
   - Elder, S-73 ✓, Seminar ✓, Active ✓
   
5. **Linda Flores** - linda.flores@example.com
   - Regular Pioneer, S-73 ✓, Seminar ✓, Active ✓

#### Pritil Congregation (2 volunteers)
6. **Roberto Diaz** - roberto.diaz@example.com
   - Ministerial Servant, S-73 ✗, Seminar ✓, Active ✓
   
7. **Carmen Lopez** - carmen.lopez@example.com
   - Publisher, S-73 ✓, Seminar ✓, Active ✗ (temporarily inactive)

### Test Bookings Created

| Volunteer | Location | Date | Time | Status | Purpose |
|-----------|----------|------|------|--------|---------|
| Maria Santos | Taytay Market | TODAY | Future slot (~3hrs) | Assigned | Test cancellation (still cancellable) |
| Jose Reyes | Taytay Market | TODAY | Current hour | Assigned | Test cancellation (TOO CLOSE - cannot cancel) |
| Ana Cruz | Angono Plaza | TOMORROW | 10-12pm | Assigned | Test cancellation (cancellable) |
| Maria Santos | Angono Plaza | NEXT WEEK | 6-8am | Assigned | Future booking |
| Jose Reyes | Taytay Market | NEXT WEEK | 2-4pm | Checked-in | Completed shift |
| Pedro Garcia | Angono Plaza | TOMORROW | 8-10am | Assigned | Angono congregation (elder won't see) |
| Linda Flores | Pritil Entrance | NEXT WEEK | 12-2pm | Assigned | Angono congregation (elder won't see) |
| Maria Santos | Taytay Market | LAST WEEK | 10-12pm | Checked-in | Past booking (history) |

---

## 🧪 Test Case 1: Volunteer Cancellation Policy (30 minutes)

### ✅ Test Scenario A: Too Close to Cancel (Current Hour)

**Steps:**
1. Open `index.html` in browser
2. Login with:
   - Username: `jose.reyes@example.com`
   - Password: *(none needed for demo)*
   - Role: Volunteer
3. Click **"My Assignments"** button
4. Look for the booking for TODAY at the current hour
5. Click **"Cancel"** button

**Expected Result:**
- ❌ Modal appears: "Too late to cancel"
- Message: "Reservations may be cancelled up to 30 minutes prior to duty."
- Blue note at top of modal reminds about 30-minute policy

---

### ✅ Test Scenario B: Still Cancellable (3+ hours away)

**Steps:**
1. Stay logged in as Jose or login as Maria (maria.santos@example.com)
2. Click **"My Assignments"**
3. Find booking for TODAY but later in the day (3+ hours away)
4. Click **"Cancel"** button

**Expected Result:**
- ✓ Confirmation modal: "Cancel your booking on..."
- After confirming, booking is removed
- Success toast: "Booking canceled"

---

### ✅ Test Scenario C: Cancel Tomorrow's Booking

**Steps:**
1. Login as `ana.cruz@example.com` (Volunteer role)
2. Click **"My Assignments"**
3. Find booking for TOMORROW at 10-12pm
4. Click **"Cancel"**

**Expected Result:**
- ✓ Cancellation allowed (more than 30 minutes away)
- Booking successfully removed

---

### ✅ Test Scenario D: Cancellation Policy Note Visibility

**Steps:**
1. Login as any volunteer
2. Click on any location card (e.g., "Taytay Market")
3. View the time slots modal

**Expected Result:**
- Blue info box displayed above time slots
- Message: "📌 Note: Reservations may be cancelled up to 30 minutes prior to duty."
- Note also appears in "My Assignments" modal

---

## 👔 Test Case 2: Elder Congregation Filtering

### ✅ Test Scenario A: Elder Sees Only Their Congregation

**Steps:**
1. Logout (if logged in)
2. Login with:
   - Username: `elder`
   - Password: `elder`
   - Role: Elder
3. Observe the dashboard

**Expected Result:**
- Congregation selector is **hidden** or shows as read-only badge: "Taytay Congregation"
- Green info note: "ℹ️ Note: You can only view volunteers and assignments from your congregation: Taytay Congregation"
- Statistics show:
  - **3 volunteers** (Maria, Jose, Ana only)
  - **Assignments**: Only bookings by Taytay volunteers visible
  - **No data** from Pedro Garcia or Linda Flores (Angono Congregation)

---

### ✅ Test Scenario B: Verify Filtered Volunteers Table

**Steps:**
1. While logged in as Elder
2. Scroll to "Volunteers" section
3. Review the table

**Expected Result:**
- **Only 3 rows** visible:
  1. Maria Santos - Taytay Congregation
  2. Jose Reyes - Taytay Congregation
  3. Ana Cruz - Taytay Congregation
- Pedro Garcia and Linda Flores **not visible**
- Service hours calculated only for Taytay volunteers

---

### ✅ Test Scenario C: Verify Filtered Shifts

**Steps:**
1. While logged in as Elder
2. Scroll to "Shifts" section
3. Review the assignments list

**Expected Result:**
- **Only shifts** assigned to Taytay congregation volunteers shown
- Bookings for Pedro Garcia (Angono) **not visible**
- Bookings for Linda Flores (Angono) **not visible**
- Total count reflects only Taytay bookings

---

### ✅ Test Scenario D: Search Within Congregation

**Steps:**
1. While logged in as Elder
2. Use "Volunteer search" box
3. Type "Pedro" (from Angono Congregation)
4. Then type "Maria" (from Taytay)

**Expected Result:**
- Searching "Pedro" returns **0 results** (filtered out)
- Searching "Maria" shows **Maria Santos** (correct congregation)
- Search only operates on visible (Taytay) volunteers

---

### ✅ Test Scenario E: Date Range Filtering

**Steps:**
1. While logged in as Elder
2. Adjust "From" and "To" date fields
3. Click "Filter"
4. Try different date ranges:
   - Last 7 days
   - Last 30 days
   - Next 7 days

**Expected Result:**
- Date filtering works correctly
- Always shows **only Taytay congregation** bookings within the date range
- Statistics update accordingly
- "Service hours" recalculates based on filtered range

---

### ✅ Test Scenario F: Print Report (Congregation Scoped)

**Steps:**
1. While logged in as Elder
2. Click "Print report" button
3. Review the print preview

**Expected Result:**
- New window opens with printable report
- Report header shows current date
- **Only Taytay Congregation data** included
- Summary statistics, volunteers table, and shifts list all filtered
- Ready to print or save as PDF

---

## 🔄 Testing Admin Access (Bonus)

### ✅ Admin Sees All Congregations

**Steps:**
1. Logout
2. Login as:
   - Username: `admin`
   - Password: `admin`
   - Role: Admin
3. Go to Admin Panel > Volunteers tab

**Expected Result:**
- **All 7 volunteers** visible (from all 3 congregations)
- Can search/filter by any congregation
- Full access to all data

---

## 🧹 Reset Test Data

To start over with fresh test data:

### Option 1: Clear Specific Data
```javascript
// Run in browser console:
localStorage.removeItem('cvsa_test_data_initialized');
localStorage.removeItem('cvsa_bookings');
location.reload();
```

### Option 2: Clear All Data
1. Open browser DevTools (F12)
2. Go to Application tab
3. Click "Clear storage"
4. Refresh page
5. Test data will reinitialize automatically

---

## 📝 Verification Checklist

### Volunteer Cancellation (30 minutes)
- [ ] Cannot cancel booking within 30 minutes of start time
- [ ] Can cancel booking more than 30 minutes away
- [ ] Policy note visible in location view modal
- [ ] Policy note visible in My Assignments modal
- [ ] Error message clearly states 30-minute policy
- [ ] Successful cancellation shows confirmation

### Elder Congregation Filtering
- [ ] Elder automatically assigned to "Taytay Congregation"
- [ ] Congregation selector hidden/read-only for elder
- [ ] Info note displayed about congregation restriction
- [ ] Only 3 Taytay volunteers shown (not 7 total)
- [ ] Only Taytay volunteer bookings shown
- [ ] Search operates only on Taytay volunteers
- [ ] Statistics calculated only for Taytay data
- [ ] Date filtering respects congregation filter
- [ ] Print report contains only Taytay data
- [ ] Other congregations' data not visible at all

### Admin Verification
- [ ] Admin sees all 7 volunteers
- [ ] Admin sees all congregations
- [ ] Admin can manage all data
- [ ] Congregation column shows correctly in table

---

## 🐛 Troubleshooting

**Problem:** Test data not appearing
- **Solution**: Clear localStorage and refresh page

**Problem:** Cannot see test bookings
- **Solution**: Check browser console for errors. Run:
  ```javascript
  JSON.parse(localStorage.getItem('cvsa_bookings'))
  ```

**Problem:** Elder sees all congregations
- **Solution**: Check auth.js - elder user should have `congregation: 'Taytay Congregation'` property

**Problem:** Cancellation policy still shows 24 hours
- **Solution**: Hard refresh (Ctrl+Shift+R) to clear cached JavaScript

---

## ✅ Success Criteria

All test scenarios should pass:
1. ✅ Volunteers cannot cancel within 30 minutes
2. ✅ Volunteers can cancel with 30+ minutes notice
3. ✅ Elders see only their congregation's data
4. ✅ Info notes clearly communicate policies
5. ✅ All filtering and searching respects congregation boundaries
6. ✅ Admin has full access to all data

---

**Testing completed on:** November 25, 2025  
**Test data version:** 1.0  
**Status:** Ready for testing
