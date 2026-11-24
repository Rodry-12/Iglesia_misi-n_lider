import { expect, Page, test } from '@playwright/test';

const session = {
  userId: 'test-user',
  displayName: 'Cuenta de integración controlada',
  grants: [
    {
      roleId: 'operator-role',
      roleCode: 'OPERATOR',
      branchId: 'sede-a',
      permissions: ['PERSON_VIEW'],
    },
  ],
};

async function api(page: Page, initial = false) {
  const state = {
    authenticated: initial,
    loginStatus: 200,
    logoutStatus: 204,
    sessionStatus: 200,
    csrf: [] as string[],
    logins: 0,
    sessions: 0,
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const token = state.authenticated ? 'csrf-authenticated' : 'csrf-anonymous';
    if (path.endsWith('/csrf')) {
      state.csrf.push(token);
      return route.fulfill({ json: { token, headerName: 'X-XSRF-TOKEN' } });
    }
    if (route.request().method() === 'POST')
      expect(route.request().headers()['x-xsrf-token']).toBe(token);
    if (path.endsWith('/login')) {
      state.logins++;
      if (state.loginStatus !== 200)
        return route.fulfill({ status: state.loginStatus, json: { code: 'invalid_credentials' } });
      state.authenticated = true;
      return route.fulfill({ json: session });
    }
    if (path.endsWith('/logout')) {
      if (state.logoutStatus !== 204)
        return route.fulfill({ status: state.logoutStatus, json: {} });
      state.authenticated = false;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/session')) {
      state.sessions++;
      if (state.sessionStatus !== 200)
        return route.fulfill({ status: state.sessionStatus, json: {} });
      return route.fulfill({
        status: state.authenticated ? 200 : 401,
        json: state.authenticated ? session : {},
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}

async function credentials(page: Page) {
  await page.getByLabel('Correo electrónico', { exact: true }).fill('test@example.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('008 mock: login, permisos efectivos, recarga y logout', async ({ page }) => {
  const state = await api(page);
  await page.goto('/acceso');
  await credentials(page);
  await expect(page).toHaveURL(/\/gestion$/);
  await expect(page.getByRole('heading', { name: 'Tu sesión', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Cuenta de integración controlada');
  await page.getByRole('button', { name: 'Ver mis permisos', exact: true }).click();
  await expect(page.locator('main')).toContainText('1 sede autorizada');
  await expect(page.locator('main')).toContainText('Consultar personas');
  await expect(page.locator('main')).not.toContainText('PERSON_VIEW');
  expect(state.csrf).toEqual(['csrf-anonymous', 'csrf-authenticated']);
  const verifiedSessions = state.sessions;
  if ((page.viewportSize()?.width ?? 0) < 1024)
    await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page.locator('nav a[href="/gestion/miembros"]').click();
  await expect(page).toHaveURL(/\/gestion\/miembros$/);
  if ((page.viewportSize()?.width ?? 0) < 1024)
    await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page.locator('nav .navigation-link[href="/gestion"]').click();
  await expect(page).toHaveURL(/\/gestion$/);
  expect(state.sessions).toBe(verifiedSessions);
  await expect(page.locator('nav a[href="/gestion/usuarios"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toMatch(/TestPassword123|csrf-authenticated/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tu sesión', exact: true })).toBeVisible();
  expect(state.sessions).toBe(verifiedSessions + 1);
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  expect(state.authenticated).toBe(false);
  await page.goto('/gestion');
  await expect(page).toHaveURL(/\/acceso$/);
});

test('008 mock: sesión expirada retira la vista administrativa', async ({ page }) => {
  const state = await api(page, true);
  await page.goto('/gestion');
  await expect(page.getByRole('heading', { name: 'Tu sesión', exact: true })).toBeVisible();
  state.authenticated = false;
  await page.getByRole('button', { name: 'Actualizar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByRole('alert')).toContainText('ha finalizado');
});

test('008 mock: guard deniega módulo sin permiso y 403 conserva distinción de acceso', async ({
  page,
}) => {
  const state = await api(page, true);
  await page.goto('/gestion/usuarios');
  await expect(page).toHaveURL(/\/sin-acceso$/);
  await expect(
    page.getByRole('heading', { name: 'No tienes acceso a esta sección' }),
  ).toBeVisible();
  state.sessionStatus = 403;
  await page.goto('/gestion');
  await expect(page).toHaveURL(/\/sin-acceso$/);
  await expect(page.locator('main')).not.toContainText('credenciales');
});

test('008 mock: credenciales inválidas y servicio caído no crean sesión', async ({ page }) => {
  const state = await api(page);
  state.loginStatus = 401;
  await page.goto('/acceso');
  await credentials(page);
  await expect(page.getByRole('alert')).toContainText('credenciales');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue(
    'test@example.invalid',
  );
  state.loginStatus = 503;
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'servicio de autenticación no está disponible',
  );
  await expect(page).toHaveURL(/\/acceso$/);
  expect(state.authenticated).toBe(false);
});

test('008 mock: fallo de logout conserva sesión hasta confirmar el reintento', async ({ page }) => {
  const state = await api(page, true);
  state.logoutStatus = 503;
  await page.goto('/gestion');
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No fue posible cerrar');
  await expect(page).toHaveURL(/\/gestion$/);
  expect(state.authenticated).toBe(true);
  state.logoutStatus = 204;
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
});

test('008 mock: formulario valida por teclado y no desborda en móvil', async ({ page }) => {
  const state = await api(page);
  await page.goto('/acceso');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(state.logins).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
