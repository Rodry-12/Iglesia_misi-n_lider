export interface Grant {
  roleId: string;
  branchId: string | null;
  permissionIds?: string[];
}
export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  personId: string | null;
  personName?: string | null;
  isActive: boolean;
  emailConfirmed: boolean;
  hasPassword: boolean;
  lockoutEnd: string | null;
  grants: Grant[];
}
export interface UserOptions {
  roles: { id: string; code: string }[];
  permissions: { id: string; code: string }[];
  branches: { id: string; name: string }[];
}
export interface UserPerson {
  id: string;
  name: string;
  documentType: string;
  documentNumber: string;
  branchId: string | null;
  branchName: string | null;
}
export interface Page<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}
export interface InviteUser {
  email: string;
  displayName: string;
  personId: string | null;
  grants: Grant[];
}
export interface UserFilters {
  pageSize?: number;
  page: number;
  search: string;
  branchId: string;
  isActive: string;
}
