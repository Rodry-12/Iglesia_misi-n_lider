import { expect, test } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.afterEach(async ({ page }) => {
  await page
    .locator('input[type=password]')
    .evaluateAll((inputs) => inputs.forEach((input) => ((input as HTMLInputElement).value = '')))
    .catch(() => {});
});
test('HU-013 sedes reales en PostgreSQL aislado', async ({ page }) => {
  test.skip(process.env['MLP_BRANCH_BROWSER'] !== '1');
  await page.goto('/acceso');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill(process.env['MLP_PEOPLE_EMAIL']!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['MLP_PEOPLE_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await page.goto('/gestion/sedes');
  await expect(
    page.getByRole('heading', { name: 'Administración de sedes', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Nueva sede', exact: true }).click();
  const code =
    'E' + Date.now().toString(36).toUpperCase() + test.info().project.name[0].toUpperCase();
  await page.getByLabel('Código *', { exact: true }).fill(code);
  await page.getByLabel('Nombre *', { exact: true }).fill('Sede E2E ' + code);
  const create = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/branches' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear sede', exact: true }).click();
  const created = await create;
  expect(created.status()).toBe(201);
  const branch = await created.json();
  await expect(page).toHaveURL(/\/gestion\/sedes$/);
  await page.getByRole('link', { name: 'Consultar Sede E2E ' + code, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Administradores asociados', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('link', { name: 'Editar Sede E2E ' + code, exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Sede editada ' + code);
  const update = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/branches/' + branch.id &&
      r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  expect((await update).status()).toBe(200);
  await page.getByRole('link', { name: 'Editar Sede editada ' + code, exact: true }).click();
  await page.getByRole('button', { name: 'Desactivar sede', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Desactivar sede', exact: true })).toBeVisible();
  for (const action of ['Desactivar sede', 'Reactivar sede']) {
    if (action === 'Reactivar sede')
      await page.getByRole('link', { name: 'Editar Sede editada ' + code, exact: true }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
    const changed = page.waitForResponse(
      (r) => new URL(r.url()).pathname.endsWith('/active') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    expect((await changed).status()).toBe(204);
    await expect(page.getByRole('dialog', { name: 'Editar sede', exact: true })).toHaveCount(0);
  }
  await page.getByLabel('Buscar por nombre o código').fill(code.toLowerCase());
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
