import { expect, Page, test } from '@playwright/test';
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const p = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stamps = { createdAt: '2026-11-07T00:00:00Z', updatedAt: '2026-11-07T00:00:00Z' };
const allPermissions = [
  'CATEGORY_VIEW',
  'CATEGORY_CREATE',
  'CATEGORY_UPDATE',
  'PROCESS_VIEW',
  'PROCESS_CREATE',
  'PROCESS_UPDATE',
];
async function catalogApi(page: Page, permissions = allPermissions, global = true) {
  const state = {
    status: 200,
    detailDelay: 0,
    optionsDelay: 0,
    optionsStatus: 200,
    writes: 0,
    requests: [] as string[],
    categories: [
      {
        id: a,
        name: 'Categoría A',
        description: 'Descripción A',
        sortOrder: 0,
        isActive: true,
        ...stamps,
      },
    ],
    processes: [
      {
        id: p,
        categoryId: a,
        name: 'Proceso A',
        description: 'Descripción P',
        sortOrder: 0,
        isActive: true,
        ...stamps,
      },
    ],
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    state.requests.push(method + ' ' + path + url.search);
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          userId: 'test',
          displayName: 'Catálogo controlado',
          grants: [
            {
              roleId: 'role',
              roleCode: global ? 'SUPER_ADMIN' : 'OPERATOR',
              branchId: global ? null : 'branch',
              permissions,
            },
          ],
        },
      });
    if (path === '/api/v1/auth/csrf')
      return route.fulfill({ json: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } });
    const kind = path.startsWith('/api/v1/process-categories') ? 'category' : 'process';
    const base = kind === 'category' ? '/api/v1/process-categories' : '/api/v1/processes';
    if (!path.startsWith(base)) return route.fulfill({ status: 404, json: {} });
    const records = kind === 'category' ? state.categories : state.processes;
    const id = path.slice(base.length + 1).split('/')[0];
    const project = (item: (typeof records)[number]) =>
      kind === 'category'
        ? item
        : {
            ...item,
            categoryName: state.categories.find(
              (c) => c.id === (item as (typeof state.processes)[number]).categoryId,
            )?.name,
            categoryIsActive: state.categories.find(
              (c) => c.id === (item as (typeof state.processes)[number]).categoryId,
            )?.isActive,
          };
    if (method === 'GET') {
      if (path === base) {
        if (kind === 'category' && url.searchParams.get('isActive') === 'true') {
          if (state.optionsDelay)
            await new Promise((resolve) => setTimeout(resolve, state.optionsDelay));
          if (state.optionsStatus !== 200)
            return route.fulfill({ status: state.optionsStatus, json: {} });
        }
        const normalize = (value: string) =>
          value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
        const search = normalize(url.searchParams.get('search') ?? '');
        const filtered = records.filter(
          (item) =>
            (!search ||
              normalize(item.name).includes(search) ||
              (kind === 'process' &&
                normalize(
                  state.categories.find(
                    (c) => c.id === (item as (typeof state.processes)[number]).categoryId,
                  )?.name ?? '',
                ).includes(search))) &&
            (!url.searchParams.get('categoryId') ||
              (item as (typeof state.processes)[number]).categoryId ===
                url.searchParams.get('categoryId')) &&
            (!url.searchParams.get('isActive') ||
              String(item.isActive) === url.searchParams.get('isActive')),
        );
        const page = Number(url.searchParams.get('page') ?? 1);
        const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
        return route.fulfill({
          json: {
            items: filtered.slice((page - 1) * pageSize, page * pageSize).map(project),
            pageNumber: page,
            pageSize,
            totalCount: filtered.length,
          },
        });
      }
      if (state.detailDelay) await new Promise((resolve) => setTimeout(resolve, state.detailDelay));
      const item = records.find((item) => item.id === id);
      return item
        ? route.fulfill({ json: project(item) })
        : route.fulfill({ status: 404, json: {} });
    }
    state.writes++;
    expect(route.request().headers()['x-xsrf-token']).toBe('csrf');
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (state.status !== 200)
      return route.fulfill({ status: state.status, json: { code: 'controlled_error' } });
    const body = route.request().postDataJSON();
    if (path.endsWith('/active')) {
      Object.assign(
        records.find((item) => item.id === id)!,
        body,
      );
      return route.fulfill({ status: 204 });
    }
    const item =
      method === 'POST'
        ? { id: crypto.randomUUID(), ...stamps, isActive: true, ...body }
        : Object.assign(
            records.find((item) => item.id === id)!,
            body,
          );
    if (method === 'POST') records.push(item);
    return route.fulfill({ status: method === 'POST' ? 201 : 200, json: project(item) });
  });
  return state;
}

test('Formacion despliega tres accesos y conserva rutas y permisos globales', async ({ page }) => {
  const state = await catalogApi(page, [...allPermissions, 'PROCESS_ASSIGN']);
  await page.goto('/gestion/formacion');
  await expect(page.getByRole('heading', { name: 'Formación', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Administración', exact: true });
  if (
    (await page
      .getByRole('button', { name: 'Menú', exact: true })
      .getAttribute('aria-expanded')) === 'false'
  )
    await page.getByRole('button', { name: 'Menú', exact: true }).click();
  const submenu = nav.locator('#training-navigation');
  await expect(submenu).toBeVisible();
  await expect(submenu.getByRole('link')).toHaveCount(3);
  for (const [name, path] of [
    ['Categorías', 'categorias'],
    ['Procesos', 'procesos'],
    ['Seguimiento', 'asignaciones'],
  ])
    await expect(submenu.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      '/gestion/formacion/' + path,
    );
  const toggle = nav.getByRole('button', { name: 'Ocultar opciones de Formación', exact: true });
  await toggle.click();
  await expect(submenu).toBeHidden();
  await nav
    .getByRole('button', { name: 'Mostrar opciones de Formación', exact: true })
    .press('Enter');
  await submenu.getByRole('link', { name: 'Categorías', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion\/formacion\/categorias$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (
    (await page
      .getByRole('button', { name: 'Menú', exact: true })
      .getAttribute('aria-expanded')) === 'false'
  )
    await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await expect(submenu).toBeVisible();
  await expect(submenu.getByRole('link', { name: 'Categorías', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(state.writes).toBe(0);
});

test('Formacion ofrece modulos y mantiene creacion restringida a alcance global', async ({
  page,
}) => {
  await catalogApi(page, [...allPermissions, 'PROCESS_ASSIGN'], false);
  await page.goto('/gestion/formacion');
  const submenu = page.locator('#training-navigation');
  await expect(submenu.locator('a')).toHaveCount(3);
  await expect(submenu.locator('a[href$="/categorias/crear"]')).toHaveCount(0);
  await expect(submenu.locator('a[href$="/procesos/crear"]')).toHaveCount(0);
});

test('Formacion separa consultas de categorias y procesos y la portada no consulta catalogos', async ({
  page,
}) => {
  const state = await catalogApi(page, [...allPermissions, 'PROCESS_ASSIGN']);
  await page.goto('/gestion/formacion');
  await expect(page.getByRole('heading', { name: 'Formación', exact: true })).toBeVisible();
  expect(
    state.requests.some(
      (r) => r.includes('/api/v1/process-categories') || r.includes('/api/v1/processes'),
    ),
  ).toBe(false);
  await page.locator('main').getByRole('link', { name: 'Abrir Categorías', exact: true }).click();
  await expect(
    page.locator('main').getByRole('heading', { name: 'Categorías', exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByLabel('Buscar proceso', { exact: true })).toHaveCount(0);
  expect(state.requests.some((r) => r.includes('/api/v1/processes'))).toBe(false);
  state.requests.length = 0;
  await page.goto('/gestion/formacion/procesos');
  await expect(page.getByLabel('Buscar proceso', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Buscar categoría', { exact: true })).toHaveCount(0);
  expect(state.requests.some((r) => r.includes('/api/v1/process-categories'))).toBe(false);
  expect(state.writes).toBe(0);
});

test('Cerrar consulta o cancelar no recarga listado y guardar solo se habilita con cambios', async ({
  page,
}) => {
  const state = await catalogApi(page);
  for (const [segment, base, noun, original] of [
    ['categorias', '/api/v1/process-categories', 'categoría', 'Categoría A'],
    ['procesos', '/api/v1/processes', 'proceso', 'Proceso A'],
  ]) {
    await page.goto('/gestion/formacion/' + segment);
    const view = page.getByRole('link', { name: 'Ver ' + noun + ' ' + original, exact: true });
    await expect(view).toBeVisible();
    const reads = () => state.requests.filter((r) => r.startsWith('GET ' + base + '?')).length;
    const initialReads = reads();
    await view.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/formacion/' + segment + '$'));
    expect(reads()).toBe(initialReads);
    const edit = page.getByRole('link', { name: 'Editar ' + noun + ' ' + original, exact: true });
    await edit.click();
    const dialog = page.getByRole('dialog', { name: 'Editar ' + noun, exact: true });
    const name = dialog.getByLabel('Nombre *', { exact: true });
    const save = dialog.getByRole('button', { name: 'Guardar ' + noun, exact: true });
    await expect(name).toHaveValue(original);
    await expect(save).toBeDisabled();
    await name.fill(original + ' actualizado');
    await expect(save).toBeEnabled();
    await name.fill('');
    await expect(save).toBeDisabled();
    await name.fill(original);
    await expect(save).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/formacion/' + segment + '$'));
    expect(reads()).toBe(initialReads);
    const beforeWrites = state.writes;
    await edit.click();
    await name.fill(original + ' actualizado');
    await save.click();
    await expect(page).toHaveURL(new RegExp('/formacion/' + segment + '$'));
    await expect(
      page.getByRole('link', {
        name: 'Ver ' + noun + ' ' + original + ' actualizado',
        exact: true,
      }),
    ).toBeVisible();
    expect(reads()).toBe(initialReads + 1);
    expect(state.writes).toBe(beforeWrites + 1);
  }
});

test('Crear categoria y proceso mantienen texto e icono legibles en ambos temas', async ({
  page,
}) => {
  await catalogApi(page);
  for (const theme of ['light', 'dark']) {
    for (const [segment, label] of [
      ['categorias', 'Crear categoría'],
      ['procesos', 'Crear proceso'],
    ]) {
      await page.goto('/gestion/formacion/' + segment);
      await page.evaluate(
        (value) => document.documentElement.setAttribute('data-theme', value),
        theme,
      );
      const button = page
        .locator('.catalog-toolbar')
        .getByRole('link', { name: label, exact: true });
      await expect(button).toBeVisible();
      await expect(button.locator('svg')).toBeVisible();
      for (const hovered of [false, true]) {
        if (hovered) await button.hover();
        const contrast = await button.evaluate((element) => {
          const style = getComputedStyle(element);
          const luminance = (color: string) => {
            const channels = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((v) => {
                const n = v / 255;
                return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
              });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          const fg = luminance(style.color),
            bg = luminance(style.backgroundColor);
          return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test('Catalogo usa debounce de dos segundos y estado inmediato sin boton buscar', async ({
  page,
}) => {
  const state = await catalogApi(page);
  await page.goto('/gestion/formacion/categorias');
  const search = page.getByLabel('Buscar categoría', { exact: true });
  await expect(search).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buscar categorías', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Limpiar búsqueda', exact: true })).toHaveCount(0);
  const reads: number[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === '/api/v1/process-categories' &&
      url.searchParams.get('search') === 'Categoría'
    )
      reads.push(Date.now());
  });
  await search.fill('Cate');
  await page.waitForTimeout(1000);
  const finishedTyping = Date.now();
  await search.fill('Categoría');
  await expect.poll(() => reads.length).toBe(1);
  expect(reads[0] - finishedTyping).toBeGreaterThanOrEqual(1850);
  await expect(page.getByRole('button', { name: 'Limpiar búsqueda', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Estado de categorías', exact: true }).click();
  await page.getByRole('option', { name: 'Inactiva', exact: true }).click();
  await expect
    .poll(
      () =>
        state.requests.some(
          (r) => r.includes('/process-categories') && r.includes('isActive=false'),
        ),
      { timeout: 1500 },
    )
    .toBe(true);
  expect(state.writes).toBe(0);
});

test('Busqueda parcial consol encuentra categorias y sus procesos sin escrituras', async ({
  page,
}) => {
  const state = await catalogApi(page);
  state.categories[0].name = 'Consolidación';
  state.processes[0].name = 'Encuentro inicial';
  for (const segment of ['categorias', 'procesos']) {
    await page.goto(`/gestion/formacion/${segment}`);
    const search = page.getByLabel(
      segment === 'categorias' ? 'Buscar categoría' : 'Buscar proceso',
      { exact: true },
    );
    if (segment === 'procesos')
      await expect(search).toHaveAttribute('placeholder', 'Buscar por nombre o categoría...');
    for (const term of ['consol', 'CONSOL', 'consolidacion']) {
      await search.fill(term);
      const endpoint =
        segment === 'categorias' ? '/api/v1/process-categories' : '/api/v1/processes';
      await expect
        .poll(() =>
          state.requests.some(
            (r) =>
              r.startsWith(`GET ${endpoint}?`) &&
              new URL('https://localhost' + r.slice(4)).searchParams.get('search') === term,
          ),
        )
        .toBe(true);
      await expect(
        page.getByRole('link', {
          name:
            segment === 'categorias'
              ? 'Ver categoría Consolidación'
              : 'Ver proceso Encuentro inicial',
          exact: true,
        }),
      ).toBeVisible();
    }
  }
  expect(state.writes).toBe(0);
});

test('Crear proceso no avisa categorias vacias durante carga ni ante error', async ({ page }) => {
  const state = await catalogApi(page);
  state.optionsDelay = 1800;
  const warning = page.getByText(
    'No hay categorías activas disponibles. Crea o activa una categoría antes de guardar el proceso.',
    { exact: true },
  );
  await page.goto('/gestion/formacion/procesos/crear');
  await expect
    .poll(() =>
      state.requests.some((r) => r.includes('/process-categories?') && r.includes('isActive=true')),
    )
    .toBe(true);
  await expect(warning).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Crear proceso', exact: true })).toBeVisible();
  await expect(warning).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Categoría *', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Categoría A', exact: true })).toBeVisible();
  state.optionsStatus = 503;
  await page.goto('/gestion/formacion/procesos/crear');
  await expect(
    page.getByText('No fue posible consultar las categorías autorizadas.', { exact: true }),
  ).toBeVisible();
  await expect(warning).toHaveCount(0);
  state.optionsStatus = 200;
  state.categories = [];
  await page.goto('/gestion/formacion/procesos/crear');
  await expect(warning).toBeVisible();
  expect(state.writes).toBe(0);
});

test('Detalle y edicion esperan GET, conservan tabla y acciones en footer', async ({ page }) => {
  const state = await catalogApi(page);
  state.detailDelay = 1500;
  await page.goto('/gestion/formacion/categorias');
  const createBox = await page
    .locator('main')
    .getByRole('link', { name: 'Crear categoría', exact: true })
    .boundingBox();
  const panelBox = await page.locator('.catalog-filter-panel').boundingBox();
  expect(createBox!.x + createBox!.width / 2).toBeGreaterThan(panelBox!.x + panelBox!.width / 2);
  await page.getByRole('link', { name: 'Ver categoría Categoría A', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Detalle de categoría', exact: true });
  await expect(detail).toHaveCount(0);
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: /Editar|Desactivar/ })).toHaveCount(0);
  await expect(detail.getByText('UUID', { exact: true })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('link', { name: 'Editar categoría Categoría A', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar categoría', exact: true });
  await expect(edit).toHaveCount(0);
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel('Nombre *', { exact: true })).toHaveValue('Categoría A');
  const save = edit.getByRole('button', { name: 'Guardar categoría', exact: true });
  await expect(save).toHaveAttribute('form', 'catalog-form');
  const saveBox = await save.boundingBox();
  const cancelBox = await edit.getByRole('button', { name: 'Cancelar', exact: true }).boundingBox();
  expect(Math.abs(saveBox!.y - cancelBox!.y)).toBeLessThan(2);
  await edit.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(edit).toHaveCount(0);
  expect(state.writes).toBe(0);
});

test('HU-007 categoría y proceso: crear, consultar, editar y desactivar', async ({
  page,
}, info) => {
  const state = await catalogApi(page);
  await page.goto('/gestion/formacion/categorias');
  await page.locator('main').getByRole('link', { name: 'Crear categoría', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Categoría nueva');
  await page.getByLabel('Descripción', { exact: true }).fill('Descripción nueva');
  await page.getByRole('button', { name: 'Guardar categoría', exact: true }).click();
  await page.getByRole('link', { name: 'Ver categoría Categoría nueva', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Categoría nueva', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('link', { name: 'Editar categoría Categoría nueva', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Categoría editada');
  await page.getByRole('button', { name: 'Guardar categoría', exact: true }).click();
  await page.getByRole('link', { name: 'Ver categoría Categoría editada', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Desactivar categoría Categoría editada', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toBe(2);
  await page
    .getByRole('button', { name: 'Desactivar categoría Categoría editada', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  await expect(page.getByText('Inactiva', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/gestion\/formacion\/categorias(?:\?|$)/);
  await page.goto('/gestion/formacion/procesos');
  await page.locator('main').getByRole('link', { name: 'Crear proceso', exact: true }).click();
  await expect(page).toHaveURL(/\/procesos\/crear(?:\?|$)/);
  await page.getByRole('combobox', { name: 'Categoría *', exact: true }).click();
  await page.getByRole('option', { name: 'Categoría A', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Proceso nuevo');
  await page.getByRole('button', { name: 'Guardar proceso', exact: true }).click();
  await page.getByRole('link', { name: 'Ver proceso Proceso nuevo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('link', { name: 'Editar proceso Proceso nuevo', exact: true }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Descripción editada');
  await page.getByRole('button', { name: 'Guardar proceso', exact: true }).click();
  await page.getByRole('link', { name: 'Ver proceso Proceso nuevo', exact: true }).click();
  await expect(page.getByText('Descripción editada', { exact: true })).toBeVisible();
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/013-catalog-detail-${info.project.name}.png`,
      fullPage: true,
    });
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Desactivar proceso Proceso nuevo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
  expect(state.writes).toBe(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('HU-007 selección, búsqueda, paginación URL y recarga', async ({ page }, info) => {
  const state = await catalogApi(page);
  for (let i = 0; i < 10; i++)
    state.processes.push({
      ...state.processes[0],
      id: crypto.randomUUID(),
      name: 'Proceso extra ' + i,
    });
  await page.goto('/gestion/formacion/procesos?page=2&pageSize=10&search=Proceso');
  await expect(page.getByLabel('Buscar proceso', { exact: true })).toHaveValue('Proceso');
  await expect
    .poll(() => state.requests.some((r) => r.includes('page=2') && r.includes('/processes')))
    .toBe(true);
  await page.goto('/gestion/formacion/categorias');
  await page.getByRole('button', { name: 'Ver procesos de Categoría A', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Ver proceso Proceso A', exact: true }),
  ).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('categoryId')).toBe(a);
  await expect(page).toHaveURL(/\/formacion\/procesos\?/);
  await page.goto('/gestion/formacion/categorias');
  await page.getByLabel('Buscar categoría', { exact: true }).fill('No existe');
  await expect(
    page.getByText('No se encontraron categorías con estos filtros.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Buscar categoría', { exact: true })).toHaveValue('No existe');
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/013-catalog-list-${info.project.name}.png`,
      fullPage: true,
    });
});

test('HU-007 permisos de sede no habilitan escritura global ni rutas manipuladas', async ({
  page,
}) => {
  const state = await catalogApi(page, allPermissions, false);
  await page.goto('/gestion/formacion/categorias');
  await expect(page.getByRole('link', { name: 'Crear categoría', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Desactivar categoría/ })).toHaveCount(0);
  await page.goto('/gestion/formacion/categorias/crear');
  await expect(page).toHaveURL(/\/sin-acceso$/);
  expect(state.writes).toBe(0);
});

test('HU-007 CATEGORY_VIEW no solicita procesos y permite navegación de categorías', async ({
  page,
}) => {
  const state = await catalogApi(page, ['CATEGORY_VIEW'], false);
  await page.goto('/gestion/formacion/categorias');
  await expect(
    page.getByRole('link', { name: 'Ver categoría Categoría A', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Procesos', exact: true })).toHaveCount(0);
  expect(state.requests.some((r) => r.includes('/api/v1/processes'))).toBe(false);
  await page.getByRole('link', { name: 'Ver categoría Categoría A', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Detalle de categoría', exact: true }),
  ).toBeVisible();
});

test('HU-007 duplicado conserva formulario, confirma cancelación y 401 elimina datos', async ({
  page,
}) => {
  const state = await catalogApi(page);
  await page.goto('/gestion/formacion/categorias/crear');
  await page.getByLabel('Nombre *', { exact: true }).fill('Categoría A');
  state.status = 409;
  await page.getByRole('button', { name: 'Guardar categoría', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('el nombre ya existe');
  await expect(page.getByLabel('Nombre *', { exact: true })).toHaveValue('Categoría A');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(
    page.getByRole('alertdialog', { name: '¿Descartar los cambios?', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  state.status = 401;
  await page.getByRole('button', { name: 'Guardar categoría', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByLabel('Nombre *', { exact: true })).toHaveCount(0);
});
