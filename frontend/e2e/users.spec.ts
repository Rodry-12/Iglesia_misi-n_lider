import { expect, Page, test } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const id = '11111111-1111-4111-8111-111111111111';
async function api(
  page: Page,
  permissions = [
    'USER_VIEW',
    'USER_CREATE',
    'USER_UPDATE',
    'USER_CHANGE_STATUS',
    'USER_ASSIGN_ROLE',
  ],
) {
  const state = {
    writes: 0,
    status: 201,
    invited: false,
    user: {
      id,
      email: 'recipient@example.invalid',
      displayName: 'Invitado',
      isActive: true,
      emailConfirmed: false,
      hasPassword: false,
      lockoutEnd: null,
      personId: null,
      personName: null,
      grants: [{ roleId: 'operator', branchId: 'a', permissionIds: ['view'] }],
    },
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          userId: 'admin',
          displayName: 'Administrador',
          grants: [{ roleId: 'root', roleCode: 'SUPER_ADMIN', branchId: null, permissions }],
        },
      });
    if (path.endsWith('/auth/csrf'))
      return route.fulfill({ json: { token: 'controlled', headerName: 'X-XSRF-TOKEN' } });
    if (path.endsWith('/administration-options'))
      return route.fulfill({
        json: {
          roles: [{ id: 'operator', code: 'OPERATOR' }],
          permissions: [{ id: 'view', code: 'PERSON_VIEW' }],
          branches: [{ id: 'a', name: 'Sede A' }],
        },
      });
    if (path.endsWith('/invitations')) {
      ++state.writes;
      expect(route.request().postDataJSON()).not.toHaveProperty('password');
      if (state.status !== 201) return route.fulfill({ status: state.status, json: {} });
      state.invited = true;
      return route.fulfill({
        status: 201,
        json: { user: state.user, deliveryStatus: 'unconfirmed' },
      });
    }
    if (path === `/api/v1/users/${id}`) return route.fulfill({ json: state.user });
    if (path === '/api/v1/users')
      return route.fulfill({
        json: {
          items: state.invited ? [state.user] : [],
          pageNumber: 1,
          pageSize: 25,
          totalCount: state.invited ? 1 : 0,
        },
      });
    return route.fulfill({ json: {} });
  });
  return state;
}
async function fill(page: Page) {
  await page.getByLabel('Correo de acceso *', { exact: true }).fill('recipient@example.invalid');
  await page.getByLabel('Nombre visible *', { exact: true }).fill('Invitado');
  await page.getByRole('combobox', { name: 'Perfil de acceso 1', exact: true }).click();
  await page.getByRole('option', { name: 'Acceso personalizado', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sede 1', exact: true }).click();
  await page.getByRole('option', { name: 'Sede A', exact: true }).click();
}
test('HU-012 creación confirmada sin contraseña, envío incierto recuperable y detalle', async ({
  page,
}) => {
  const state = await api(page);
  await page.goto('/gestion/usuarios/invitar');
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await fill(page);
  const dialog = page.getByRole('dialog', { name: 'Invitar usuario', exact: true });
  const submit = dialog.getByRole('button', { name: 'Crear e invitar', exact: true });
  const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true });
  await expect(submit).toHaveCount(1);
  await expect(submit).toHaveAttribute('form', 'user-account-invite-form');
  await expect(dialog.locator('form button[type="submit"]')).toHaveCount(0);
  await expect(submit).toBeInViewport();
  await expect(cancel).toBeInViewport();
  const submitBox = await submit.boundingBox();
  const cancelBox = await cancel.boundingBox();
  expect(submitBox).not.toBeNull();
  expect(cancelBox).not.toBeNull();
  expect(Math.abs(submitBox!.y - cancelBox!.y)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Crear e invitar', exact: true }).click();
  expect(state.writes).toBe(0);
  await page
    .getByRole('alertdialog', { name: '¿Crear la cuenta e invitar?', exact: true })
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Crear e invitar', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: '¿Crear la cuenta e invitar?', exact: true })
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(
    page.locator('p-toast').getByText(/Cuenta conservada\. El envío no pudo confirmarse/),
  ).toBeVisible();
  expect(state.writes).toBe(1);
  await page.getByRole('link', { name: 'Editar cuenta de Invitado', exact: true }).click();
  await page.getByRole('button', { name: 'Seguridad', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reenviar invitación', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('HU-012 sin permiso no abre creación y401 retira datos pendientes', async ({ page }) => {
  await api(page, ['USER_VIEW']);
  await page.goto('/gestion/usuarios/invitar');
  await expect(page).toHaveURL(/\/sin-acceso$/);
  await page.unroute('**/api/v1/**');
  const state = await api(page);
  state.status = 401;
  await page.goto('/gestion/usuarios/invitar');
  await fill(page);
  await page.getByRole('button', { name: 'Crear e invitar', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: '¿Crear la cuenta e invitar?', exact: true })
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(page).toHaveURL(/\/acceso/);
  await expect(page.getByLabel('Correo de acceso *', { exact: true })).toHaveCount(0);
});
test('HU-012 activación retira token y no muestra éxito ante token inválido', async ({ page }) => {
  await api(page);
  await page.route('**/api/v1/auth/activate-invitation', (route) =>
    route.fulfill({ status: 400, json: {} }),
  );
  await page.goto('/activar-cuenta#email=recipient%40example.invalid&token=synthetic-token');
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  await page.getByLabel('Nueva contraseña *', { exact: true }).fill('SyntheticPassword123!');
  await page
    .getByLabel('Confirmar nueva contraseña *', { exact: true })
    .fill('SyntheticPassword123!');
  await page.getByRole('button', { name: 'Activar cuenta', exact: true }).click();
  await expect(
    page.getByText(
      'El enlace no es válido, ya fue utilizado o la contraseña no cumple los requisitos.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Operación completada. Ya puedes intentar iniciar sesión.', { exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
