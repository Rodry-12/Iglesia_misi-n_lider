import { expect, Page, test } from '@playwright/test';
test.use({ screenshot: 'off', trace: 'off', video: 'off' });
const branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const category = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const processId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const responsible = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const categoryName = 'Formación básica ' + 'W'.repeat(32);
const rows = Array.from({ length: 26 }, (_, i) => ({
  id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
  personId: `person-${i}`,
  personName: 'Ana ' + String(i).padStart(2, '0'),
  documentType: 'CC',
  documentNumber: '000' + i,
  processId,
  processName: 'Discipulado',
  categoryId: category,
  categoryName,
  processDescription: 'Descripción actual',
  responsiblePersonId: responsible,
  responsibleName: 'Luis Responsable',
  branchId: branch,
  branchName: 'Sede A',
  stateCode: 'PENDING',
  stateName: 'Pendiente',
  assignedAt: '2026-11-07T10:00:00Z',
  startedAt: null,
  finishedAt: null,
}));
const filters = {
  branches: [{ id: branch, name: 'Sede A' }],
  categories: [
    { id: category, name: categoryName },
    { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'Sin asignaciones' },
  ],
  processes: [
    { id: processId, name: 'Discipulado', categoryId: category },
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      name: 'Otro proceso',
      categoryId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    },
  ],
  responsiblePeople: [
    { id: responsible, name: 'Luis Responsable' },
    { id: '99999999-9999-4999-8999-999999999999', name: 'Ana 00' },
  ],
  states: [{ id: 's', code: 'PENDING', name: 'Pendiente', isFinal: false }],
};

test('El scroll empieza debajo del participante y mantiene título y Cerrar fijos', async ({
  page,
}) => {
  const state = await api(page);
  await page.route('**/api/v1/process-assignments?**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has('personId')) return route.fallback();
    return route.fulfill({
      json: {
        items: Array.from({ length: 10 }, (_, i) => ({
          ...rows[0],
          id: `assignment-${i}`,
          processName: `Proceso ${i + 1}`,
        })),
        totalCount: 10,
        pageNumber: 1,
        pageSize: 10,
      },
    });
  });
  await page.goto('/gestion/formacion/asignaciones');
  await page.getByRole('button', { name: 'Ver procesos de Ana 00', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Procesos del participante', exact: true });
  const list = modal.getByRole('region', { name: 'Procesos del participante', exact: true });
  const person = modal.getByRole('heading', { name: 'Ana 00', exact: true });
  const close = modal.getByRole('button', { name: 'Cerrar', exact: true });
  await expect(list).toBeVisible();
  const personBefore = await person.boundingBox();
  const closeBefore = await close.boundingBox();
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect((await list.boundingBox())!.y).toBeGreaterThan(personBefore!.y + personBefore!.height);
  await list.focus();
  await page.keyboard.press('End');
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(modal.getByRole('heading', { name: 'Proceso 10', exact: true })).toBeInViewport();
  expect((await person.boundingBox())!.y).toBe(personBefore!.y);
  expect((await close.boundingBox())!.y).toBe(closeBefore!.y);
  await expect(person).toBeInViewport();
  await expect(close).toBeInViewport();
  expect(state.writes).toBe(0);
});

async function api(page: Page, permissions = ['PROCESS_VIEW']) {
  const state = {
    status: 200,
    detailDelay: 0,
    writes: 0,
    responsibleReads: 0,
    writeBody: null as Record<string, unknown> | null,
    requests: [] as URL[],
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/csrf'))
      return route.fulfill({ json: { token: 'controlled-test-csrf', headerName: 'X-XSRF-TOKEN' } });
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          userId: 'u',
          displayName: 'Lector',
          grants: [{ roleId: 'r', roleCode: 'OPERATOR', branchId: branch, permissions }],
        },
      });
    if (
      (path === '/api/v1/process-assignments' ||
        path === '/api/v1/process-assignments/participants') &&
      route.request().method() === 'GET'
    ) {
      state.requests.push(url);
      if (state.status !== 200) return route.fulfill({ status: state.status, json: {} });
      if (url.searchParams.get('branchId') && url.searchParams.get('branchId') !== branch)
        return route.fulfill({ status: 403, json: {} });
      if (url.searchParams.has('personId') && state.detailDelay)
        await new Promise((resolve) => setTimeout(resolve, state.detailDelay));
      let items = rows.filter(
        (r) => !url.searchParams.has('personId') || r.personId === url.searchParams.get('personId'),
      );
      const search = url.searchParams.get('search');
      if (search)
        items = items.filter(
          (r) => r.personName.includes(search) || r.documentNumber.includes(search),
        );
      const grouped = path.endsWith('/participants');
      const source = grouped
        ? items.map((r) => ({
            personId: r.personId,
            personName: r.personName,
            documentType: r.documentType,
            documentNumber: r.documentNumber,
            branches: [{ id: r.branchId, name: r.branchName }],
          }))
        : items.flatMap((r) => [r, { ...r, id: r.id + '-second', processName: 'Segundo proceso' }]);
      const pageNumber = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '25');
      return route.fulfill({
        json: {
          items: source.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
          totalCount: source.length,
          pageNumber,
          pageSize,
          filters,
        },
      });
    }
    if (path === '/api/v1/process-assignments/states')
      return route.fulfill({
        json: [{ id: 'in-progress', code: 'IN_PROGRESS', name: 'En curso', isFinal: false }],
      });
    if (path.endsWith('/responsible-options')) {
      state.responsibleReads++;
      return route.fulfill({
        json: {
          items: [
            {
              id: 'replacement',
              name: 'Marta Responsable',
              branchId: branch,
              branchName: 'Sede A',
              documentType: 'CC',
              documentNumber: '999',
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
        },
      });
    }
    if (path.endsWith('/responsible') && route.request().method() === 'PUT') {
      state.writes++;
      state.writeBody = route.request().postDataJSON();
      return route.fulfill({
        json: {
          ...rows[0],
          responsiblePersonId: 'replacement',
          responsibleName: 'Marta Responsable',
        },
      });
    }
    if (path.endsWith('/state') && route.request().method() === 'PUT') {
      state.writes++;
      return route.fulfill({
        json: { ...rows[0], stateCode: 'IN_PROGRESS', stateName: 'En curso' },
      });
    }
    if (path.startsWith('/api/v1/process-assignments/')) {
      if (state.detailDelay) await new Promise((resolve) => setTimeout(resolve, state.detailDelay));
      if (route.request().method() !== 'GET') ++state.writes;
      const row = rows.find((r) => path.endsWith('/' + r.id));
      return route.fulfill(row ? { json: row } : { status: 404, json: {} });
    }
    return route.fulfill({ json: { items: [], totalCount: 0, pageNumber: 1, pageSize: 25 } });
  });
  return state;
}
test('HU-009 consulta, filtros, página URL, detalle y fechas sin escrituras', async ({
  page,
}, info) => {
  const state = await api(page);
  await page.goto('/gestion/formacion');
  await page.locator('main').getByRole('link', { name: 'Abrir Seguimiento', exact: true }).click();
  await expect(page.locator('app-table-pagination [role=status]')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await page.reload();
  await expect(page.locator('app-table-pagination [role=status]')).toBeVisible();
  await page.getByLabel('Buscar participante', { exact: true }).fill('00025');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(page.locator('app-table-pagination [role=status]')).toHaveText(
    'Mostrando 1–1 de 1 participantes',
  );
  for (const [label, name] of [
    ['Sede', 'Sede A'],
    ['Categoría', categoryName],
    ['Proceso', 'Discipulado'],
    ['Estado', 'Pendiente'],
    ['Responsable', 'Luis Responsable'],
  ]) {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name, exact: true }).click();
    await expect
      .poll(() =>
        state.requests
          .at(-1)
          ?.searchParams.get(
            label === 'Sede'
              ? 'branchId'
              : label === 'Categoría'
                ? 'categoryId'
                : label === 'Proceso'
                  ? 'processId'
                  : label === 'Estado'
                    ? 'stateCode'
                    : 'responsiblePersonId',
          ),
      )
      .not.toBeNull();
  }
  const entry = page.getByRole('row').filter({ hasText: 'Ana 25' });
  await expect(entry).toContainText('CC 00025');
  await entry.getByRole('button', { name: 'Ver procesos de Ana 25', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Procesos del participante', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/asignaciones\?/);
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Segundo proceso', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Sin finalizar', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('Luis Responsable', { exact: true }).first(),
  ).toBeVisible();
  const reads = state.requests.length;
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.requests.length).toBe(reads);
  await expect(page.getByLabel('Buscar participante', { exact: true })).toHaveValue('00025');
  await expect(page.getByRole('combobox', { name: 'Categoría', exact: true })).toContainText(
    'Formación básica',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(state.writes).toBe(0);
});
test('Seguimiento usa patron administrativo, debounce y modal de solo lectura', async ({
  page,
}) => {
  const state = await api(page);
  state.detailDelay = 1000;
  await page.goto('/gestion/formacion/asignaciones');
  await expect(page.getByRole('button', { name: 'Limpiar filtros', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a formación', exact: true })).toHaveCount(0);
  await expect(page.getByText('Cargando asignaciones…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader').first()).toHaveText('Documento');
  await expect(page.getByRole('row')).toHaveCount(11);
  await expect(page.getByRole('button', { name: /^Editar progreso de / })).toHaveCount(0);
  const input = page.getByLabel('Buscar participante', { exact: true });
  await expect(page.getByRole('button', { name: 'Limpiar búsqueda', exact: true })).toHaveCount(0);
  await input.fill('0002');
  await page.waitForTimeout(1000);
  const times: number[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === '/api/v1/process-assignments/participants' &&
      url.searchParams.get('search') === '00025'
    )
      times.push(Date.now());
  });
  const ended = Date.now();
  await input.fill('00025');
  await expect.poll(() => times.length).toBe(1);
  expect(times[0] - ended).toBeGreaterThanOrEqual(1850);
  await page.getByRole('button', { name: 'Ver procesos de Ana 25', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Procesos del participante', exact: true });
  await expect(modal).toHaveCount(0);
  await expect(modal).toBeVisible();
  await expect(modal.getByText(rows[25].id, { exact: true })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: /Guardar|Editar|Desactivar/ })).toHaveCount(0);
  const reads = state.requests.length;
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(state.requests.length).toBe(reads);
  await input.fill('búsqueda pendiente');
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect.poll(() => state.requests.at(-1)?.searchParams.has('search')).toBe(false);
  await expect(page.getByRole('combobox', { name: 'Proceso', exact: true })).toContainText(
    'Selecciona una categoría',
  );
  expect(state.writes).toBe(0);
});

test('Seguimiento muestra administrar solo con permiso especifico', async ({ page }) => {
  const state = await api(page, ['PROCESS_VIEW', 'PROCESS_CHANGE_STATUS']);
  await page.goto('/gestion/formacion/asignaciones');
  await expect(
    page.getByRole('button', { name: 'Editar progreso de Ana 00', exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(0);
});
test('Categoria controla procesos y Responsable incluye participantes', async ({ page }) => {
  const state = await api(page);
  await page.goto('/gestion/formacion/asignaciones');
  const process = page.getByRole('combobox', { name: 'Proceso', exact: true });
  await expect(process).toBeVisible();
  await process.click();
  await expect(page.getByRole('option')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Sin asignaciones', exact: true })).toBeVisible();
  await page.getByRole('option', { name: categoryName, exact: true }).click();
  await process.click();
  await expect(page.getByRole('option', { name: 'Discipulado', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Otro proceso', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'Discipulado', exact: true }).click();
  await expect.poll(() => state.requests.at(-1)?.searchParams.get('processId')).toBe(processId);
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).click();
  await page.getByRole('option', { name: 'Sin asignaciones', exact: true }).click();
  await expect
    .poll(() => state.requests.at(-1)?.searchParams.get('categoryId'))
    .toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  expect(state.requests.at(-1)?.searchParams.has('processId')).toBe(false);
  await process.click();
  await expect(page.getByRole('option', { name: 'Otro proceso', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Discipulado', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Responsable', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Ana 00', exact: true })).toBeVisible();
  expect(state.writes).toBe(0);
});

test('HU-009 error en toast sin botón de reintento y recuperación al cambiar filtros', async ({
  page,
}) => {
  const state = await api(page);
  state.status = 503;
  await page.goto('/gestion/formacion/asignaciones?search=Nadie');
  await expect(
    page.getByText('No se pudieron cargar las opciones. Inténtalo de nuevo.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Reintentar/ })).toHaveCount(0);
  const reads = state.requests.length;
  await page.waitForTimeout(500);
  expect(state.requests.length).toBe(reads);
  state.status = 200;
  await page.getByLabel('Buscar participante', { exact: true }).fill('Nadie2');
  await expect(
    page.getByText('No hay participantes con procesos que coincidan con los filtros.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Buscar participante', { exact: true })).toHaveValue('Nadie2');
});
test('HU-009 sede manipulada403, recurso no visible404 y sesión expirada401', async ({ page }) => {
  const state = await api(page);
  await page.goto('/gestion/formacion/asignaciones?branchId=foreign');
  await expect(page).toHaveURL(/\/asignaciones\?/);
  await expect(page.locator('p-toast')).toContainText('No tienes permiso');
  await page.goto('/gestion/formacion/asignaciones/99999999-9999-4999-8999-999999999999');
  await expect(
    page.getByText('El recurso no existe o no está disponible en tu ámbito.', { exact: true }),
  ).toBeVisible();
  await page.goto('/gestion/formacion/asignaciones');
  await expect(page.locator('app-table-pagination [role=status]')).toBeVisible();
  state.status = 401;
  await page.getByLabel('Buscar participante', { exact: true }).fill('Expirada');
  await expect(page).toHaveURL(/\/acceso/);
  await expect(page.getByRole('heading', { name: 'Ana 00', exact: true })).toHaveCount(0);
});
test('HU-009 PROCESS_ASSIGN sin VIEW no autoriza listado ni detalle', async ({ page }) => {
  const state = await api(page, ['PROCESS_ASSIGN']);
  await page.goto('/gestion/formacion/asignaciones');
  await expect(page).toHaveURL(/\/sin-acceso$/);
  await page.goto('/gestion/formacion/asignaciones/' + rows[0].id);
  await expect(page).toHaveURL(/\/sin-acceso$/);
  expect(state.requests).toHaveLength(0);
});

test('Participante único abre dos procesos y edición confirma una sola operación controlada', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = await api(page, ['PROCESS_VIEW', 'PROCESS_CHANGE_STATUS']);
  await page.goto('/gestion/formacion/asignaciones');
  await expect(page.getByRole('columnheader')).toHaveText([
    'Documento',
    'Participante',
    'Sede',
    'Acciones',
  ]);
  await expect(page.getByRole('row').filter({ hasText: 'Ana 00' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar progreso de Ana 00', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Administrar procesos', exact: true });
  await expect(modal.getByRole('heading', { name: 'Discipulado', exact: true })).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Segundo proceso', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Editar progreso de Discipulado', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editar progreso', exact: true });
  await expect(editor.getByRole('button', { name: 'Guardar estado', exact: true })).toBeDisabled();
  await editor.getByRole('combobox', { name: 'Nuevo estado', exact: true }).click();
  await page.getByRole('option', { name: 'En curso', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('Pendiente → En curso');
  expect(state.writes).toBe(0);
  await editor.getByRole('button', { name: 'Guardar estado', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar cambio', exact: true }).click();
  expect(state.writes).toBe(0);
  await editor.getByRole('button', { name: 'Guardar estado', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
  await expect.poll(() => state.writes).toBe(1);
  await expect(modal).toBeVisible();
  await expect(page.locator('p-toast')).toContainText('Estado actualizado correctamente.');
  const reads = state.requests.length;
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(state.requests.length).toBe(reads);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Editor conserva selecciones, consulta responsable bajo demanda y guarda con precondición', async ({
  page,
}) => {
  const state = await api(page, [
    'PROCESS_VIEW',
    'PROCESS_CHANGE_STATUS',
    'PROCESS_CHANGE_RESPONSIBLE',
  ]);
  await page.goto('/gestion/formacion/asignaciones');
  await page.getByRole('button', { name: 'Editar progreso de Ana 00', exact: true }).click();
  await page.getByRole('button', { name: 'Editar progreso de Discipulado', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editar progreso', exact: true });
  await expect(editor.getByRole('combobox', { name: 'Nuevo estado' })).toBeVisible();
  expect(state.responsibleReads).toBe(0);
  await editor.getByRole('combobox', { name: 'Nuevo estado' }).click();
  await page.getByRole('option', { name: 'En curso', exact: true }).click();
  const stateButton = editor.getByRole('button', { name: 'Actualizar estado', exact: true });
  const responsibleButton = editor.getByRole('button', { name: 'Cambiar responsable', exact: true });
  await page.mouse.move(0, 0);
  const selectedBackground = await stateButton.evaluate(el => getComputedStyle(el).backgroundColor);
  const unselectedBackground = await responsibleButton.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(selectedBackground).not.toBe(unselectedBackground);
  await editor.getByRole('button', { name: 'Cambiar responsable', exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(responsibleButton).toHaveAttribute('aria-pressed', 'true');
  await expect(stateButton).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => responsibleButton.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(selectedBackground);
  await expect.poll(() => stateButton.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(unselectedBackground);
  await expect.poll(() => state.responsibleReads).toBe(1);
  await expect(editor.getByRole('button', { name: 'Guardar responsable' })).toBeDisabled();
  await editor.getByRole('combobox', { name: 'Nuevo responsable' }).click();
  const search = page.getByRole('textbox', { name: 'Buscar responsable', exact: true });
  await expect(search).toBeFocused();
  await expect(page.getByRole('button', { name: 'Limpiar búsqueda de responsable' })).toHaveCount(
    0,
  );
  await search.fill('Marta');
  await expect.poll(() => state.responsibleReads).toBe(2);
  await expect(search).toHaveValue('Marta');
  await page.getByRole('button', { name: 'Limpiar búsqueda de responsable' }).click();
  await expect(search).toHaveValue('');
  await expect.poll(() => state.responsibleReads).toBe(3);
  await page.getByRole('option', { name: /^Marta Responsable/ }).click();
  await expect(editor.getByRole('status')).toContainText('Luis Responsable → Marta Responsable');
  await editor.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
  await page.mouse.move(0, 0);
  await expect.poll(() => stateButton.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(selectedBackground);
  await expect.poll(() => responsibleButton.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(unselectedBackground);
  await expect(editor.getByRole('combobox', { name: 'Nuevo estado' })).toContainText('En curso');
  await editor.getByRole('button', { name: 'Cambiar responsable', exact: true }).click();
  await expect(editor.getByRole('combobox', { name: 'Nuevo responsable' })).toContainText(
    'Marta Responsable',
  );
  expect(state.responsibleReads).toBe(3);
  await expect(editor.getByRole('button', { name: 'Guardar responsable' })).toBeInViewport();
  await editor.getByRole('button', { name: 'Volver a procesos' }).click();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  expect(state.writes).toBe(0);
  await editor.getByRole('button', { name: 'Guardar responsable' }).click();
  await page.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
  await expect.poll(() => state.writes).toBe(1);
  expect(state.writeBody).toEqual({
    responsiblePersonId: 'replacement',
    expectedResponsiblePersonId: responsible,
  });
  await expect(page.getByRole('dialog', { name: 'Administrar procesos' })).toBeVisible();
  await expect(page.locator('p-toast')).toContainText('Responsable actualizado correctamente.');
});
