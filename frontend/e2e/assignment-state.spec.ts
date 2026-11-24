import { expect, Page, test } from '@playwright/test';
test.use({ screenshot: 'off', trace: 'off', video: 'off' });
const id = '11111111-1111-4111-8111-111111111111';
const branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const states = [
  { id: 'pending', code: 'PENDING', name: 'Pendiente', isFinal: false },
  { id: 'progress', code: 'IN_PROGRESS', name: 'En curso', isFinal: false },
  { id: 'suspended', code: 'SUSPENDED', name: 'Suspendido', isFinal: false },
  { id: 'completed', code: 'COMPLETED', name: 'Completado', isFinal: true },
  { id: 'withdrawn', code: 'WITHDRAWN', name: 'Retirado', isFinal: true },
];
async function api(
  page: Page,
  initial = 'PENDING',
  permissions = ['PROCESS_VIEW', 'PROCESS_CHANGE_STATUS'],
  statusBranch = branch,
) {
  const state = {
    writes: 0,
    status: 200,
    transitionReads: 0,
    bodies: [] as unknown[],
    current: {
      id,
      personId: 'p',
      personName: 'Ana Participante',
      documentType: 'CC',
      documentNumber: '0001',
      processId: 'process',
      processName: 'Discipulado',
      categoryId: 'category',
      categoryName: 'Formación',
      responsiblePersonId: 'r',
      responsibleName: 'Luis Responsable',
      branchId: branch,
      branchName: 'Sede A',
      stateCode: initial,
      stateName: states.find((s) => s.code === initial)!.name,
      assignedAt: '2026-11-07T10:00:00Z',
      startedAt: initial === 'PENDING' ? null : '2026-11-07T10:01:00Z',
      finishedAt: initial === 'COMPLETED' ? '2026-11-07T10:02:00Z' : null,
    },
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          userId: 'u',
          displayName: 'Operador',
          grants: [
            {
              roleId: 'r',
              roleCode: 'OPERATOR',
              branchId: branch,
              permissions: permissions.filter((p) => p !== 'PROCESS_CHANGE_STATUS'),
            },
            ...(permissions.includes('PROCESS_CHANGE_STATUS')
              ? [
                  {
                    roleId: 's',
                    roleCode: 'OPERATOR',
                    branchId: statusBranch,
                    permissions: ['PROCESS_CHANGE_STATUS'],
                  },
                ]
              : []),
          ],
        },
      });
    if (path.endsWith('/auth/csrf'))
      return route.fulfill({ json: { token: 'controlled', headerName: 'X-XSRF-TOKEN' } });
    if (path === '/api/v1/process-assignments/states') {
      ++state.transitionReads;
      const codes =
        state.current.stateCode === 'PENDING'
          ? ['IN_PROGRESS', 'WITHDRAWN']
          : state.current.stateCode === 'IN_PROGRESS'
            ? ['SUSPENDED', 'COMPLETED', 'WITHDRAWN']
            : state.current.stateCode === 'SUSPENDED'
              ? ['IN_PROGRESS', 'WITHDRAWN']
              : [];
      return route.fulfill({ json: states.filter((s) => codes.includes(s.code)) });
    }
    if (path === `/api/v1/process-assignments/${id}/state`) {
      ++state.writes;
      state.bodies.push(route.request().postDataJSON());
      if (state.status !== 200) return route.fulfill({ status: state.status, json: {} });
      const target = states.find((s) => s.code === route.request().postDataJSON().stateCode)!;
      state.current = {
        ...state.current,
        stateCode: target.code,
        stateName: target.name,
        startedAt: state.current.startedAt ?? (target.isFinal ? null : '2026-11-07T10:01:00Z'),
        finishedAt: target.isFinal ? '2026-11-07T10:02:00Z' : null,
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
          filters: { branches: [], categories: [], processes: [], responsiblePeople: [], states },
        },
      });
    return route.fulfill({ json: { items: [], pageNumber: 1, pageSize: 25, totalCount: 0 } });
  });
  return state;
}
async function select(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Nuevo estado *', exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
}
test('HU-010 inicia, cancela finalización, confirma manualmente y refleja lista/detalle', async ({
  page,
}, info) => {
  const state = await api(page);
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await select(page, 'En curso');
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
  await expect(page.getByText('En curso (IN_PROGRESS)', { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
  await select(page, 'Completado');
  await page.getByRole('button', { name: 'Cancelar cambio', exact: true }).click();
  expect(state.writes).toBe(1);
  await expect(page.getByText('Sin finalizar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalización', exact: true }).click();
  await expect(page.getByText('Completado (COMPLETED)', { exact: true })).toBeVisible();
  await expect(
    page.getByText('No hay cambios de estado disponibles para esta asignación.', { exact: true }),
  ).toBeVisible();
  expect(state.bodies).toEqual([{ stateCode: 'IN_PROGRESS' }, { stateCode: 'COMPLETED' }]);
  await expect(page.getByRole('button', { name: 'Guardar estado', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Completado (COMPLETED)', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al seguimiento', exact: true }).click();
  const entry =
    info.project.name === 'desktop'
      ? page.getByRole('row').filter({ hasText: 'Ana Participante' })
      : page.getByRole('article').filter({ hasText: 'Ana Participante' });
  await expect(entry).toContainText('Completado');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('HU-010 solo VIEW y CHANGE de otra sede ocultan acción y no consultan transiciones', async ({
  page,
}) => {
  let state = await api(page, 'IN_PROGRESS', ['PROCESS_VIEW']);
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await expect(page.getByText('En curso (IN_PROGRESS)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar estado', exact: true })).toHaveCount(0);
  expect(state.transitionReads).toBe(0);
  await page.unroute('**/api/v1/**');
  state = await api(page, 'IN_PROGRESS', ['PROCESS_VIEW', 'PROCESS_CHANGE_STATUS'], 'foreign');
  await page.reload();
  await expect(page.getByText('En curso (IN_PROGRESS)', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Nuevo estado *', exact: true })).toHaveCount(0);
  expect(state.writes).toBe(0);
});
test('HU-010 conflicto conserva estado anterior, servidor incierto no reintenta y401 limpia sesión', async ({
  page,
}) => {
  const state = await api(page, 'IN_PROGRESS');
  state.status = 409;
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await select(page, 'Completado');
  await page.getByRole('button', { name: 'Confirmar finalización', exact: true }).click();
  await expect(
    page.getByText(
      'El estado cambió o la transición no está permitida. Vuelve a consultar la asignación antes de intentarlo de nuevo.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText('En curso (IN_PROGRESS)', { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
  state.status = 503;
  await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalización', exact: true }).click();
  await expect(
    page.getByText(
      'No se pudo confirmar el resultado. Consulta las asignaciones antes de volver a enviar.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.writes).toBe(2);
  state.status = 401;
  await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalización', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso/);
  await expect(page.getByText('CC 0001', { exact: true })).toHaveCount(0);
});
test('HU-010 terminal sin transiciones permanece solo lectura sin finalización automática', async ({
  page,
}) => {
  const state = await api(page, 'COMPLETED');
  await page.goto('/gestion/formacion/asignaciones/' + id);
  await expect(
    page.getByText('No hay cambios de estado disponibles para esta asignación.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Nuevo estado *', exact: true })).toHaveCount(0);
  expect(state.writes).toBe(0);
});
