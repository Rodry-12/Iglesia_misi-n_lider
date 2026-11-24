import { expect, Page, test } from '@playwright/test';

const branch = {
  id: 'branch-a',
  code: 'MLP-001',
  name: 'Sede de revisión',
  address: null,
  phone: null,
  isActive: true,
  updatedAt: '2026-11-21T00:00:00Z',
};
function gate() {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  return { pending, release };
}
async function api(
  page: Page,
  waits: { list?: Promise<void>; detail?: Promise<void>; administrators?: Promise<void> },
) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    expect(route.request().method()).toBe('GET');
    if (url.pathname.endsWith('/session'))
      return route.fulfill({
        json: {
          userId: 'visual',
          displayName: 'Revisión de carga',
          grants: [
            { roleId: 'r', roleCode: 'SUPER_ADMIN', branchId: null, permissions: ['BRANCH_VIEW'] },
          ],
        },
      });
    if (url.pathname === '/api/v1/branches') {
      await waits.list;
      return route.fulfill({
        json: { items: [branch], pageNumber: 1, pageSize: 25, totalCount: 1 },
      });
    }
    if (url.pathname.endsWith('/administrators')) {
      await waits.administrators;
      return route.fulfill({ json: { items: [], pageNumber: 1, pageSize: 25, totalCount: 0 } });
    }
    if (url.pathname === '/api/v1/branches/branch-a') {
      await waits.detail;
      return route.fulfill({ json: branch });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}

async function fullscreen(page: Page) {
  const overlay = page.locator('.loading-indicator.fullscreen');
  await expect(overlay).toBeVisible();
  await expect(page.locator('.loading-indicator')).toHaveCount(1);
  const box = await overlay.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  const text = await overlay.locator('span').boundingBox();
  expect(Math.abs(text!.x + text!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(text!.y + text!.height / 2 - viewport.height / 2)).toBeLessThan(70);
  expect(
    await page.locator('app-root > app-loading-overlay > .loading-region > [inert]').count(),
  ).toBe(1);
  await expect(page.getByText('Cargando sedes…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Cargando administradores…', { exact: true })).toHaveCount(0);
  return overlay;
}

test('carga: listado cubre todo el viewport con un único indicador centrado', async ({ page }) => {
  const list = gate();
  try {
    await api(page, { list: list.pending });
    await page.goto('/gestion/sedes');
    const overlay = await fullscreen(page);
    list.release();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('[inert]')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Consultar Sede de revisión', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Buscar por nombre o código', { exact: true }).fill('París');
  } finally {
    list.release();
  }
});

test('carga: overlay oscuro persiste hasta completar las peticiones concurrentes', async ({
  page,
}) => {
  const detail = gate(),
    administrators = gate();
  try {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await api(page, { detail: detail.pending, administrators: administrators.pending });
    await page.goto('/gestion/sedes/branch-a');
    const overlay = await fullscreen(page);
    expect(await overlay.locator('svg').evaluate((e) => getComputedStyle(e).animationName)).toBe(
      'none',
    );
    detail.release();
    await expect(
      page.getByRole('dialog', { name: 'Detalle de sede', includeHidden: true }),
    ).toHaveCount(0);
    await expect(overlay).toBeVisible();
    administrators.release();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('[inert]')).toHaveCount(0);
    await expect(page.getByText('Sin administradores asociados.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await expect(page.getByRole('button', { name: 'Desactivar sede', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    detail.release();
    administrators.release();
  }
});
