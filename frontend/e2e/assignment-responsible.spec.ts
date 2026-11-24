import { expect, Page, test } from '@playwright/test';
test.use({ screenshot: 'off', trace: 'off', video: 'off' });
const id = '11111111-1111-4111-8111-111111111111';
const branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function api(page: Page, permissionBranch = branch, permission = true) {
  const candidate = {
    id: 'next',
    name: 'Nueva Responsable',
    documentType: 'CC',
    documentNumber: '000002',
    branchId: branch,
    branchName: 'Sede A',
  };
  const state = {
    writes: 0,
    reads: 0,
    status: 200,
    terminal: false,
    body: {} as unknown,
    current: {
      id,
      personId: 'person',
      personName: 'Ana Participante',
      documentType: 'CC',
      documentNumber: '000001',
      processId: 'process',
      processName: 'Discipulado',
      categoryName: 'Formación',
      branchId: branch,
      branchName: 'Sede A',
      responsiblePersonId: 'old',
      responsibleName: 'Luis Responsable',
      stateCode: 'PENDING',
      stateName: 'Pendiente',
      assignedAt: '2026-11-08T10:00:00Z',
      startedAt: null,
      finishedAt: null,
    },
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          userId: 'u',
          displayName: 'Operador',
          grants: [
            { roleId: 'r', roleCode: 'OPERATOR', branchId: branch, permissions: ['PROCESS_VIEW'] },
            ...(permission
              ? [
                  {
                    roleId: 'c',
                    roleCode: 'OPERATOR',
                    branchId: permissionBranch,
                    permissions: ['PROCESS_CHANGE_RESPONSIBLE'],
                  },
                ]
              : []),
          ],
        },
      });
    if (path.endsWith('/auth/csrf'))
      return route.fulfill({ json: { token: 'controlled', headerName: 'X-XSRF-TOKEN' } });
    if (path.endsWith('/responsible-options')) {
      ++state.reads;
      return state.terminal
        ? route.fulfill({ status: 409, json: {} })
        : route.fulfill({
            json: { items: [candidate], pageNumber: 1, pageSize: 10, totalCount: 1 },
          });
    }
    if (path.endsWith('/responsible')) {
      ++state.writes;
      state.body = route.request().postDataJSON();
      if (state.status !== 200) return route.fulfill({ status: state.status, json: {} });
      state.current = {
        ...state.current,
        responsiblePersonId: candidate.id,
        responsibleName: candidate.name,
      };
      return route.fulfill({ json: state.current });
    }
    if (path === `/api/v1/process-assignments/${id}`) return route.fulfill({ json: state.current });
    if (path === '/api/v1/process-assignments')
      return route.fulfill({
        json: {
          items: [state.current],
          pageNumber: 1,
          pageSize: 25,
          totalCount: 1,
          filters: {
            branches: [],
            categories: [],
            processes: [],
            responsiblePeople: [],
            states: [],
          },
        },
      });
    return route.fulfill({ json: {} });
  });
  return state;
}
async function select(page: Page) {
  await page.getByRole('combobox', { name: 'Nuevo responsable *', exact: true }).click();
  await page.getByRole('option', { name: /^Nueva Responsable/ }).click();
  await page.getByRole('button', { name: 'Guardar responsable', exact: true }).click();
}
test('HU-011 confirma/cancela, persiste detalle/listado y conserva contexto', async ({
  page,
}, info) => {
  const state = await api(page);
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await select(page);
  await expect(
    page.getByRole('alertdialog', { name: '¿Cambiar el responsable?', exact: true }),
  ).toContainText('Luis Responsable');
  await expect(
    page.getByRole('alertdialog', { name: '¿Cambiar el responsable?', exact: true }),
  ).toContainText('Nueva Responsable');
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Cancelar cambio', exact: true }).click();
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Guardar responsable', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar responsable', exact: true }).click();
  await expect(
    page.getByText('Responsable actualizado correctamente.', { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
  expect(state.body).toEqual({ responsiblePersonId: 'next', expectedResponsiblePersonId: 'old' });
  await page.reload();
  await expect(page.getByText('Nueva Responsable', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Volver al seguimiento', exact: true }).click();
  const entry =
    info.project.name === 'desktop'
      ? page.getByRole('row').filter({ hasText: 'Ana Participante' })
      : page.getByRole('article').filter({ hasText: 'Ana Participante' });
  await expect(entry).toContainText('Nueva Responsable');
  await expect(entry).toContainText('Pendiente');
});
test('HU-011 permiso ausente/en otra sede oculta selector y no busca personas', async ({
  page,
}) => {
  let state = await api(page, branch, false);
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await expect(page.getByText('Luis Responsable', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cambiar responsable', exact: true })).toHaveCount(
    0,
  );
  expect(state.reads).toBe(0);
  await page.unroute('**/api/v1/**');
  state = await api(page, 'foreign');
  await page.reload();
  await expect(page.getByText('Luis Responsable', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Buscar nuevo responsable', { exact: true })).toHaveCount(0);
  expect(state.reads).toBe(0);
});
test('HU-011 conflicto conserva borrador, sin reintento automático y401 elimina detalle', async ({
  page,
}) => {
  const state = await api(page);
  state.status = 409;
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await select(page);
  await page.getByRole('button', { name: 'Confirmar responsable', exact: true }).click();
  await expect(
    page.getByText(
      'El responsable cambió o la selección dejó de ser válida. Actualiza la asignación antes de volver a intentarlo.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText('Luis Responsable', { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
  state.status = 401;
  await page.getByRole('button', { name: 'Guardar responsable', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar responsable', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso/);
  await expect(page.getByText('CC 000001', { exact: true })).toHaveCount(0);
});
test('HU-011 asignación terminal no ofrece candidatos ni permite guardar', async ({ page }) => {
  const state = await api(page);
  state.terminal = true;
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await expect(
    page.getByRole('button', { name: 'Reintentar responsables', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar responsable', exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toBe(0);
});
test('HU-011 HTTP403 notifica en Toast y conserva la ficha autorizada sin ampliar acceso', async ({
  page,
}) => {
  const state = await api(page);
  state.status = 403;
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await select(page);
  await page.getByRole('button', { name: 'Confirmar responsable', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/gestion/formacion/asignaciones/' + id + '$'));
  await expect(page.locator('p-toast')).toContainText(/No tienes/);
  await expect(page.getByText('CC 000001', { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
});
