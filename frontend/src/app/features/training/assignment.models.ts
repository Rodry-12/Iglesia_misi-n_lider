import { Category, MinistryProcess, CatalogPage } from './catalog.models';
export interface AssignmentPerson {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  documentType: string;
  documentNumber: string;
}
export interface AssignmentRequest {
  personId: string;
  processId: string;
  responsiblePersonId: string;
  branchId: string;
}
export interface Assignment extends AssignmentRequest {
  id: string;
  stateCode: string;
  assignedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  personName?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  processName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  processDescription?: string | null;
  responsibleName?: string | null;
  branchName?: string | null;
  stateName?: string | null;
}
export interface AssignmentOptions {
  categories: Category[];
  processes: MinistryProcess[];
  initialState: { id: string; code: string; name: string; isFinal: boolean };
}
export interface AssignmentStateOption {
  id: string;
  code: string;
  name: string;
  isFinal: boolean;
}
export type AssignmentPeople = CatalogPage<AssignmentPerson>;
export interface AssignmentFilters {
  page: number;
  pageSize: number;
  search: string;
  branchId: string;
  categoryId: string;
  processId: string;
  stateCode: string;
  responsiblePersonId: string;
}
export const DEFAULT_ASSIGNMENT_FILTERS: AssignmentFilters = {
  page: 1,
  pageSize: 10,
  search: '',
  branchId: '',
  categoryId: '',
  processId: '',
  stateCode: '',
  responsiblePersonId: '',
};
export interface AssignmentFilterOptions {
  branches: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  processes: { id: string; name: string; categoryId: string }[];
  responsiblePeople: { id: string; name: string }[];
  states: { id: string; code: string; name: string; isFinal: boolean }[];
}
export interface AssignmentPageResult extends CatalogPage<Assignment> {
  filters?: AssignmentFilterOptions | null;
}
export interface AssignmentParticipant {
  personId: string;
  personName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  branches: { id: string; name: string }[];
}
export interface AssignmentParticipantPage extends CatalogPage<AssignmentParticipant> {
  filters?: AssignmentFilterOptions | null;
}
