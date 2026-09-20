import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440];

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth, `page overflows at ${dimensions.clientWidth}px`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertNoSeriousAccessibilityViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact))).toEqual([]);
}

test('public pages have no serious accessibility violations', async ({ page }) => {
  for (const path of ['/', '/about', '/contact', '/login']) {
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
    await assertNoSeriousAccessibilityViolations(page);
  }
});

test('landing and login remain within every supported viewport', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/login']) {
      await page.goto(path);
      await assertNoHorizontalOverflow(page);
    }
  }
});

test('protected deep link redirects to login and preserves its destination', async ({ page }) => {
  await page.goto('/group/example/settlement?source=invite');
  await expect(page).toHaveURL(/\/login$/);
  const redirect = await page.evaluate(() => window.history.state?.usr?.from);
  expect(redirect).toMatchObject({ pathname: '/group/example/settlement', search: '?source=invite' });
});

test('authenticated dashboard renders API data and is mobile-safe', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', name: 'Browser Test', email: 'browser@example.test' }));
  });
  await page.route('**/api/splits**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ splits: [] }),
  }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Start New Split' })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await assertNoSeriousAccessibilityViolations(page);
});

test('manual split creation reaches the real waiting-room route', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', name: 'Host', email: 'host@example.test' }));
  });
  await page.route('**/api/splits', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ name: 'Dinner at Thamel', splitType: 'equal', totalAmount: 0 });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ split: { _id: 'split-1' } }) });
  });
  await page.route('**/api/session', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ name: 'Dinner at Thamel', splitId: 'split-1' });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      session: { _id: 'session-1' },
      inviteUrl: 'http://localhost/session/join?splitId=split-1&sessionId=session-1&invite=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
    }) });
  });
  await page.route('**/api/session/session-1', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ _id: 'session-1', name: 'Dinner at Thamel', participants: [] }),
  }));
  await page.goto('/split/create');
  await page.getByLabel('Split Name').fill('Dinner at Thamel');
  await page.getByRole('button', { name: 'Share QR and Scan Bills' }).click();
  await expect(page).toHaveURL(/\/split\/ready\?splitId=split-1&sessionId=session-1&type=session/);
  await expect(page.getByRole('heading', { name: 'Ready to Split!' })).toBeVisible();
});

test('payment success displays only the server-verified amount', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', name: 'Payer', email: 'payer@example.test' }));
  });
  await page.route('**/api/payment/payment-status', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ product_id: 'payment-1' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'COMPLETED', amount: 12.34, currency: 'NPR', gateway: 'khalti', transactionId: 'payment-1' }),
    });
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/payment-success?purchase_order_id=payment-1&pidx=test-pidx&amount=999999');
  await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toBeVisible();
  await expect(page.locator('.transaction-details')).toContainText('NPR 12.34');
  await expect(page.locator('.transaction-details')).not.toContainText('999999');
  await expect(page.locator('.transaction-details')).toContainText('Khalti');
  await assertNoHorizontalOverflow(page);
});

test('group settlement renders normalized balances on mobile', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Host', email: 'host@example.test' }));
  });
  await page.route('**/api/groups/group-1', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'group-1', name: 'Weekend Trip', splitId: 'split-1' } }),
  }));
  await page.route('**/api/splits/split-1', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ split: {
      _id: 'split-1', totalAmount: 1000,
      breakdown: [
        { user: { _id: 'user-1', name: 'Host', email: 'host@example.test' }, amount: 500, amountPaid: 500, paymentStatus: 'paid' },
        { user: { _id: 'user-2', name: 'Guest', email: 'guest@example.test' }, amount: 500, amountPaid: 0, paymentStatus: 'unpaid' },
      ],
    } }),
  }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/group/group-1/settlement');
  await expect(page.getByRole('heading', { name: 'Settlement Summary' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Weekend Trip');
  await expect(page.locator('body')).toContainText('Guest');
  await assertNoHorizontalOverflow(page);
  await assertNoSeriousAccessibilityViolations(page);
});

test('payment failure state preserves the transaction reference', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Payer', email: 'payer@example.test' }));
  });
  await page.route('**/api/payment/payment-status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'FAILED' }),
  }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/payment-failure?purchase_order_id=failed-payment-1');
  await expect(page.getByRole('heading', { name: 'Payment Failed!' })).toBeVisible();
  await expect(page.locator('.failure-details')).toContainText('failed-payment-1');
  await assertNoHorizontalOverflow(page);
});

test('guest can join a shared session and reach its lobby', async ({ page }) => {
  await page.route('**/api/auth/continue', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ fullName: 'Alex Guest' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'guest-server-token', user: { id: 'guest-1', name: 'Alex Guest', email: 'guest-random@local' } }),
    });
  });
  await page.route('**/api/session/join/session-guest', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer guest-server-token');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.route('**/api/session/session-guest', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ name: 'Shared Dinner', participants: [{ _id: 'guest-1', name: 'Alex Guest', email: 'alex@example.test' }] }),
  }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/session/join?splitId=split-guest&sessionId=session-guest&type=session&invite=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12');
  await page.getByLabel('Your name').fill('Alex Guest');
  await page.getByRole('button', { name: 'Join as guest' }).click();
  await expect(page).toHaveURL(/\/split\/joined\?splitId=split-guest&sessionId=session-guest&type=session/);
  await expect(page.getByRole('heading', { name: 'Everyone In?' })).toBeVisible();
  await expect(page.getByRole('main').getByText('You', { exact: true })).toBeVisible();
  await assertNoSeriousAccessibilityViolations(page);
  await assertNoHorizontalOverflow(page);
});

test('host can enter a manual receipt and continue to breakdown', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'host-1', name: 'Host', email: 'host@example.test' }));
  });
  await page.route('**/api/session/session-scan', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ name: 'Dinner', participants: [{ _id: 'host-1', name: 'Host' }, { _id: 'guest-1', name: 'Guest' }] }),
  }));
  await page.route('**/api/receipts', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      totalAmount: 500,
      items: [{ name: '2x Momo', price: 500, quantity: 2, assigned: ['guest-1'] }],
    });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ receipt: { _id: 'receipt-1' } }) });
  });
  await page.route('**/api/splits/split-scan', async (route) => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON()).toMatchObject({ receiptId: 'receipt-1', totalAmount: 500, splitType: 'equal', sessionId: 'session-scan' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ split: { _id: 'split-scan', totalAmount: 500, breakdown: [] } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ split: { _id: 'split-scan', totalAmount: 500, breakdown: [] } }) });
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/split/scan?splitId=split-scan&sessionId=session-scan&type=session');
  await page.getByLabel('Item Name').fill('Momo');
  await page.getByLabel('Assign To').selectOption(['guest-1']);
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel('Price (NPR)').fill('250');
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect(page.getByText('2x Momo').first()).toBeVisible();
  await assertNoSeriousAccessibilityViolations(page);
  await assertNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Calculate Split' }).click();
  await expect(page).toHaveURL(/\/split\/breakdown\?splitId=split-scan&sessionId=session-scan&type=session/);
});

test('host can upload a receipt and review mocked scan results', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'host-1', name: 'Host', email: 'host@example.test' }));
  });
  await page.route('**/api/session/session-ocr', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ participants: [{ _id: 'host-1', name: 'Host' }] }),
  }));
  await page.route('**/api/bills/parse', async (route) => {
    expect(route.request().postDataJSON().image).toMatch(/^data:image\/png;base64,/);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ name: 'Dal Bhat', quantity: 2, unit_price: 300, total_price: 600 }], grand_total: 600 }),
    });
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/split/scan?splitId=split-ocr&sessionId=session-ocr&type=session');
  await page.locator('#fileUpload').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('test-image') });
  await expect(page.getByText('2x Dal Bhat')).toBeVisible();
  await expect(page.locator('body')).toContainText('NPR600.00');
  await expect(page.getByRole('button', { name: 'Calculate Split' })).toBeVisible();
  await assertNoSeriousAccessibilityViolations(page);
  await assertNoHorizontalOverflow(page);
});

test('nudge page renders member balances at 320px without overflow and is accessible', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Host', email: 'host@example.test' }));
  });
  await page.route('**/api/groups/group-nudge', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'group-nudge', name: 'Hiking Trip', splitId: 'split-nudge', createdBy: 'user-1' } }),
  }));
  await page.route('**/api/splits/split-nudge', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ split: {
      _id: 'split-nudge', totalAmount: 3000,
      breakdown: [
        { user: { _id: 'user-1', name: 'Host', email: 'host@example.test' }, amount: 1000, amountPaid: 3000, paymentStatus: 'paid' },
        { user: { _id: 'user-2', name: 'Alice', email: 'alice@example.test' }, amount: 1000, amountPaid: 0, paymentStatus: 'unpaid' },
        { user: { _id: 'user-3', name: 'Bob', email: 'bob@example.test' }, amount: 1000, amountPaid: 0, paymentStatus: 'unpaid' },
      ],
    } }),
  }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/group/group-nudge/nudge');
  // Check page renders correctly
  await expect(page.getByRole('heading', { name: 'Awkwardness Shield' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settlement Status' })).toBeVisible();
  // Verify NPR currency format is used
  await expect(page.locator('body')).not.toContainText('Rs.', { timeout: 3000 });
  // Verify accessible nudge button exists for pending members
  const nudgeBtn = page.getByRole('button', { name: /Send nudge to Alice/i });
  await expect(nudgeBtn).toBeVisible();
  // Verify the "Nudge All Pending" button has an accessible label
  await expect(page.getByRole('button', { name: /Send payment reminder to all pending members/i })).toBeVisible();
  // No horizontal overflow at 320px
  await assertNoHorizontalOverflow(page);
  // No serious accessibility violations
  await assertNoSeriousAccessibilityViolations(page);
});

test('PWA manifest, service worker, and offline deep links are available', async ({ page, request, context }) => {
  const manifestLink = await page.goto('/').then(() => page.locator('link[rel="manifest"]').getAttribute('href'));
  expect(manifestLink).toBeTruthy();
  const manifestResponse = await request.get(manifestLink);
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker?.ready.then(() => true))).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto('/about');
  await expect(page.locator('body')).toContainText('Students');
});
