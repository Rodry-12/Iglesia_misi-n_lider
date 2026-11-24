import { expect, Page, test } from '@playwright/test';

const initial = {
  id: 'branch-a',
  code: 'MLP-001',
  name: 'Sede controlada',
  address: null,
  phone: null,
  isActive: true,
  updatedAt: '2026-11-21T00:00:00Z',
};
async function api(page: Page, role = 'SUPER_ADMIN') {
  const state = {
    branch: { ...initial },
    status: 200,
    writes: [] as { method: string; body: any }[],
    administrators: 0,
    lists: 0,
  };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path.endsWith('/csrf'))
      return route.fulfill({ json: { token: 'controlled', headerName: 'X-XSRF-TOKEN' } });
    if (path.endsWith('/session'))
      return route.fulfill({
        json: {
          userId: 'controlled',
          displayName: 'Cuenta de revisión',
          grants: [
            {
              roleId: 'r',
              roleCode: role,
              branchId: role === 'SUPER_ADMIN' ? null : 'branch-a',
              branchName: 'Sede controlada',
              permissions: ['BRANCH_VIEW'],
            },
          ],
        },
      });
    if (req.method() !== 'GET') {
      expect(req.headers()['x-xsrf-token']).toBe('controlled');
      state.writes.push({ method: req.method(), body: req.postDataJSON() });
      if (state.status !== 200)
        return route.fulfill({
          status: state.status,
          json: { code: 'integrity_conflict', title: 'La sede fue modificada. Recarga los datos.' },
        });
      if (path.endsWith('/active')) {
        state.branch.isActive = !state.branch.isActive;
        return route.fulfill({ status: 204 });
      }
      state.branch = { ...state.branch, ...req.postDataJSON() };
      return route.fulfill({ status: req.method() === 'POST' ? 201 : 200, json: state.branch });
    }
    if (path.endsWith('/administrators')) {
      state.administrators++;
      const number = Number(url.searchParams.get('page') ?? 1);
      return route.fulfill({
        json: {
          items:
            number === 1
              ? [
                  {
                    userId: 'u',
                    displayName: 'Administrador de prueba',
                    email: 'test@example.invalid',
                    isActive: true,
                  },
                ]
              : [],
          pageNumber: number,
          pageSize: 25,
          totalCount: 1,
        },
      });
    }
    if (path === '/api/v1/branches') {
      state.lists++;
      return route.fulfill({
        json: { items: [state.branch], pageNumber: 1, pageSize: 25, totalCount: 1 },
      });
    }
    if (path === '/api/v1/branches/branch-a') return route.fulfill({ json: state.branch });
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}
test('modales: crear valida,guarda una vez,notifica yreabre vacío sin navegar', async ({
  page,
}) => {
  const state = await api(page);
  await page.goto('/gestion/sedes');
  const opener = page.getByRole('link', { name: 'Nueva sede', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Crear sede', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/gestion\/sedes$/);
  await dialog.getByRole('button', { name: 'Crear sede', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await expect(dialog.getByText('Escribe código.', { exact: false })).toBeVisible();
  await dialog.getByLabel('Código *', { exact: true }).fill('MLP-NEW');
  await dialog.getByLabel('Nombre *', { exact: true }).fill('Sede nueva');
  await dialog.getByRole('button', { name: 'Crear sede', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('p-toast')).toContainText('Sede creada.');
  expect(state.writes).toHaveLength(1);
  expect(state.lists).toBe(2);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog.getByLabel('Código *', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
});
test('modales: edición conserva versión ydatos ante409,cierra solo tras éxito', async ({
  page,
}) => {
  const state = await api(page);
  await page.goto('/gestion/sedes');
  await page.getByRole('link', { name: 'Editar Sede controlada', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar sede', exact: true });
  await expect(dialog.getByLabel('Nombre *', { exact: true })).toHaveValue(initial.name);
  await dialog.getByLabel('Nombre *', { exact: true }).fill('Nombre actualizado');
  state.status = 409;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Nombre *', { exact: true })).toHaveValue('Nombre actualizado');
  await expect(page.locator('p-toast')).toContainText('La sede fue modificada.');
  expect(state.writes[0].body.expectedUpdatedAt).toBe(initial.updatedAt);
  expect(state.writes[0].method).toBe('PUT');
  state.status = 200;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('p-toast')).toContainText('Sede actualizada.');
  await expect(
    page.getByRole('link', { name: 'Consultar Nombre actualizado', exact: true }),
  ).toBeVisible();
});
test('modales: borrador puede conservarse odescartarse yEscape respeta confirmación', async ({
  page,
}) => {
  const state = await api(page);
  await page.goto('/gestion/sedes/crear');
  const dialog = page.getByRole('dialog', { name: 'Crear sede', exact: true });
  await dialog.getByLabel('Nombre *', { exact: true }).fill('Sin guardar');
  await page.keyboard.press('Escape');
  const confirmation = page.getByRole('alertdialog', { name: 'Descartar cambios', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(dialog.getByLabel('Nombre *', { exact: true })).toHaveValue('Sin guardar');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion\/sedes$/);
  expect(state.writes).toHaveLength(0);
});
test('modales: consulta es solo lectura,sin enlaces de gestión nipaginador innecesario', async ({
  page,
}) => {
  const state = await api(page);
  await page.goto('/gestion/sedes/branch-a');
  const dialog = page.getByRole('dialog', { name: 'Detalle de sede', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Administrador de prueba', { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('button', {
      name: /Editar|Desactivar|Reactivar|Siguientes|Anteriores|Ver más/,
    }),
  ).toHaveCount(0);
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await expect(dialog.getByText('Página 1', { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
});
test('modales: el detalle se abre solo después de completar ambas consultas', async ({ page }) => {
  await api(page);
  await page.goto('/gestion/sedes');
  const opener = page.getByRole('link', { name: 'Consultar Sede controlada', exact: true });
  await expect(opener).toBeVisible();
  let releaseDetail!: () => void, releaseAdmins!: () => void;
  const detail = new Promise<void>((resolve) => (releaseDetail = resolve)),
    admins = new Promise<void>((resolve) => (releaseAdmins = resolve));
  await page.route('**/api/v1/branches/branch-a', async (route) => {
    await detail;
    await route.fulfill({ json: initial });
  });
  await page.route('**/api/v1/branches/branch-a/administrators?*', async (route) => {
    await admins;
    await route.fulfill({ json: { items: [], pageNumber: 1, pageSize: 25, totalCount: 0 } });
  });
  try {
    await opener.click();
    await expect(page.locator('.loading-indicator.fullscreen')).toBeVisible();
    const modal = page.getByRole('dialog', {
      name: 'Detalle de sede',
      exact: true,
      includeHidden: true,
    });
    await expect(modal).toHaveCount(0);
    releaseDetail();
    await expect(modal).toHaveCount(0);
    releaseAdmins();
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(opener).toBeFocused();
  } finally {
    releaseDetail();
    releaseAdmins();
  }
});
test('modales: cambio de estado permanece en edición con confirmación', async ({ page }) => {
  const state = await api(page);
  await page.goto('/gestion/sedes/branch-a/editar');
  const dialog = page.getByRole('dialog', { name: 'Editar sede', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Desactivar sede', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'Desactivar sede', exact: true })
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Desactivar sede', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'Desactivar sede', exact: true })
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(page.locator('p-toast')).toContainText('Sede desactivada.');
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test('modales: operador consulta sin administradores niescrituras', async ({ page }) => {
  const state = await api(page, 'OPERATOR');
  await page.goto('/gestion/sedes');
  await expect(page.getByRole('link', { name: 'Nueva sede', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Consultar Sede controlada', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Detalle de sede', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Editar sede', exact: true })).toHaveCount(0);
  expect(state.administrators).toBe(0);
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
});
test('modales: tema oscuro,viewport móvil yToast debajo del navbar', async ({ page }) => {
  const state = await api(page);
  await page.goto('/gestion/sedes');
  await page.getByRole('button', { name: 'Tema oscuro', exact: true }).click();
  await page.getByRole('link', { name: 'Nueva sede', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear sede', exact: true });
  await dialog.getByLabel('Código *', { exact: true }).fill('TEST');
  await dialog.getByLabel('Nombre *', { exact: true }).fill('Controlada');
  state.status = 409;
  await dialog.getByRole('button', { name: 'Crear sede', exact: true }).click();
  const toast = page.locator('p-toast');
  await expect(toast).toContainText('La sede fue modificada.');
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const header = (await page.locator('.admin-header').boundingBox())!;
  const message = (await toast.getByRole('alert').boundingBox())!;
  expect(message.y).toBeGreaterThanOrEqual(header.y + header.height);
  await expect(toast.getByRole('alert')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
