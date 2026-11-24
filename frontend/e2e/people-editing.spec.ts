import { expect, Page, test } from '@playwright/test';
const id = '33333333-3333-4333-8333-333333333333';
async function api(page: Page, updateBranch = 'a') {
  const state = {
    status: 200,
    puts: 0,
    body: {} as Record<string, unknown>,
    person: {
      id,
      firstNames: 'Ángela María',
      lastNames: 'De la Cruz',
      phone: '+57 001',
      email: null,
      birthDate: '1990-01-01',
      isActive: true,
      branchId: 'a',
      branchName: 'Sede A',
      hasDocuments: true,
      documents: [
        {
          id: 'd',
          issuingCountry: 'CO',
          documentType: 'CC',
          documentNumber: '000AB9',
          isCurrent: true,
          endedAt: null,
        },
      ],
      createdAt: '2026-11-07T00:00:00Z',
      updatedAt: '2026-11-07T00:00:00.123456Z',
    },
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          userId: 'test',
          displayName: 'Prueba',
          grants: [
            {
              roleId: 'operator',
              roleCode: 'OPERATOR',
              branchId: 'a',
              permissions: ['PERSON_VIEW'],
            },
            {
              roleId: 'operator',
              roleCode: 'OPERATOR',
              branchId: updateBranch,
              permissions: ['PERSON_UPDATE'],
            },
          ],
        },
      });
    if (path === '/api/v1/auth/csrf')
      return route.fulfill({ json: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } });
    if (path === '/api/v1/people')
      return route.fulfill({
        json: {
          items: [state.person],
          pageNumber: 1,
          pageSize: 25,
          totalCount: 1,
          branches: [{ id: 'a', name: 'Sede A' }],
        },
      });
    if (path === '/api/v1/people/' + id) {
      if (route.request().method() === 'PUT') {
        state.puts++;
        state.body = route.request().postDataJSON();
        expect(route.request().headers()['x-xsrf-token']).toBe('csrf');
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (state.status !== 200)
          return route.fulfill({ status: state.status, json: { code: 'controlled_error' } });
        state.person = { ...state.person, ...state.body, updatedAt: '2026-11-07T01:00:00.123456Z' };
      }
      return route.fulfill({ json: state.person });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}

test('HU-003 precarga, valida, guarda una vez y actualiza ficha/listado', async ({
  page,
}, info) => {
  const state = await api(page);
  await page.goto('/gestion/miembros?search=000AB9&page=1');
  await page.getByRole('link', { name: /Editar persona:/ }).click();
  await expect(page.getByLabel('Nombres *', { exact: true })).toHaveValue('Ángela María');
  const editor = page.getByRole('dialog', { name: 'Editar persona', exact: true });
  await expect(editor.locator('form dt').first()).toHaveText('Tipo de documento');
  await expect(editor.locator('form dt').nth(1)).toHaveText('Número de documento');
  await expect(editor.getByText('País emisor', { exact: true })).toHaveCount(0);
  const save = editor.getByRole('button', { name: 'Guardar cambios', exact: true });
  const cancel = editor.getByRole('button', { name: 'Cancelar', exact: true });
  await expect(save).toHaveAttribute('form', 'person-edit-form');
  await expect(editor.locator('form button[type=submit]')).toHaveCount(0);
  await expect(save).toBeInViewport();
  await expect(cancel).toBeInViewport();
  expect(Math.abs((await save.boundingBox())!.y - (await cancel.boundingBox())!.y)).toBeLessThan(2);
  await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeDisabled();
  await expect(page.getByText('000AB9', { exact: true })).toBeVisible();
  await page.getByLabel('Nombres *', { exact: true }).fill(' ');
  await page.getByLabel('Nombres *', { exact: true }).blur();
  await expect(page.getByRole('alert')).toContainText('nombres válidos');
  await page.getByLabel('Nombres *', { exact: true }).fill('Ángela actualizada');
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/011-editing-${info.project.name}.png`,
      fullPage: true,
    });
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .dblclick({ force: true });
  await expect(page.getByText('Cambios guardados correctamente.', { exact: true })).toBeVisible();
  expect(state.puts).toBe(1);
  expect(state.body['expectedUpdatedAt']).toBe('2026-11-07T00:00:00.123456Z');
  expect(state.body).not.toHaveProperty('branchId');
  expect(state.body).not.toHaveProperty('isActive');
  await expect(page.getByRole('dialog', { name: 'Editar persona', exact: true })).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Ver detalle de Ángela actualizada De la Cruz', exact: true })
    .click();
  await expect(page.getByText('Ángela actualizada', { exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Ficha de persona', exact: true })
    .getByRole('button', { name: 'Cerrar', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Ficha de persona', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Buscar persona', { exact: true })).toHaveValue('000AB9');
  await expect(
    page
      .getByRole('region', { name: 'Listado de personas', exact: true })
      .getByText('Ángela actualizada De la Cruz', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('HU-003 conflicto conserva borrador y cancelación exige confirmación', async ({ page }) => {
  const state = await api(page);
  state.status = 409;
  await page.goto('/gestion/miembros/' + id + '/editar');
  await page.getByLabel('Nombres *', { exact: true }).fill('Borrador');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('La persona cambió');
  await expect(page.getByLabel('Nombres *', { exact: true })).toHaveValue('Borrador');
  await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(
    page.getByRole('alertdialog', { name: '¿Descartar los cambios?', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(page.getByLabel('Nombres *', { exact: true })).toHaveValue('Borrador');
  await page.getByRole('button', { name: 'Recargar datos actuales', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar y salir', exact: true }).click();
  await expect(page.getByLabel('Nombres *', { exact: true })).toHaveValue('Ángela María');
});

test('HU-003 acceso efectivo exige actualización en la sede de la persona', async ({ page }) => {
  const state = await api(page, 'b');
  await page.goto('/gestion/miembros');
  await expect(page.getByRole('link', { name: /Editar persona/ })).toHaveCount(0);
  await page.goto('/gestion/miembros/' + id + '/editar');
  await expect(page.getByRole('alert')).toContainText('No tienes permiso efectivo');
  await expect(page.getByLabel('Nombres *', { exact: true })).toHaveCount(0);
  expect(state.puts).toBe(0);
});

test('HU-003 sesión expirada al guardar elimina información personal', async ({ page }) => {
  const state = await api(page);
  state.status = 401;
  await page.goto('/gestion/miembros/' + id + '/editar');
  await page.getByLabel('Nombres *', { exact: true }).fill('Borrador');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByText('000AB9', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Borrador', { exact: true })).toHaveCount(0);
});
