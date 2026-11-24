import { expect, Page, test } from '@playwright/test';
const branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const participant = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ana Participante',
  branchId: branch,
  branchName: 'Sede A',
  documentType: 'CC',
  documentNumber: '0001',
};
const responsible = {
  ...participant,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Luis Responsable',
  documentNumber: '0002',
};
const category = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Formación básica',
  isActive: true,
};
const processOption = {
  id: '44444444-4444-4444-8444-444444444444',
  categoryId: category.id,
  name: 'Discipulado',
  description: 'Proceso activo',
  isActive: true,
};
const assignment = {
  id: '55555555-5555-4555-8555-555555555555',
  personId: participant.id,
  processId: processOption.id,
  responsiblePersonId: responsible.id,
  branchId: branch,
  stateCode: 'PENDING',
  assignedAt: '2026-11-07T00:00:00Z',
  startedAt: null,
  finishedAt: null,
};
async function api(page: Page, permissions = ['PROCESS_ASSIGN', 'PROCESS_VIEW', 'PERSON_VIEW']) {
  const state = {
    status: 201,
    writes: 0,
    bodies: [] as unknown[],
    requests: [] as string[],
    participantStatus: 200,
    optionsDelay: 0,
    memberActive: true,
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    state.requests.push(method + ' ' + path + url.search);
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          userId: 'u',
          displayName: 'Operador',
          grants: [{ roleId: 'r', roleCode: 'OPERATOR', branchId: branch, permissions }],
        },
      });
    if (path.endsWith('/auth/csrf'))
      return route.fulfill({ json: { token: 'controlled', headerName: 'X-XSRF-TOKEN' } });
    if (path === '/api/v1/processes')
      return route.fulfill({ json: { items: [], pageNumber: 1, pageSize: 25, totalCount: 0 } });
    if (path === '/api/v1/people')
      return route.fulfill({
        json: {
          items: [
            {
              id: participant.id,
              firstNames: 'Ana',
              lastNames: 'Participante',
              branchId: branch,
              branchName: 'Sede A',
              isActive: state.memberActive,
              hasDocuments: true,
              documents: [
                {
                  id: 'doc',
                  documentType: 'CC',
                  documentNumber: '0001',
                  isCurrent: true,
                  endedAt: null,
                },
              ],
            },
          ],
          branches: [{ id: branch, name: 'Sede A' }],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
        },
      });
    if (path.endsWith('/selection-options')) {
      if (state.optionsDelay)
        await new Promise((resolve) => setTimeout(resolve, state.optionsDelay));
      return route.fulfill({
        json: {
          categories: [category],
          processes: [processOption],
          initialState: { id: 'state', code: 'PENDING', name: 'Pendiente', isFinal: false },
        },
      });
    }
    if (path.endsWith('/people-options')) {
      if (state.participantStatus !== 200)
        return route.fulfill({ status: state.participantStatus, json: {} });
      const items = url.searchParams.has('branchId')
        ? url.searchParams.get('search') === 'maria'
          ? [
              {
                ...responsible,
                id: '66666666-6666-4666-8666-666666666666',
                name: 'María Responsable',
                documentNumber: '0003',
              },
            ]
          : [responsible]
        : [participant];
      return route.fulfill({ json: { items, pageNumber: 1, pageSize: 10, totalCount: 1 } });
    }
    if (path === '/api/v1/process-assignments' && method === 'POST') {
      ++state.writes;
      state.bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: state.status, json: state.status === 201 ? assignment : {} });
    }
    if (path === '/api/v1/process-assignments/' + assignment.id)
      return route.fulfill({ json: assignment });
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}
async function select(page: Page) {
  await page.getByRole('combobox', { name: 'Participante *', exact: true }).click();
  await page.getByRole('option', { name: new RegExp('^' + participant.name) }).click();
  await page.getByRole('combobox', { name: 'Categoría *', exact: true }).click();
  await page.getByRole('option', { name: category.name, exact: true }).click();
  await page.getByRole('combobox', { name: 'Proceso *', exact: true }).click();
  await page.getByRole('option', { name: processOption.name, exact: true }).click();
  await page.getByRole('combobox', { name: 'Responsable *', exact: true }).click();
  await page.getByRole('option', { name: new RegExp('^' + responsible.name) }).click();
}
test('HU-008 selección, sede automática, POST confirmado y consulta sin desbordamiento', async ({
  page,
}, info) => {
  const state = await api(page);
  await page.goto('/gestion/formacion/asignar');
  await page.getByLabel('Buscar participante', { exact: true }).fill('0001');
  await expect.poll(() => state.requests.some((r) => r.includes('search=0001'))).toBe(true);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(
    page.getByText('Selecciona participante, categoría, proceso y responsable.', { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(0);
  await select(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/014-assignment-form-${info.project.name}.png`,
      fullPage: true,
    });
  await expect(page.getByText('CC 0001', { exact: true })).toBeVisible();
  expect(
    state.requests.some(
      (r) => r.includes('branchId=' + branch) && r.includes('excludePersonId=' + participant.id),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByText('Asignación guardada correctamente.', { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
  expect(state.bodies[0]).toEqual({
    personId: participant.id,
    processId: processOption.id,
    responsiblePersonId: responsible.id,
    branchId: branch,
  });
  await page.getByRole('link', { name: 'Consultar asignación', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/asignaciones/' + assignment.id + '$'));
  await page.getByText('Información técnica', { exact: true }).click();
  await expect(page.getByText(assignment.id, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText('Información técnica', { exact: true }).click();
  await expect(page.getByText(assignment.id, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Miembros asigna desde icono en modal con persona fija y sin recargar el listado', async ({
  page,
}) => {
  const state = await api(page);
  state.optionsDelay = 800;
  await page.goto('/gestion/miembros');
  const action = page.getByRole('button', {
    name: 'Asignar proceso a Ana Participante',
    exact: true,
  });
  await expect(action).toBeVisible();
  const reads = () => state.requests.filter((r) => r.startsWith('GET /api/v1/people?')).length;
  const initialReads = reads();
  await action.click();
  const modal = page.getByRole('dialog', { name: 'Asignar proceso', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Ana Participante', { exact: true })).toBeVisible();
  await expect(modal.getByLabel('Buscar participante', { exact: true })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(reads()).toBe(initialReads);
  await action.click();
  await expect(modal).toBeVisible();
  await modal.getByRole('combobox', { name: 'Categoría *', exact: true }).click();
  await page.getByRole('option', { name: category.name, exact: true }).click();
  await modal.getByRole('combobox', { name: 'Proceso *', exact: true }).click();
  await page.getByRole('option', { name: processOption.name, exact: true }).click();
  await modal.getByRole('combobox', { name: 'Responsable *', exact: true }).click();
  await page.getByRole('option', { name: new RegExp('^' + responsible.name) }).click();
  await modal.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByText('Asignación guardada correctamente.', { exact: true })).toBeVisible();
  await expect(modal).toHaveCount(0);
  expect(state.writes).toBe(1);
  expect(state.bodies[0]).toEqual({
    personId: participant.id,
    processId: processOption.id,
    responsiblePersonId: responsible.id,
    branchId: branch,
  });
  expect(reads()).toBe(initialReads);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/gestion/formacion');
  await expect(page.getByRole('link', { name: 'Asignar proceso', exact: true })).toHaveCount(0);
});

test('Miembros oculta asignar sin permiso de asignacion', async ({ page }) => {
  await api(page, ['PERSON_VIEW']);
  await page.goto('/gestion/miembros');
  await expect(
    page.getByRole('link', { name: 'Ver detalle de Ana Participante', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Asignar proceso a Ana Participante', exact: true }),
  ).toHaveCount(0);
});
test('Responsable busca dentro del selector por servidor tras dos segundos', async ({ page }) => {
  const state = await api(page);
  await page.goto('/gestion/miembros');
  await page
    .getByRole('button', { name: 'Asignar proceso a Ana Participante', exact: true })
    .click();
  const modal = page.getByRole('dialog', { name: 'Asignar proceso', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/Estado inicial/)).toHaveCount(0);
  await expect(modal.getByText(/La fecha de asignación se registra/)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Buscar responsable', exact: true })).toHaveCount(
    0,
  );
  await modal.getByRole('combobox', { name: 'Responsable *', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Buscar responsable', exact: true });
  await expect(input).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Limpiar búsqueda de responsable', exact: true }),
  ).toHaveCount(0);
  await input.fill('mar');
  await page.waitForTimeout(1000);
  const times: number[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/people-options') && url.searchParams.get('search') === 'maria') {
      expect(url.searchParams.get('branchId')).toBe(branch);
      expect(url.searchParams.get('excludePersonId')).toBe(participant.id);
      times.push(Date.now());
    }
  });
  const ended = Date.now();
  await input.fill('maria');
  await expect.poll(() => times.length).toBe(1);
  expect(times[0] - ended).toBeGreaterThanOrEqual(1850);
  await expect(page.getByRole('option', { name: /^María Responsable/ })).toBeVisible();
  await page.getByRole('option', { name: /^María Responsable/ }).click();
  await expect(modal.getByRole('combobox', { name: 'Responsable *', exact: true })).toContainText(
    'María Responsable',
  );
  expect(state.writes).toBe(0);
});
test('Modal conserva borrador ante conflicto y confirma descarte', async ({ page }) => {
  const state = await api(page);
  state.status = 409;
  await page.goto('/gestion/miembros');
  await page
    .getByRole('button', { name: 'Asignar proceso a Ana Participante', exact: true })
    .click();
  const modal = page.getByRole('dialog', { name: 'Asignar proceso', exact: true });
  await modal.getByRole('combobox', { name: 'Categoría *', exact: true }).click();
  await page.getByRole('option', { name: category.name, exact: true }).click();
  await modal.getByRole('combobox', { name: 'Proceso *', exact: true }).click();
  await page.getByRole('option', { name: processOption.name, exact: true }).click();
  await modal.getByRole('combobox', { name: 'Responsable *', exact: true }).click();
  await page.getByRole('option', { name: new RegExp('^' + responsible.name) }).click();
  await modal.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByText(/La asignación está duplicada/)).toBeVisible();
  await expect(modal).toBeVisible();
  expect(state.writes).toBe(1);
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar y salir', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(state.writes).toBe(1);
});

test('Miembros no permite asignar a persona inactiva', async ({ page }) => {
  const state = await api(page);
  state.memberActive = false;
  await page.goto('/gestion/miembros');
  await expect(
    page.getByRole('button', { name: 'Asignar proceso a Ana Participante', exact: true }),
  ).toBeDisabled();
  expect(state.writes).toBe(0);
});

test('Asignar proceso busca tras dos segundos y agrupa acciones al pie', async ({ page }) => {
  const state = await api(page);
  await page.goto('/gestion/formacion/asignar');
  const input = page.getByLabel('Buscar participante', { exact: true });
  await expect(input).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Limpiar búsqueda de participante', exact: true }),
  ).toHaveCount(0);
  await input.fill('An');
  await page.waitForTimeout(1000);
  const ended = Date.now();
  const requested: number[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/people-options') && url.searchParams.get('search') === 'Ana')
      requested.push(Date.now());
  });
  await input.fill('Ana');
  await expect.poll(() => requested.length).toBe(1);
  expect(requested[0] - ended).toBeGreaterThanOrEqual(1850);
  await select(page);
  await expect(
    page
      .locator('.assignment-footer')
      .getByRole('button', { name: 'Guardar asignación', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.assignment-footer').getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(0);
});

test('HU-008 ASSIGN independiente sin lecturas de Personas ni Catálogo ni acceso GET', async ({
  page,
}) => {
  const state = await api(page, ['PROCESS_ASSIGN']);
  await page.goto('/gestion/formacion/asignar');
  await select(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByText('Asignación guardada correctamente.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Consultar asignación', exact: true })).toHaveCount(
    0,
  );
  expect(
    state.requests.some((r) =>
      /^GET \/api\/v1\/(people|processes|process-categories)(\?|$)/.test(r),
    ),
  ).toBe(false);
});
test('HU-008 conflicto conserva borrador y cancelación requiere confirmación', async ({ page }) => {
  const state = await api(page);
  state.status = 409;
  await page.goto('/gestion/formacion/asignar');
  await select(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByText(/La asignación está duplicada/)).toBeVisible();
  await expect(page.getByText('CC 0001', { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(page).toHaveURL(/\/asignar$/);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar y salir', exact: true }).click();
  await expect(page).toHaveURL(/\/formacion$/);
});
test('HU-008 guard deniega sin ASSIGN y 401 elimina el formulario', async ({ page }) => {
  await api(page, ['PROCESS_VIEW']);
  await page.goto('/gestion/formacion/asignar');
  await expect(page).toHaveURL(/\/sin-acceso$/);
  await page.unroute('**/api/v1/**');
  const state = await api(page);
  await page.goto('/gestion/formacion/asignar');
  await select(page);
  state.participantStatus = 401;
  await page.getByLabel('Buscar participante', { exact: true }).fill('sesión expirada');
  await expect(page).toHaveURL(/\/acceso/);
  await expect(page.getByText('CC 0001', { exact: true })).toHaveCount(0);
});
