export type CatalogKind = 'category' | 'process';
export interface Category {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}
export interface MinistryProcess extends Category {
  readonly categoryId: string;
  readonly categoryName: string | null;
  readonly categoryIsActive: boolean | null;
}
export type CatalogItem = Category | MinistryProcess;
export interface CatalogPage<T> {
  readonly items: T[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
}
export interface CatalogQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly active: '' | 'true' | 'false';
}
export interface CatalogFilters {
  readonly categories: CatalogQuery;
  readonly processes: CatalogQuery & { readonly categoryId: string };
}
export interface CatalogRequest {
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly categoryId?: string;
}
export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  categories: { page: 1, pageSize: 10, search: '', active: '' },
  processes: { page: 1, pageSize: 10, search: '', active: '', categoryId: '' },
};
export const catalogPath = (kind: CatalogKind) =>
  kind === 'category' ? '/api/v1/process-categories' : '/api/v1/processes';
export const catalogSegment = (kind: CatalogKind) =>
  kind === 'category' ? 'categorias' : 'procesos';
export const catalogPermission = (kind: CatalogKind, action: 'VIEW' | 'CREATE' | 'UPDATE') =>
  `${kind === 'category' ? 'CATEGORY' : 'PROCESS'}_${action}` as
    | 'CATEGORY_VIEW'
    | 'CATEGORY_CREATE'
    | 'CATEGORY_UPDATE'
    | 'PROCESS_VIEW'
    | 'PROCESS_CREATE'
    | 'PROCESS_UPDATE';
export type CatalogError =
  'not-found' | 'forbidden' | 'invalid' | 'conflict' | 'unavailable' | 'unconfirmed' | null;
