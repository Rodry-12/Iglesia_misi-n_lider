import { expect, Page, test } from '@playwright/test';

const branches = [
  { id: 'branch-a', code: 'MLP-001', name: 'Sede Central', isActive: true },
  { id: 'branch-b', code: 'MLP-002', name: 'Sede Norte', isActive: false },
];

async function mockList(page: Page, role = 'SUPER_ADMIN') {
  const state = { response: 'list', reads: [] as URL[], sessions: 0 };
  await page.route('**/api/v1/**', async (route) => {
    expect(route.request().method()).toBe('GET');
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/auth/session') {
      state.sessions++;
      return route.fulfill({
        json: {
          userId: 'controlled-account',
          displayName: 'Cuenta de revisión visual',
          grants: [
            {
              roleId: 'role',
              roleCode: role,
              branchId: role === 'SUPER_ADMIN' ? null : 'branch-a',
              branchName: role === 'SUPER_ADMIN' ? null : 'Sede Central',
              permissions: ['BRANCH_VIEW'],
            },
          ],
        },
      });
    }
    if (url.pathname === '/api/v1/branches') {
      state.reads.push(url);
      if (state.response === 'error') return route.fulfill({ status: 503, json: {} });
      if (state.response === 'loading') {
        await new Promise<void>((resolve) => setTimeout(resolve, 1200));
      }
      return route.fulfill({
        json: {
          items: state.response === 'empty' ? [] : branches,
          pageNumber: Number(url.searchParams.get('page') ?? 1),
          pageSize: 25,
          totalCount: state.response === 'empty' ? 0 : branches.length,
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}

test('sedes: listado visual accesible, temas, rutas y controles de una sola página', async ({
  page,
}, info) => {
  await mockList(page);
  await page.goto('/gestion/sedes');
  await expect(
    page.getByRole('heading', { name: 'Administración de sedes', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveText([
    'Código',
    'Nombre',
    'Estado',
    'Acciones',
  ]);
  await expect(page.getByRole('link', { name: 'Nueva sede', exact: true })).toHaveAttribute(
    'href',
    '/gestion/sedes/crear',
  );
  const consult = page.getByRole('link', { name: 'Consultar Sede Central', exact: true });
  await expect(consult).toHaveAttribute('href', '/gestion/sedes/branch-a');
  await expect(consult).toHaveAttribute('title', 'Consultar Sede Central');
  await expect(
    page.getByRole('link', { name: 'Editar Sede Central', exact: true }),
  ).toHaveAttribute('href', '/gestion/sedes/branch-a/editar');
  await expect(page.locator('.branch-status')).toHaveText(['Activa', 'Inactiva']);
  await expect(page.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();
  await expect(page.locator('app-table-pagination [role=status]')).toHaveText(
    'Mostrando 1–2 de 2 sedes',
  );
  await expect(page.getByPlaceholder('Buscar por nombre o código...')).toBeVisible();
  const bounds = (await consult.boundingBox())!;
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  const region = page.getByRole('region', { name: 'Tabla de sedes', exact: true });
  await region.focus();
  await expect(region).toBeFocused();
  if ((page.viewportSize()?.width ?? 0) < 640) {
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press('End');
  }
  const surface = await page
    .locator('.branch-results-panel')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const createColors = await page
    .getByRole('link', { name: 'Nueva sede', exact: true })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { text: style.color, background: style.backgroundColor };
    });
  expect(createColors.text).not.toBe(createColors.background);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `test-results/branches-list-${info.project.name}-light.png`,
      fullPage: true,
    });
  await page.getByRole('button', { name: 'Tema oscuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page
      .locator('.branch-results-panel')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(surface);
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `test-results/branches-list-${info.project.name}-dark.png`,
      fullPage: true,
    });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const role of ['BRANCH_ADMIN', 'OPERATOR']) {
  test(`sedes: ${role} conserva consulta sin acciones globales`, async ({ page }) => {
    await mockList(page, role);
    await page.goto('/gestion/sedes');
    await expect(
      page.getByRole('link', { name: 'Consultar Sede Central', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nueva sede', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Editar Sede/ })).toHaveCount(0);
    await expect(page.locator('.application-name')).toHaveText('Sede Central');
  });
}

test('sedes: carga, error, reintento y vacío con búsqueda automática', async ({ page }) => {
  const state = await mockList(page);
  state.response = 'loading';
  await page.goto('/gestion/sedes');
  await expect(page.locator('.loading-indicator.fullscreen')).toBeVisible();
  await expect(page.getByText('Cargando sedes…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Sede Central', { exact: true }).last()).toBeVisible();
  const reads = state.reads.length;
  state.response = 'error';
  await page.getByLabel('Buscar por nombre o código', { exact: true }).fill('Norte');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  state.response = 'empty';
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('No hay sedes para estos filtros.', { exact: true })).toBeVisible();
  await expect(page.locator('app-table-pagination [role=status]')).toHaveText(
    'Mostrando 0–0 de 0 sedes',
  );
  expect(state.reads.at(-1)?.searchParams.get('search')).toBe('Norte');
  expect(state.sessions).toBe(1);
  expect(state.reads.length).toBe(reads + 2); // One search and one explicit retry.
});

test('sedes: escritura agrupada y estado automático vuelven a página uno sin duplicar sesión', async ({
  page,
}) => {
  const state = await mockList(page);
  await page.goto('/gestion/sedes?page=2');
  await expect(page.getByText('Página 2', { exact: true })).toBeVisible();
  const initialReads = state.reads.length;
  const search = page.getByLabel('Buscar por nombre o código', { exact: true });
  await search.pressSequentially('paris', { delay: 30 });
  await expect.poll(() => state.reads.length).toBe(initialReads + 1);
  expect(state.reads.at(-1)?.searchParams.get('search')).toBe('paris');
  expect(state.reads.at(-1)?.searchParams.get('page')).toBe('1');
  await expect(page.getByText('Página 1', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Estado', exact: true }).click();
  await page.getByRole('option', { name: 'Inactivas', exact: true }).click();
  await expect.poll(() => state.reads.length).toBe(initialReads + 2);
  expect(state.reads.at(-1)?.searchParams.get('isActive')).toBe('false');
  expect(state.reads.at(-1)?.searchParams.get('search')).toBe('paris');
  // A recorded request is not a rendered response; wait until interaction is restored.
  await expect(page.getByRole('region', { name: 'Listado de sedes', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(
    page.locator('app-root > app-loading-overlay > .loading-region > [inert]'),
  ).toHaveCount(0);
  await search.fill('');
  await expect.poll(() => state.reads.length).toBe(initialReads + 3);
  expect(state.reads.at(-1)?.searchParams.has('search')).toBe(false);
  expect(state.sessions).toBe(1);
  await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toHaveCount(0);
});

test('sedes: composición tablet sin desbordamiento de página', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Tablet se verifica una sola vez.');
  await page.setViewportSize({ width: 820, height: 1080 });
  await mockList(page);
  await page.goto('/gestion/sedes');
  await expect(page.getByRole('link', { name: 'Nueva sede', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Consultar Sede Central', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({ path: 'test-results/branches-list-tablet.png', fullPage: true });
});
