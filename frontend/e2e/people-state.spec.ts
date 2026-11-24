import { expect, Page, test } from '@playwright/test';
const id = '44444444-4444-4444-8444-444444444444';
async function stateApi(page: Page, stateBranch = 'a') {
  const state = { active: true, puts: 0, status: 204, body: null as { isActive: boolean } | null };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          userId: 'test',
          displayName: 'Operador controlado',
          grants: [
            { roleId: 'op', roleCode: 'OPERATOR', branchId: 'a', permissions: ['PERSON_VIEW'] },
            {
              roleId: 'op',
              roleCode: 'OPERATOR',
              branchId: stateBranch,
              permissions: ['PERSON_DEACTIVATE'],
            },
          ],
        },
      });
    if (path === '/api/v1/auth/csrf')
      return route.fulfill({ json: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } });
    const person = () => ({
      id,
      firstNames: 'Ana',
      lastNames: 'Prueba',
      phone: null,
      email: null,
      birthDate: null,
      isActive: state.active,
      branchId: 'a',
      branchName: 'Sede A',
      hasDocuments: true,
      documents: [
        {
          id: 'd',
          documentType: 'CC',
          documentNumber: '000AB9',
          issuingCountry: 'CO',
          isCurrent: true,
          endedAt: null,
        },
      ],
      createdAt: '2026-11-07T00:00:00Z',
      updatedAt: state.active ? '2026-11-07T01:00:00Z' : '2026-11-07T02:00:00Z',
    });
    if (path === '/api/v1/people/' + id + '/active') {
      state.puts++;
      state.body = route.request().postDataJSON();
      expect(route.request().method()).toBe('PUT');
      expect(route.request().headers()['x-xsrf-token']).toBe('csrf');
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (state.status !== 204)
        return route.fulfill({ status: state.status, json: { code: 'controlled_error' } });
      state.active = state.body!.isActive;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/v1/people/' + id) return route.fulfill({ json: person() });
    if (path === '/api/v1/people') {
      const filter = url.searchParams.get('isActive');
      const items = !filter || String(state.active) === filter ? [person()] : [];
      return route.fulfill({
        json: {
          items,
          totalCount: items.length,
          pageNumber: 1,
          pageSize: 25,
          branches: [{ id: 'a', name: 'Sede A' }],
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}
async function requestDeactivation(page: Page) {
  await page.getByRole('button', { name: 'Desactivar a Ana Prueba', exact: true }).click();
  await expect(
    page.getByRole('alertdialog', { name: '¿Desactivar persona?', exact: true }),
  ).toBeVisible();
}

test('HU-004 consulta readonly y listado confirma, cancela, desactiva y reactiva sin duplicados', async ({
  page,
}, info) => {
  const state = await stateApi(page);
  await page.goto('/gestion/miembros');
  await page.getByRole('link', { name: 'Ver detalle de Ana Prueba', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Ficha de persona', exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: /Desactivar|Activar|Editar/ })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await requestDeactivation(page);
  await expect(page.getByText(/se revocarán sus sesiones de acceso/)).toBeVisible();
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/012-state-confirmation-${info.project.name}.png`,
      fullPage: true,
    });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.puts).toBe(0);
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await requestDeactivation(page);
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Desactivar a Ana Prueba', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText('Desactivación confirmada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
  expect(state.puts).toBe(1);
  expect(state.body).toEqual({ isActive: false });
  await expect(page.getByText('CC 000AB9', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Activar a Ana Prueba', exact: true }).click();
  await expect(page.getByText('Activación confirmada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  expect(state.puts).toBe(2);
  expect(state.body).toEqual({ isActive: true });
  await expect(
    page.getByRole('row').filter({ hasText: 'CC 000AB9' }).getByText('Activo', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('HU-004 acción del listado respeta filtros y retira la persona sin coincidencia', async ({
  page,
}) => {
  const state = await stateApi(page);
  await page.goto('/gestion/miembros?search=000AB9&isActive=true&page=1');
  await requestDeactivation(page);
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  await expect(page.getByText('Desactivación confirmada.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('No se encontraron personas con estos filtros.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Buscar persona', { exact: true })).toHaveValue('000AB9');
  expect(new URL(page.url()).searchParams.get('isActive')).toBe('true');
  expect(state.active).toBe(false);
  await page.goto('/gestion/miembros?isActive=false');
  await page.getByRole('button', { name: 'Activar a Ana Prueba', exact: true }).click();
  await expect(page.getByText('Activación confirmada.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('No se encontraron personas con estos filtros.', { exact: true }),
  ).toBeVisible();
});

test('HU-004 permiso en otra sede no muestra acciones', async ({ page }) => {
  const state = await stateApi(page, 'b');
  await page.goto('/gestion/miembros');
  await expect(page.getByText('CC 000AB9', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Desactivar a/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Ver detalle de Ana Prueba', exact: true }).click();
  await expect(page.getByText('000AB9', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Desactivar a/ })).toHaveCount(0);
  expect(state.puts).toBe(0);
});

test('HU-004 conflicto y errores no cambian estado ni simulan éxito', async ({ page }) => {
  const state = await stateApi(page);
  for (const [status, message] of [
    [409, 'procesos abiertos'],
    [403, 'No tienes permiso'],
    [404, 'Persona no encontrada'],
    [503, 'No se pudo confirmar'],
  ] as const) {
    state.status = status;
    await page.goto('/gestion/miembros');
    await requestDeactivation(page);
    await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
    await expect(page.locator('p-toast')).toContainText(message);
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();
    await expect(page.getByText('Desactivación confirmada.', { exact: true })).toHaveCount(0);
    expect(state.active).toBe(true);
  }
});

test('HU-004 401 al cambiar estado elimina información y vuelve al acceso', async ({ page }) => {
  const state = await stateApi(page);
  state.status = 401;
  await page.goto('/gestion/miembros');
  await requestDeactivation(page);
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByText('000AB9', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('alertdialog', { name: '¿Desactivar persona?', exact: true }),
  ).toHaveCount(0);
});
