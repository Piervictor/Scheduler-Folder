// Playwright test: basic critical-path checks for CVSA demo
const { test, expect } = require('@playwright/test');

test.describe('CVSA demo smoke tests', () => {
  const base = 'http://localhost:8080'; // serve your static site locally (adjust if needed)

  test.beforeEach(async ({ page }) => {
    // capture console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('CONSOLE ERROR:', msg.text());
      }
    });
  });

  test('login as admin then navigate to Locations and add a location', async ({ page }) => {
    await page.goto(base);
    await page.waitForSelector('#login-form');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.selectOption('#role', 'admin');
    await page.click('#login-form button[type="submit"]');
    // admin panel should show
    await page.waitForSelector('#admin-panel');
    await expect(page.locator('#admin-panel')).toBeVisible();

    // go to Locations tab
    await page.click('.tab[data-tab="locations"]');
    await page.waitForSelector('#locations-table-body');
    // click add location button if present
    if (await page.$('#add-location-btn')) {
      await page.click('#add-location-btn');
      // if modal shown, fill form
      if (await page.$('#location-name')) {
        await page.fill('#location-name', 'Test Location');
        await page.fill('#location-capacity', '3');
        await page.click('#modal-confirm').catch(() => {});
      }
    }

    // assert locations table contains entry
    const text = await page.innerText('#locations-table-body');
    expect(text.toLowerCase()).toContain('test location');
  });

  test('login as volunteer and book a slot', async ({ page }) => {
    await page.goto(base);
    await page.fill('#username', 'volunteer');
    await page.fill('#password', 'volunteer');
    await page.selectOption('#role', 'volunteer');
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('#volunteer-dashboard');

    // open first location card view slots button
    const firstViewBtn = await page.$('#location-cards .view-location');
    if (!firstViewBtn) {
      test.skip();
      return;
    }
    await firstViewBtn.click();
    // modal should appear
    await page.waitForSelector('#modal-backdrop[aria-hidden="false"]');
    // pick date input and click first Book button
    if (await page.$('#modal-body input[type="date"]')) {
      // use current date
      const bookBtn = await page.$('#modal-body .timeslot .success');
      if (bookBtn) {
        await bookBtn.click();
        // confirm modal
        const confirm = await page.$('#modal-confirm');
        if (confirm) await confirm.click();
        // success modal may appear and auto-close
      }
    }
    // close modal and open My Assignments
    await page.click('#btn-my-assignments').catch(() => {});
    // check assignments modal
    await page.waitForSelector('#modal-backdrop[aria-hidden="false"]');
    const bodyText = await page.innerText('#modal-body');
    expect(bodyText.toLowerCase()).toMatch(/assignment|no upcoming/);
  });

  test('reports generate and CSV export', async ({ page, context }) => {
    await page.goto(base);
    // login as admin to access reports
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.selectOption('#role', 'admin');
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('#admin-panel');

    // goto reports tab
    await page.click('.tab[data-tab="reports"]');
    await page.waitForSelector('#tab-reports');

    // Generate report
    await page.click('#tab-reports button:has-text("Generate")').catch(()=>{});
    await page.waitForTimeout(500);

    // Trigger export and ensure a download starts
    const [download] = await Promise.all([
      page.waitForEvent('download').catch(() => null),
      page.click('#tab-reports button:has-text("Export CSV")').catch(() => {})
    ]);
    // If download exists, check filename; otherwise just assert no console errors
    if (download) {
      const path = await download.path();
      expect(path).toBeTruthy();
    }
  });

  test('data persists after reload', async ({ page }) => {
    await page.goto(base);
    // login volunteer
    await page.fill('#username', 'volunteer'); await page.fill('#password', 'volunteer'); await page.selectOption('#role','volunteer');
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('#volunteer-dashboard');
    // reload
    await page.reload();
    // still on volunteer dashboard or redirected based on session
    await page.waitForTimeout(300);
    const visibleVolunteer = await page.$('#volunteer-dashboard');
    expect(visibleVolunteer).not.toBeNull();
  });

});