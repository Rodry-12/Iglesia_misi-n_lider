import { expect, test } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const module of ['miembros', 'sedes', 'usuarios', 'formacion']) {
  test(`tablas: ${module} usa 10/20/50, scroll interno y contador inferior`, async ({ page }) => {
    const reads: URL[] = [];
    await page.route('**/api/v1/**', async (route) => {
      expect(route.request().method()).toBe('GET');
      const url = new URL(route.request().url()),
        path = url.pathname;
      if (path.endsWith('/session'))
        return route.fulfill({
          json: {
            userId: 'admin',
            displayName: 'Prueba controlada',
            grants: [
              {
                roleId: 'root',
                roleCode: 'SUPER_ADMIN',
                branchId: null,
                permissions: [
                  'PERSON_VIEW',
                  'PERSON_CREATE',
                  'PERSON_UPDATE',
                  'PERSON_DEACTIVATE',
                  'BRANCH_VIEW',
                  'BRANCH_CREATE',
                  'USER_VIEW',
                  'USER_CREATE',
                  'PROCESS_VIEW',
                ],
              },
            ],
          },
        });
      if (path.endsWith('/administration-options'))
        return route.fulfill({
          json: { roles: [{ id: 'root', code: 'SUPER_ADMIN' }], branches: [], permissions: [] },
        });
      if (path.endsWith('/permissions')) return route.fulfill({ json: [] });
      reads.push(url);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 10),
        pageNumber = Number(url.searchParams.get('page') ?? 1);
      const items = Array.from(
        { length: Math.min(pageSize, Math.max(0, 65 - (pageNumber - 1) * pageSize)) },
        (_, i) => ({
          id: `00000000-0000-4000-8000-${String((pageNumber - 1) * pageSize + i + 1).padStart(12, '0')}`,
          code: `TEST-${i}`,
          name: `Registro ${i}`,
          firstNames: `Persona ${i}`,
          lastNames: 'Controlada',
          branchId: 'a',
          branchName: 'Sede controlada',
          isActive: true,
          documents: [],
          hasDocuments: false,
          email: `test${i}@example.invalid`,
          displayName: `Cuenta ${i}`,
          personId: null,
          hasPassword: true,
          emailConfirmed: true,
          lockoutEnd: null,
          grants: [{ roleId: 'root', branchId: null }],
          categoryName: 'Prueba',
        }),
      );
      return route.fulfill({
        json: {
          items,
          pageNumber,
          pageSize,
          totalCount: 65,
          branches: [{ id: 'a', name: 'Sede controlada' }],
        },
      });
    });
    await page.goto(`/gestion/${module}`);
    const pagination = page.locator('app-table-pagination').last();
    const size = pagination.getByRole('combobox', { name: 'Registros por página', exact: true });
    await expect(size).toHaveText('10');
    await expect(pagination.getByRole('status')).toContainText('Mostrando 1–10 de 65');
    const table = page.locator('p-table').last();
    await expect(table.locator('tbody tr')).toHaveCount(10);
    await size.click();
    await expect(page.getByRole('option')).toHaveText(['10', '20', '50']);
    await page.getByRole('option', { name: '50', exact: true }).click();
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await expect(pagination.getByRole('status')).toContainText('Mostrando 1–50 de 65');
    expect(
      await table.evaluate((element) =>
        Array.from(element.querySelectorAll('div')).some(
          (e) =>
            ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) &&
            e.scrollHeight > e.clientHeight &&
            e.clientHeight > 0,
        ),
      ),
    ).toBe(true);
    await pagination.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(pagination.getByRole('status')).toContainText('Mostrando 51–65 de 65');
    await expect(pagination.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();
    await size.click();
    await page.getByRole('option', { name: '20', exact: true }).click();
    await expect(pagination.getByRole('status')).toContainText('Mostrando 1–20 de 65');
    expect(reads.some((url) => url.searchParams.get('pageSize') === '20')).toBe(true);
    if (module === 'miembros') {
      await expect(page.getByRole('button', { name: 'Limpiar', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Limpiar búsqueda', exact: true })).toHaveCount(
        0,
      );
      await page.getByLabel('Buscar persona', { exact: true }).fill('Ana');
      await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click();
      await expect(page.getByLabel('Buscar persona', { exact: true })).toHaveValue('');
      await expect(
        page.getByRole('link', { name: 'Registrar persona', exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('link', { name: 'Ver detalle de Persona 0 Controlada', exact: true })
          .locator('svg'),
      ).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
