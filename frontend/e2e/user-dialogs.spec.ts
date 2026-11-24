import { expect, Page, test } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const permissions = [
  'USER_VIEW',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_ASSIGN_ROLE',
  'USER_CHANGE_STATUS',
];
async function api(page: Page, granted = permissions, role = 'SUPER_ADMIN') {
  const state = {
    status: 200,
    reads: 0,
    writes: [] as { path: string; body: any }[],
    user: {
      id: 'target',
      displayName: 'Cuenta controlada',
      email: 'account@example.invalid',
      personId: null,
      personName: null,
      isActive: true,
      emailConfirmed: true,
      hasPassword: true,
      lockoutEnd: null,
      grants: [{ roleId: 'operator', branchId: 'a', permissionIds: ['view'] }],
    },
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path.endsWith('/session'))
      return route.fulfill({
        json: {
          userId: 'actor',
          displayName: 'Administrador de prueba',
          grants: [
            {
              roleId: 'actor-role',
              roleCode: role,
              branchId: role === 'SUPER_ADMIN' ? null : 'a',
              permissions: granted,
            },
          ],
        },
      });
    if (path.endsWith('/csrf'))
      return route.fulfill({ json: { token: 'controlled', headerName: 'X-XSRF-TOKEN' } });
    if (path.endsWith('/administration-options'))
      return route.fulfill({
        json: {
          roles: [
            { id: 'operator', code: 'OPERATOR' },
            { id: 'branchadmin', code: 'BRANCH_ADMIN' },
          ],
          branches: [
            { id: 'a', name: 'Sede A' },
            { id: 'b', name: 'Sede B' },
          ],
          permissions: [{ id: 'view', code: 'PERSON_VIEW' }],
        },
      });
    if (request.method() !== 'GET') {
      expect(request.headers()['x-xsrf-token']).toBe('controlled');
      state.writes.push({ path, body: request.postDataJSON() });
      if (state.status !== 200) return route.fulfill({ status: state.status, json: {} });
      if (path.endsWith('/revoke-sessions')) return route.fulfill({ status: 204 });
      if (path.endsWith('/grants')) {
        state.user.grants = request.postDataJSON().grants;
        return route.fulfill({ status: 204 });
      }
      if (path.endsWith('/active')) {
        state.user.isActive = request.postDataJSON().isActive;
        return route.fulfill({ status: 204 });
      }
      if (path.endsWith('/invitations'))
        return route.fulfill({
          status: 201,
          json: { user: state.user, deliveryStatus: 'unconfirmed' },
        });
      if (path.endsWith('/invitation'))
        return route.fulfill({ status: 202, json: { deliveryStatus: 'unconfirmed' } });
      state.user = { ...state.user, ...request.postDataJSON() };
      return route.fulfill({ json: state.user });
    }
    if (path === '/api/v1/users') {
      state.reads++;
      return route.fulfill({
        json: { items: [state.user], pageNumber: 1, pageSize: 25, totalCount: 1 },
      });
    }
    if (path === '/api/v1/users/target') return route.fulfill({ json: state.user });
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}
test('usuarios: ver es readonly yeditar guarda desde modal sin abandonar el listado', async ({
  page,
}) => {
  const state = await api(page);
  await page.goto('/gestion/usuarios');
  const view = page.getByRole('link', { name: 'Ver cuenta de Cuenta controlada', exact: true }),
    edit = page.getByRole('link', { name: 'Editar cuenta de Cuenta controlada', exact: true });
  await expect(view).toBeVisible();
  await expect(edit).toBeVisible();
  await view.click();
  const detail = page.getByRole('dialog', { name: 'Detalle de usuario', exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('textbox')).toHaveCount(0);
  await expect(detail.getByRole('button')).toHaveText(['Cerrar']);
  await detail.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(view).toBeFocused();
  await edit.click();
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await expect(modal.getByLabel('Nombre visible *', { exact: true })).toHaveValue(
    'Cuenta controlada',
  );
  await modal.getByLabel('Nombre visible *', { exact: true }).fill('Cuenta actualizada');
  const save = modal.getByRole('button', { name: 'Guardar cambios', exact: true });
  const close = modal.getByRole('button', { name: 'Cerrar', exact: true });
  await expect(
    modal.locator('form').getByRole('button', { name: 'Guardar cambios', exact: true }),
  ).toHaveCount(0);
  await expect(save).toHaveAttribute('form', 'user-account-edit-form');
  const saveBox = (await save.boundingBox())!;
  const closeBox = (await close.boundingBox())!;
  expect(Math.abs(saveBox.y - closeBox.y)).toBeLessThan(3);
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Ver cuenta de Cuenta actualizada', exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({ displayName: 'Cuenta actualizada', personId: null });
  await expect(page.locator('p-toast')).toContainText('Cuenta actualizada.');
  await expect(page.locator('p-message').filter({ hasText: 'Cuenta actualizada.' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/gestion\/usuarios$/);
});
test('usuarios: fallo de perfil conserva borrador ycierre confirma descarte', async ({ page }) => {
  const state = await api(page);
  state.status = 409;
  await page.goto('/gestion/usuarios/target/editar');
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await modal.getByLabel('Nombre visible *', { exact: true }).fill('Borrador');
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(modal.getByLabel('Nombre visible *', { exact: true })).toHaveValue('Borrador');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(modal).toHaveCount(0);
});

test('usuarios: asociación opcional busca al pulsar Enter y oculta resultados obsoletos', async ({
  page,
}) => {
  const state = await api(page);
  let searches = 0;
  await page.route('**/api/v1/users/people-options?**', async (route) => {
    searches++;
    expect(new URL(route.request().url()).searchParams.get('search')).toBe('12345');
    await route.fulfill({ json: { items: [], totalCount: 0, pageSize: 25, pageNumber: 1 } });
  });
  await page.goto('/gestion/usuarios/target/editar');
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await expect(modal.getByLabel('Número de documento', { exact: true })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Cerrar sesiones y anular enlaces' })).toHaveCount(
    0,
  );
  await modal
    .getByRole('button', { name: 'Vincular con una persona registrada', exact: true })
    .click();
  await expect(modal.getByText(/No encontramos una persona/)).toHaveCount(0);
  const document = modal.getByLabel('Número de documento', { exact: true });
  await document.fill('12345');
  expect(searches).toBe(0);
  await document.press('Enter');
  await expect(modal.getByText(/No encontramos una persona/)).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Más personas', exact: true })).toHaveCount(0);
  expect(searches).toBe(1);
  expect(state.writes).toHaveLength(0);
  await document.fill('67890');
  await expect(modal.getByText(/No encontramos una persona/)).toHaveCount(0);
  await modal.getByRole('button', { name: 'Ocultar búsqueda', exact: true }).click();
  await expect(document).toHaveCount(0);
});
test('usuarios: revocación explica efecto,permite cancelar yusa endpoint existente una vez', async ({
  page,
}) => {
  const state = await api(page);
  await page.goto('/gestion/usuarios/target/editar');
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await expect(modal.getByRole('button', { name: 'Datos de cuenta', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await modal.getByRole('button', { name: 'Seguridad', exact: true }).click();
  await expect(modal).toContainText('No elimina la cuenta ni cambia su contraseña.');
  await expect(modal.getByRole('textbox')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Guardar cambios', exact: true })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Seguridad', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await modal
    .getByRole('button', { name: 'Cerrar sesiones y anular enlaces', exact: true })
    .click();
  const confirm = page.getByRole('alertdialog', {
    name: '¿Cerrar las sesiones y anular los enlaces?',
    exact: true,
  });
  await expect(confirm).toContainText('No se elimina la cuenta ni se cambia su contraseña.');
  await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await modal
    .getByRole('button', { name: 'Cerrar sesiones y anular enlaces', exact: true })
    .click();
  await confirm.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('p-toast')).toContainText(
    'Sesiones e invitaciones anteriores revocadas.',
  );
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toBe('/api/v1/users/target/revoke-sessions');
});
test('usuarios: readonly noofrece editar ybranchadmin noadministra otra sede', async ({ page }) => {
  const state = await api(page, ['USER_VIEW']);
  await page.goto('/gestion/usuarios');
  await expect(
    page.getByRole('link', { name: 'Editar cuenta de Cuenta controlada', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Ver cuenta de Cuenta controlada', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Detalle de usuario' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.unroute('**/api/v1/**');
  const scoped = await api(page, permissions, 'BRANCH_ADMIN');
  scoped.user.grants[0].branchId = 'b';
  await page.goto('/gestion/usuarios');
  await expect(
    page.getByRole('link', { name: 'Editar cuenta de Cuenta controlada', exact: true }),
  ).toHaveCount(0);
});
test('usuarios: roles ysedes se guardan con contrato deconcesiones existente', async ({ page }) => {
  const state = await api(page);
  await page.goto('/gestion/usuarios/target/editar');
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await modal.getByRole('button', { name: 'Accesos y permisos', exact: true }).click();
  await expect(modal.getByRole('group', { name: 'Personas', exact: true })).toBeVisible();
  await expect(
    modal.getByRole('checkbox', { name: 'Consultar personas', exact: true }),
  ).toBeChecked();
  await modal.getByRole('checkbox', { name: 'Consultar personas', exact: true }).uncheck();
  await expect(
    modal.getByRole('checkbox', { name: 'Consultar personas', exact: true }),
  ).not.toBeChecked();
  await modal.getByRole('checkbox', { name: 'Consultar personas', exact: true }).check();
  await modal.getByRole('combobox', { name: 'Sede 1', exact: true }).click();
  await page.getByRole('option', { name: 'Sede B', exact: true }).click();
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toBe('/api/v1/users/target/grants');
  expect(state.writes[0].body.grants[0]).toEqual({
    roleId: 'operator',
    branchId: 'b',
    permissionIds: ['view'],
  });
});
test('usuarios: invitación modal respeta cuenta solo crear yno consulta listado', async ({
  page,
}) => {
  const state = await api(page, ['USER_CREATE']);
  await page.goto('/gestion/usuarios/invitar');
  const modal = page.getByRole('dialog', { name: 'Invitar usuario', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.locator('input[type=password]')).toHaveCount(0);
  expect(state.reads).toBe(0);
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(0);
});

test('usuarios: explica por qué la cuenta propia tiene accesos protegidos', async ({ page }) => {
  const state = await api(page);
  state.user.id = 'actor';
  await page.goto('/gestion/usuarios/target/editar');
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await expect(modal.getByText(/Accesos protegidos:/)).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Accesos y permisos', exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toHaveLength(0);
});

test('usuarios: acceso personalizado carga listado y edita con sus permisos efectivos', async ({
  page,
}) => {
  const state = await api(page, ['USER_VIEW', 'USER_UPDATE', 'PERSON_VIEW'], 'OPERATOR');
  await page.goto('/gestion/usuarios');
  await expect(
    page.getByRole('link', { name: 'Ver cuenta de Cuenta controlada', exact: true }),
  ).toBeVisible();
  expect(state.reads).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: 'Invitar usuario', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Editar cuenta de Cuenta controlada', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await expect(modal.getByRole('button', { name: 'Accesos y permisos', exact: true })).toHaveCount(
    0,
  );
  await expect(modal.getByRole('button', { name: 'Seguridad', exact: true })).toHaveCount(0);
  await modal.getByLabel('Nombre visible *', { exact: true }).fill('Perfil personalizado');
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toBe('/api/v1/users/target');
});

test('usuarios: acceso personalizado permite concesiones y seguridad solo con sus permisos', async ({
  page,
}) => {
  const state = await api(page, [...permissions, 'PERSON_VIEW'], 'OPERATOR');
  await page.goto('/gestion/usuarios/target/editar');
  const modal = page.getByRole('dialog', { name: 'Administrar usuario', exact: true });
  await modal.getByRole('button', { name: 'Accesos y permisos', exact: true }).click();
  await expect(
    modal.getByRole('checkbox', { name: 'Consultar personas', exact: true }),
  ).toBeChecked();
  await modal.getByRole('button', { name: 'Seguridad', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Desactivar cuenta', exact: true })).toBeVisible();
  await expect(
    modal.getByRole('button', { name: 'Cerrar sesiones y anular enlaces', exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Invitar usuario', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Invitar usuario', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Invitar usuario', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test('usuarios: listado 200 no se pierde por opciones auxiliares 403', async ({ page }) => {
  const state = await api(page, ['USER_VIEW'], 'OPERATOR');
  await page.route('**/api/v1/users/administration-options?**', (route) =>
    route.fulfill({ status: 403, json: {} }),
  );
  await page.goto('/gestion/usuarios');
  await expect(page.locator('p-toast')).toContainText(
    'No tienes autorización para esta operación o sede.',
  );
  await expect(page.locator('main p-message, main .auth-error')).toHaveCount(0);
  await expect(page.locator('p-toast [role="alert"]')).toHaveCount(1);
  await expect(page.getByRole('cell', { name: 'Cuenta controlada', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reintentar opciones', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/gestion\/usuarios$/);
  expect(state.reads).toBeGreaterThan(0);
  expect(state.writes).toHaveLength(0);
});
