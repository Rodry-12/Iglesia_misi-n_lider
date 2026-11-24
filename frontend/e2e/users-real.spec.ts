import { expect, test } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.afterEach(async ({ page }) => {
  if (!page.isClosed())
    await page.locator('input[type="password"],input[type="email"]').evaluateAll((inputs) => {
      for (const input of inputs) (input as HTMLInputElement).value = '';
    });
});
test('HU-012 create: administrador invita sin conocer contraseña', async ({ page }) => {
  test.skip(
    process.env['MLP_USER_BROWSER'] !== '1' || process.env['MLP_INVITATION_PHASE'] !== 'create',
  );
  await page.goto('/acceso');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill(process.env['MLP_PEOPLE_EMAIL']!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['MLP_PEOPLE_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await page.goto('/gestion/usuarios/invitar');
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page
    .getByLabel('Correo de acceso *', { exact: true })
    .fill(process.env['MLP_INVITED_EMAIL']!);
  await page.getByLabel('Nombre visible *', { exact: true }).fill('Invitado HU012');
  await page.getByRole('combobox', { name: 'Perfil de acceso 1', exact: true }).click();
  await page.getByRole('option', { name: 'Acceso personalizado', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sede 1', exact: true }).click();
  await page.getByRole('option', { name: process.env['MLP_USER_BRANCH']!, exact: true }).click();
  await page.getByRole('checkbox', { name: 'Consultar personas', exact: true }).check();
  await page.getByRole('button', { name: 'Crear e invitar', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Crear e invitar', exact: true }).click();
  const created = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/users/invitations' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.user.hasPassword).toBe(false);
  expect(body.user.emailConfirmed).toBe(false);
  expect(body.deliveryStatus).toBe('accepted');
  await expect(page.getByRole('dialog', { name: 'Invitar usuario', exact: true })).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Ver cuenta de ' + body.user.displayName, exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Detalle de usuario', exact: true })
      .getByText('Pendiente de activación', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
});
test('HU-012 activate: destinatario activa, accede con su sede y cierra sesión', async ({
  page,
}) => {
  test.skip(
    process.env['MLP_USER_BROWSER'] !== '1' || process.env['MLP_INVITATION_PHASE'] !== 'activate',
  );
  await page.goto(
    '/activar-cuenta#email=' +
      encodeURIComponent(process.env['MLP_INVITED_EMAIL']!) +
      '&token=' +
      encodeURIComponent(process.env['MLP_INVITATION_TOKEN']!),
  );
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  await page
    .getByLabel('Nueva contraseña *', { exact: true })
    .fill(process.env['MLP_PEOPLE_PASSWORD']!);
  await page
    .getByLabel('Confirmar nueva contraseña *', { exact: true })
    .fill(process.env['MLP_PEOPLE_PASSWORD']!);
  const activation = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/auth/activate-invitation',
  );
  await page.getByRole('button', { name: 'Activar cuenta', exact: true }).click();
  expect((await activation).status()).toBe(204);
  await expect(
    page.getByText('Operación completada. Ya puedes intentar iniciar sesión.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ir al acceso', exact: true }).click();
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill(process.env['MLP_INVITED_EMAIL']!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['MLP_PEOPLE_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await expect(page.getByText('Consultar personas', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuarios', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByText('Consultar personas', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
});
