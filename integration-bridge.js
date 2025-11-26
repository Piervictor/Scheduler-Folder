/**
 * integration-bridge.js
 * Bridges old code with new SharedUtils to ensure backward compatibility
 * Provides polyfills and adapters for smooth transition
 */

(function() {
  'use strict';

  function init() {
    // Wait for SharedUtils
    if (typeof SharedUtils === 'undefined') {
      setTimeout(init, 50);
      return;
    }

    console.log('Integration bridge initializing...');

    // Create global utilities that modules might expect
    window.escapeHtml = window.escapeHtml || SharedUtils.Sanitizer.escape;
    window.uid = window.uid || SharedUtils.uid;

    // Note: VDB will be defined by volunteer-dashboard.js
    // Do not create placeholder to avoid conflicts

    // Add global modal wrapper for compatibility
    if (!window.openModal) {
      window.openModal = function(options) {
        return SharedUtils.Modal.open(options);
      };
    }

    if (!window.closeModal) {
      window.closeModal = function() {
        return SharedUtils.Modal.close();
      };
    }

    // Add global toast wrapper
    if (!window.showToast) {
      window.showToast = function(message, type = 'info', duration) {
        return SharedUtils.Toast.show(message, type, duration);
      };
    }

    // Enhanced admin tab switching with loading states
    setupAdminTabs();

    // Setup global error handling display
    setupErrorDisplay();

    // Setup backup/restore UI
    setupBackupRestore();

    // Setup mobile menu toggle
    setupMobileNavigation();

    // Announce ready
    console.log('Integration bridge ready');
    document.dispatchEvent(new CustomEvent('cvsa:bridge:ready'));
  }

  function setupAdminTabs() {
    const tabs = document.querySelectorAll('.tab[data-tab]');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const targetTab = tab.getAttribute('data-tab');
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show target panel
        panels.forEach(p => p.hidden = true);
        const targetPanel = document.getElementById(`tab-${targetTab}`);
        if (targetPanel) {
          targetPanel.hidden = false;
          
          // Trigger custom event for the tab
          document.dispatchEvent(new CustomEvent('cvsa:tab:activated', {
            detail: { tab: targetTab, panel: targetPanel }
          }));
        }
      });
    });
  }

  function setupErrorDisplay() {
    // Add floating error log button (admin only)
    const errorBtn = document.createElement('button');
    errorBtn.id = 'show-error-log';
    errorBtn.title = 'View Error Log';
    errorBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #ef4444;
      color: white;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      z-index: 9999;
    `;
    errorBtn.innerHTML = '⚠';
    errorBtn.onclick = showErrorLog;
    document.body.appendChild(errorBtn);

    // Show button only when errors exist
    const originalError = SharedUtils.ErrorHandler.error;
    SharedUtils.ErrorHandler.error = function(...args) {
      errorBtn.style.display = 'flex';
      return originalError.apply(SharedUtils.ErrorHandler, args);
    };
  }

  function showErrorLog() {
    const logs = SharedUtils.ErrorHandler.getLogs();
    const errors = logs.filter(log => log.level === 'error');

    const content = document.createElement('div');
    content.style.cssText = 'max-height: 400px; overflow-y: auto;';
    
    if (errors.length === 0) {
      content.innerHTML = '<p>No errors logged.</p>';
    } else {
      content.innerHTML = errors.map(err => `
        <div style="margin-bottom: 1rem; padding: 0.5rem; background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 4px;">
          <div style="font-weight: 700; color: #b91c1c;">${SharedUtils.Sanitizer.escape(err.message)}</div>
          <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">${new Date(err.timestamp).toLocaleString()}</div>
          ${err.data ? `<pre style="font-size: 0.75rem; margin-top: 0.5rem; overflow-x: auto;">${SharedUtils.Sanitizer.escape(JSON.stringify(err.data, null, 2))}</pre>` : ''}
        </div>
      `).join('');
    }

    const buttons = document.createElement('div');
    buttons.style.cssText = 'margin-top: 1rem; display: flex; gap: 0.5rem;';
    buttons.innerHTML = `
      <button id="export-log" class="muted-btn">Export Log</button>
      <button id="clear-log" class="danger">Clear Log</button>
    `;

    content.appendChild(buttons);

    SharedUtils.Modal.open({
      title: `Error Log (${errors.length} errors)`,
      content,
      showConfirm: false,
      showCancel: true,
      cancelText: 'Close'
    });

    document.getElementById('export-log')?.addEventListener('click', () => {
      SharedUtils.ErrorHandler.exportLogs();
    });

    document.getElementById('clear-log')?.addEventListener('click', () => {
      SharedUtils.ErrorHandler.logs = [];
      document.getElementById('show-error-log').style.display = 'none';
      SharedUtils.Toast.success('Error log cleared');
      SharedUtils.Modal.close();
    });
  }

  function setupBackupRestore() {
    // Add backup/restore buttons to admin settings if present
    const settingsTab = document.getElementById('tab-settings');
    if (!settingsTab) return;

    const card = settingsTab.querySelector('.card');
    if (!card) return;

    const backupSection = document.createElement('div');
    backupSection.style.cssText = 'margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #eef1f5;';
    backupSection.innerHTML = `
      <h4 style="margin-bottom: 0.5rem;">Data Management</h4>
      <p class="small muted" style="margin-bottom: 0.75rem;">Backup and restore your scheduler data</p>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button id="backup-btn" class="success">Download Backup</button>
        <button id="restore-btn" class="muted-btn">Restore Backup</button>
        <button id="clear-all-btn" class="danger">Clear All Data</button>
      </div>
      <input type="file" id="restore-file" accept=".json" style="display: none;">
    `;

    card.appendChild(backupSection);

    // Wire events
    document.getElementById('backup-btn')?.addEventListener('click', () => {
      SharedUtils.Storage.backup();
    });

    document.getElementById('restore-btn')?.addEventListener('click', () => {
      document.getElementById('restore-file').click();
    });

    document.getElementById('restore-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      SharedUtils.Modal.confirm('Are you sure you want to restore from this backup? Current data will be overwritten.', () => {
        SharedUtils.Storage.restore(file).then(() => {
          SharedUtils.Toast.success('Data restored successfully. Refreshing...');
          setTimeout(() => location.reload(), 1500);
        }).catch(err => {
          SharedUtils.Toast.error('Failed to restore backup');
        });
      });
    });

    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
      SharedUtils.Modal.open({
        title: 'Clear All Data',
        content: '<p style="color: #b91c1c;"><strong>Warning:</strong> This will permanently delete all locations, volunteers, schedules, and assignments. This action cannot be undone.</p><p>Type "DELETE" to confirm:</p><input type="text" id="confirm-delete" style="width: 100%; padding: 0.5rem; margin-top: 0.5rem; border: 1px solid #ef4444;">',
        showConfirm: true,
        confirmText: 'Delete All Data',
        confirmClass: 'danger',
        onConfirm: () => {
          const input = document.getElementById('confirm-delete');
          if (input && input.value === 'DELETE') {
            SharedUtils.Storage.clear();
            SharedUtils.Toast.success('All data cleared. Refreshing...');
            setTimeout(() => location.reload(), 1000);
            return true;
          } else {
            SharedUtils.Toast.error('Confirmation text did not match');
            return false;
          }
        }
      });
    });
  }

  function setupMobileNavigation() {
    // Add mobile menu toggle for header
    const header = document.querySelector('header');
    if (!header) return;

    // Add hamburger menu button for mobile
    const menuBtn = document.createElement('button');
    menuBtn.id = 'mobile-menu-toggle';
    menuBtn.setAttribute('aria-label', 'Toggle mobile menu');
    menuBtn.style.cssText = `
      display: none;
      background: transparent;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0.5rem;
    `;
    menuBtn.innerHTML = '☰';

    // Add to header
    const nav = header.querySelector('nav');
    if (nav) {
      header.insertBefore(menuBtn, nav);
    }

    // Show on mobile
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        #mobile-menu-toggle {
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
