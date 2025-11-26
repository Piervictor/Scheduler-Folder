# Quick Start Guide
## Congregation Volunteer Scheduler

### 🎯 5-Minute Setup

#### Step 1: Open the App
Double-click `index.html` or drag it into your browser.

#### Step 2: Sign In
Use any of these demo accounts:

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| Admin | admin | admin | Full system access |
| Volunteer | volunteer | volunteer | Book assignments |
| Elder | elder | elder | Read-only reports |

#### Step 3: Explore

**As Admin:**
1. Click **"Admin Panel"** tab
2. Go to **Locations** - View 5 default service locations
3. Go to **Volunteers** - Add volunteers or import CSV
4. Go to **Assignments** - Drag volunteers to time slots
5. Go to **Reports** - Export data as CSV/JSON

**As Volunteer:**
1. View location cards on dashboard
2. Click **"View slots"** on any location
3. Select a date
4. Click **"Book"** on available time slot
5. Click **"My Preferences"** to set favorites

**As Elder:**
1. View read-only statistics
2. Click **"Export Report"** to download

### 🔥 Key Features to Try

#### 📅 Calendar View
1. Go to **Admin > Schedules**
2. Click **"📅 Calendar View"**
3. Navigate months with arrow buttons
4. Click any day to see assignments

#### ⚙️ Set Preferences (Volunteer)
1. Click **"⚙️ My Preferences"**
2. Check your favorite locations
3. Check preferred time slots
4. Save preferences

#### 💾 Backup Your Data
1. Go to **Admin > Settings**
2. Scroll to "Data Management"
3. Click **"Download Backup"**
4. Save the JSON file

#### 📊 Export Reports
1. Go to **Admin > Reports**
2. Click **"Export CSV"** or **"Export JSON"**
3. Open in Excel or text editor

### 🐛 If Something Goes Wrong

**See the error log:**
- Click the red ⚠ button in bottom-left corner

**Reset everything:**
1. Go to **Admin > Settings**
2. Click **"Clear All Data"**
3. Type "DELETE" to confirm
4. Refresh the page

**Restore from backup:**
1. Go to **Admin > Settings**
2. Click **"Restore Backup"**
3. Select your backup JSON file

### 📱 Mobile Usage

1. Open on your phone browser
2. Add to home screen for app-like experience
3. All features work on mobile!

### ⌨️ Keyboard Shortcuts

- **Tab**: Navigate between elements
- **Enter**: Confirm actions
- **Escape**: Close modals
- **Space**: Check/uncheck boxes

### 🎓 Common Tasks

#### Add a Volunteer
1. **Admin > Volunteers**
2. Click **"Add Volunteer"**
3. Fill name, email, phone, congregation
4. Click **"Save Volunteer"**

#### Create an Assignment
1. **Admin > Assignments**
2. Select a date
3. Drag volunteer from left panel to time slot
4. Or: Select volunteers → click time slot

#### Book a Shift (Volunteer)
1. Click location card
2. Pick a date
3. Click **"Book"** on available slot
4. Confirm

#### Cancel a Booking (Volunteer)
1. Click **"My Assignments"**
2. Find your booking
3. Click **"Cancel"**
4. Confirm (must be 24+ hours before)

### 🎨 Tips & Tricks

1. **Search volunteers**: Type in the search box (debounced for performance)
2. **Filter by date**: Use date picker in assignments view
3. **Check conflicts**: System warns about double-bookings
4. **Mobile tables**: Tables become cards on small screens
5. **Toast notifications**: Success/error messages appear top-right

### ⚡ Performance Tips

- Clear old bookings periodically
- Export and archive old data
- Use search instead of scrolling long lists
- Mobile users: Use WiFi for initial load

### 🔒 Security Reminder

⚠️ This is a **demo app** using browser storage.

**Do NOT use for production without:**
- Real backend server
- Proper authentication
- Password encryption
- HTTPS connection

### 📞 Need Help?

1. Read the full **README.md**
2. Check browser console (F12)
3. View error log (⚠ button)
4. Restore from backup

---

**Enjoy scheduling! 🎉**
