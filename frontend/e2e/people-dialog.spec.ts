import { expect, test } from '@playwright/test';
test.use({ screenshot: 'off', trace: 'off', video: 'off' });
const id = '11111111-1111-4111-8111-111111111111';
test('personas: ojo espera respuesta, abre solo lectura y conserva listado, filtros y foco', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let detailReads = 0;
  const person = {
    id,
    firstNames: 'Ana',
    lastNames: 'Consulta',
    email: 'test@example.invalid',
    phone: null,
    birthDate: null,
    branchId: 'a',
    branchName: 'Sede A',
    isActive: true,
    documents: [],
    hasDocuments: false,
    createdAt: null,
    updatedAt: null,
  };
  await page.route('**/api/v1/**', async (route) => {
    expect(route.request().method()).toBe('GET');
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/session'))
      return route.fulfill({
        json: {
          userId: 'u',
          displayName: 'Prueba',
          grants: [
            {
              roleId: 'op',
              roleCode: 'OPERATOR',
              branchId: 'a',
              permissions: ['PERSON_VIEW', 'PERSON_UPDATE', 'PERSON_DEACTIVATE'],
            },
          ],
        },
      });
    if (url.pathname === `/api/v1/people/${id}`) {
      detailReads++;
      await gate;
      return route.fulfill({ json: person });
    }
    if (url.pathname === '/api/v1/people')
      return route.fulfill({
        json: { items: [person], pageNumber: 2, pageSize: 10, totalCount: 11, branches: [] },
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/gestion/miembros?page=2&pageSize=10&search=Ana');
  const eye = page.getByRole('link', { name: 'Ver detalle de Ana Consulta', exact: true });
  await eye.click();
  await expect.poll(() => detailReads).toBe(1);
  const modal = page.getByRole('dialog', { name: 'Ficha de persona', exact: true });
  await expect(modal).toHaveCount(0);
  release();
  await expect(modal).toBeVisible();
  await expect(modal.getByText('test@example.invalid', { exact: true })).toBeVisible();
  await expect(modal.locator('input,select,textarea,a')).toHaveCount(0);
  await expect(modal.getByRole('button')).toHaveText(['Cerrar']);
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/page=2&pageSize=10&search=Ana/);
  await expect(eye).toBeFocused();
  await expect(page.getByLabel('Buscar persona', { exact: true })).toHaveValue('Ana');
  expect(detailReads).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
