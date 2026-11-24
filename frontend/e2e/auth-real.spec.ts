import { expect, test } from '@playwright/test';

// Opt-in only. No intercepted API, trace or persisted credentials in this test.
test.use({ trace: 'off', screenshot: 'off' });
test('008 real: HTTPS Angular -> proxy TLS -> Identity/PostgreSQL, recarga y logout', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    process.env['MLP_REAL_AUTH'] !== '1',
    'Requires an explicitly supplied local test account and running API.',
  );
  const email = process.env['MLP_REAL_AUTH_EMAIL'];
  const password = process.env['MLP_REAL_AUTH_PASSWORD'];
  expect(
    !!email && !!password,
    'Local test credentials must be supplied through the process environment.',
  ).toBe(true);
  await page.goto('/acceso');
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/008-real-access-${testInfo.project.name}.png` });
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email!);
  await page.getByLabel('Contraseña', { exact: true }).fill(password!);
  const loginResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/auth/login') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/gestion$/);
  await expect(page.getByRole('heading', { name: 'Tu sesión', exact: true })).toBeVisible();
  const cookies = await context.cookies();
  for (const name of ['__Host-mlp-session', '__Host-mlp-antiforgery']) {
    const cookie = cookies.find((c) => c.name === name);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
  }
  const initial = await page.request.get('/api/v1/auth/session');
  expect(initial.status()).toBe(200);
  const before = await initial.json();
  expect(typeof before.userId).toBe('string');
  expect(before.grants.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tu sesión', exact: true })).toBeVisible();
  const restored = await page.request.get('/api/v1/auth/session');
  expect(restored.status()).toBe(200);
  expect((await restored.json()).userId).toBe(before.userId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/008-real-session-${testInfo.project.name}.png` });
  const logoutResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/auth/logout') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page).toHaveURL(/\/acceso$/);
  expect((await page.request.get('/api/v1/auth/session')).status()).toBe(401);
  await page.goto('/gestion');
  await expect(page).toHaveURL(/\/acceso$/);
  await testInfo.attach('real-auth-result', {
    contentType: 'application/json',
    body: JSON.stringify({
      source: 'real-local-api-no-interception',
      browserOrigin: 'https://localhost:4200',
      login: 200,
      session: 200,
      reloadSession: 200,
      logout: 204,
      afterLogout: 401,
      secureHttpOnlyCookies: true,
      verifiedAt: new Date().toISOString(),
    }),
  });
});
