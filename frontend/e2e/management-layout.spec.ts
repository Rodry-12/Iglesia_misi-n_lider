import { expect, Page, test } from '@playwright/test';

async function sessionApi(page: Page, global = false) {
  let requests = 0;
  await page.route('**/api/v1/**', async (route) => {
    requests++;
    expect(route.request().method()).toBe('GET');
    if (new URL(route.request().url()).pathname.endsWith('/session')) {
      return route.fulfill({
        json: {
          userId: 'own-user',
          displayName: 'Cuenta de dos sedes',
          grants: global
            ? [
                {
                  roleId: 'global',
                  roleCode: 'SUPER_ADMIN',
                  branchId: null,
                  permissions: [
                    'PERSON_VIEW',
                    'PROCESS_VIEW',
                    'CATEGORY_VIEW',
                    'BRANCH_VIEW',
                    'USER_VIEW',
                  ],
                },
              ]
            : [
                {
                  roleId: 'r1',
                  roleCode: 'BRANCH_ADMIN',
                  branchId: 'sede-a',
                  branchName: 'Sede París',
                  permissions: ['PERSON_VIEW', 'PROCESS_VIEW'],
                },
                {
                  roleId: 'r2',
                  roleCode: 'OPERATOR',
                  branchId: 'sede-b',
                  branchName: 'Sede Norte',
                  permissions: ['PERSON_VIEW'],
                },
              ],
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return () => requests;
}

test('gestión: menú autorizado, permisos secundarios y tema claro/oscuro', async ({ page }) => {
  const requests = await sessionApi(page);
  await page.goto('/gestion');
  await expect(
    page.getByRole('heading', { name: 'Resumen de gestión', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.session-card').filter({ hasText: 'Permisos' }).locator('strong'),
  ).toHaveText('2');
  await expect(page.locator('main')).toContainText('2 sedes autorizadas');
  await expect(page.locator('.application-name')).toHaveText('Sede París');
  await expect(page.locator('main')).not.toContainText('Misión Líder París');
  await expect(page.locator('main')).not.toContainText('Todas las sedes');
  await expect(page.locator('.module-card')).toHaveCount(2);
  await expect(page.locator('nav a[href="/gestion/usuarios"]')).toHaveCount(0);
  await expect(page.locator('nav a[href="/gestion/sedes"]')).toHaveCount(0);
  await expect(page.locator('#session-permissions')).toHaveCount(0);
  const before = requests();
  await page.getByRole('button', { name: 'Ver mis permisos', exact: true }).click();
  await expect(page.locator('#session-permissions')).toContainText('Consultar personas');
  await expect(page.locator('#session-permissions')).not.toContainText('PERSON_VIEW');
  await expect(page.locator('#session-permissions')).not.toContainText('sede-b');
  await expect(page.locator('#session-permissions')).not.toContainText('own-user');
  await expect(page.locator('#session-permissions')).not.toContainText('Detalle de acceso');
  expect(
    await page
      .locator('.permission-groups h4')
      .first()
      .evaluate((element) => getComputedStyle(element).fontWeight),
  ).toBe('700');
  expect(
    await page
      .locator('.permission-groups li')
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopStyle),
  ).toBe('solid');
  expect(requests()).toBe(before);
  const light = await page
    .locator('.admin-frame')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole('button', { name: 'Tema oscuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const dark = await page
    .locator('.admin-frame')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(dark).not.toBe(light);
  await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    const menu = page.getByRole('button', { name: 'Menú', exact: true });
    await expect(page.locator('#admin-navigation')).toBeHidden();
    await menu.click();
    await expect(page.locator('#admin-navigation')).toBeVisible();
    await page.locator('nav .navigation-link').first().focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#admin-navigation')).toBeHidden();
    await expect(menu).toBeFocused();
  } else {
    await expect(page.locator('#admin-navigation')).toBeVisible();
    await expect(page.locator('nav .navigation-link[aria-current="page"]')).toHaveText('Resumen');
  }
  const sidebar = page.locator('#admin-navigation');
  const menuToggle = page.getByRole('button', { name: 'Menú', exact: true });
  await menuToggle.click();
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (desktop) {
    await expect(sidebar).toBeHidden();
    expect((await page.locator('main').boundingBox())!.x).toBe(0);
    await menuToggle.click();
    await expect(sidebar).toBeVisible();
    const sidebarBox = (await sidebar.boundingBox())!;
    const noteBox = (await sidebar.locator('.sidebar-note').boundingBox())!;
    expect(sidebarBox.y + sidebarBox.height - (noteBox.y + noteBox.height)).toBeLessThanOrEqual(32);
  } else {
    await expect(sidebar).toBeVisible();
    await menuToggle.click();
    await expect(sidebar).toBeHidden();
  }
  await expect(page.locator('.admin-frame img')).toHaveCount(0);
});

test('gestión: búsqueda y paginación de sedes no consultan sesión antes de los datos', async ({
  page,
}) => {
  await sessionApi(page, true);
  let sessions = 0;
  const reads: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/auth/session') sessions++;
  });
  await page.route('**/api/v1/branches?*', (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    return route.fulfill({
      json: {
        items: [],
        pageNumber: Number(url.searchParams.get('page') ?? 1),
        pageSize: Number(url.searchParams.get('pageSize') ?? 10),
        totalCount: 60,
      },
    });
  });
  await page.goto('/gestion/sedes');
  await expect(page.getByText('Página 1', { exact: true })).toBeVisible();
  expect(sessions).toBe(1);
  await page.getByLabel('Buscar por nombre o código', { exact: true }).fill('París');
  await expect(page).toHaveURL(/search=Par/);
  await expect
    .poll(() => reads.some((query) => new URLSearchParams(query).get('search') === 'París'))
    .toBe(true);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Página 2', { exact: true })).toBeVisible();
  expect(sessions).toBe(1);
  await page.reload();
  await expect(page.getByText('Página 2', { exact: true })).toBeVisible();
  expect(sessions).toBe(2);
});

test('gestión: navbar sticky y menú de cuenta por encima del contenido en todas las rutas', async ({
  page,
}) => {
  await sessionApi(page, true);
  for (const path of [
    '/gestion',
    '/gestion/sedes',
    '/gestion/miembros',
    '/gestion/formacion',
    '/gestion/usuarios',
  ]) {
    await page.goto(path);
    const header = page.locator('.admin-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Todas las sedes');
    await expect(header.locator('img')).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Sitio público' })).toHaveCount(0);
    // Synthetic empty space only in this intercepted browser fixture, so the
    // shared layout can be exercised with long content without production data.
    await page.locator('main').evaluate((main) => {
      const spacer = document.createElement('div');
      spacer.style.height = '1800px';
      spacer.setAttribute('aria-hidden', 'true');
      main.append(spacer);
    });
    await page.evaluate(() => window.scrollTo(0, 650));
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
    const box = (await header.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) >= 1024 ? 80 : 128);
    expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Menú de cuenta', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
    const logout = page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true });
    await expect(logout).toBeVisible();
    expect(
      await logout
        .locator('.logout-label')
        .evaluate((element) => getComputedStyle(element).textAlign),
    ).toBe('center');
    const menuBox = (await logout.boundingBox())!;
    expect(menuBox.y).toBeGreaterThanOrEqual(box.y);
    expect(
      await logout.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        );
      }),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(logout).toBeHidden();
    await expect(page.getByRole('button', { name: 'Menú de cuenta', exact: true })).toBeFocused();
  }
});

test('gestión: tablet permite menú desplegable y tarjetas sin desbordamiento', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'La variante tablet se ejecuta una sola vez.');
  await page.setViewportSize({ width: 820, height: 1080 });
  await sessionApi(page);
  await page.goto('/gestion');
  await expect(page.locator('.session-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await expect(page.locator('#admin-navigation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('nav .navigation-link').first().click();
  await expect(page.locator('#admin-navigation')).toBeHidden();
});
