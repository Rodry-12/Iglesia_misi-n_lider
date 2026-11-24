import { expect, Page, test } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
async function api(page: Page, canInvite = true) {
  const reads: URL[] = [];
  await page.route('**/api/v1/**', async (route) => {
    expect(route.request().method()).toBe('GET');
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/session'))
      return route.fulfill({
        json: {
          userId: 'admin',
          displayName: 'Revisión controlada',
          grants: [
            {
              roleId: 'root',
              roleCode: 'SUPER_ADMIN',
              branchId: null,
              permissions: canInvite ? ['USER_VIEW', 'USER_CREATE'] : ['USER_VIEW'],
            },
          ],
        },
      });
    if (url.pathname.endsWith('/administration-options'))
      return route.fulfill({
        json: {
          roles: [{ id: 'root', code: 'SUPER_ADMIN' }],
          branches: [{ id: 'a', name: 'Sede de prueba' }],
          permissions: [],
        },
      });
    if (url.pathname === '/api/v1/users') {
      reads.push(url);
      const current = Number(url.searchParams.get('page') ?? 1),
        active = url.searchParams.get('isActive') !== 'false';
      const pageSize = Number(url.searchParams.get('pageSize') ?? 10);
      const items = Array.from(
        { length: Math.min(pageSize, Math.max(0, 26 - (current - 1) * pageSize)) },
        (_, i) => ({
          id: `u-${current}-${i}`,
          displayName: `Cuenta ${current}-${i}`,
          email: `account${i}@example.invalid`,
          personId: i === 1 ? 'linked' : null,
          personName: i === 1 ? 'Persona asociada de prueba' : null,
          isActive: active,
          emailConfirmed: true,
          hasPassword: true,
          lockoutEnd: null,
          grants: [{ roleId: 'root', branchId: null, permissionIds: [] }],
        }),
      );
      return route.fulfill({ json: { items, pageNumber: current, pageSize, totalCount: 26 } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return reads;
}
test('usuarios: invitar visible a la derecha,persona clara ypaginación equivalente aSedes', async ({
  page,
}) => {
  const reads = await api(page);
  await page.goto('/gestion/usuarios');
  const invite = page.getByRole('link', { name: 'Invitar usuario', exact: true });
  await expect(invite).toBeVisible();
  await expect(invite).toHaveAttribute('href', '/gestion/usuarios/invitar');
  const colors = await invite.evaluate((e) => ({
    text: getComputedStyle(e).color,
    background: getComputedStyle(e).backgroundColor,
  }));
  expect(colors.text).not.toBe(colors.background);
  const button = (await invite.boundingBox())!,
    panel = (await page.locator('.users-filters-panel').boundingBox())!;
  expect(button.x + button.width).toBeGreaterThan(panel.x + panel.width * 0.8);
  await expect(
    page.getByRole('cell', { name: 'Sin persona asociada', exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Persona asociada de prueba', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'SuperAdministrador · Global', exact: true }).first(),
  ).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Páginas de usuarios', exact: true });
  await expect(nav.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  await expect(page.locator('app-table-pagination [role=status]')).toHaveText(
    'Mostrando 1–10 de 26 cuentas',
  );
  await nav.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('app-table-pagination [aria-current=page]')).toHaveText('Página 2');
  await expect(page.locator('app-table-pagination [role=status]')).toHaveText(
    'Mostrando 11–20 de 26 cuentas',
  );
  await expect(nav.getByRole('button', { name: 'Siguiente', exact: true })).toBeEnabled();
  expect(reads.at(-1)?.searchParams.get('page')).toBe('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('usuarios: filtro muestra Activa eInactiva yenvía valores reales sinmodificar contratos', async ({
  page,
}) => {
  const reads = await api(page);
  await page.goto('/gestion/usuarios');
  const filter = page.getByRole('combobox', { name: 'Estado de cuenta', exact: true });
  await filter.click();
  await page.getByRole('option', { name: 'Inactiva', exact: true }).click();
  await expect.poll(() => reads.at(-1)?.searchParams.get('isActive')).toBe('false');
  await expect(filter).toContainText('Inactiva');
  await expect(page.locator('.users-status').first()).toHaveText('Inactiva');
  await filter.click();
  await page.getByRole('option', { name: 'Activa', exact: true }).click();
  await expect.poll(() => reads.at(-1)?.searchParams.get('isActive')).toBe('true');
  await expect(filter).toContainText('Activa');
  await page.getByRole('button', { name: 'Tema oscuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const colors = await page.locator('.users-results-panel').evaluate((e) => ({
    text: getComputedStyle(e).color,
    background: getComputedStyle(e).backgroundColor,
  }));
  expect(colors.text).not.toBe(colors.background);
});
test('usuarios: consulta sinpermiso deinvitar noexpone botón', async ({ page }) => {
  await api(page, false);
  await page.goto('/gestion/usuarios');
  await expect(page.getByRole('cell', { name: 'Cuenta 1-0', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Invitar usuario', exact: true })).toHaveCount(0);
});

test('usuarios: limpiar sede aparece únicamente con selección y desaparece al borrarla', async ({
  page,
}) => {
  const reads = await api(page);
  await page.goto('/gestion/usuarios');
  const select = page
    .locator('p-select')
    .filter({ has: page.getByRole('combobox', { name: 'Sede', exact: true }) });
  const clear = select.locator('[data-pc-section="clearicon"]');
  await expect(clear).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Sede', exact: true }).click();
  await page.getByRole('option', { name: 'Sede de prueba', exact: true }).click();
  await expect(clear).toBeVisible();
  await expect.poll(() => reads.at(-1)?.searchParams.get('branchId')).toBe('a');
  await clear.click();
  await expect(clear).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Sede', exact: true })).toContainText(
    'Todas las sedes',
  );
  await expect.poll(() => reads.at(-1)?.searchParams.get('branchId')).toBeNull();
});
