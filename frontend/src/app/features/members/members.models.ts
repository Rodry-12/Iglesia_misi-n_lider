export interface PersonDocument {
  readonly id: string;
  readonly documentType: string;
  readonly documentNumber: string;
  readonly issuingCountry: string;
  readonly isCurrent: boolean;
  readonly endedAt: string | null;
}
export interface Person {
  readonly id: string;
  readonly firstNames: string;
  readonly lastNames: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly birthDate: string | null;
  readonly isActive: boolean;
  readonly branchId: string | null;
  readonly branchName: string | null;
  readonly documents: readonly PersonDocument[];
  readonly hasDocuments: boolean;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}
export interface PeoplePage {
  readonly items: Person[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly branches: { id: string; name: string }[];
}
export interface PeopleQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly branchId: string;
  readonly active: '' | 'true' | 'false';
}
export interface RegistrationOptions {
  readonly branches: { id: string; name: string }[];
  readonly countries: string[];
  readonly documentTypes: { readonly code: string; readonly name: string }[];
}
export interface CreatePersonRequest {
  readonly person: {
    firstNames: string;
    lastNames: string;
    phone: string | null;
    email: string | null;
    birthDate: string | null;
  };
  readonly branchId: string;
  readonly document: { issuingCountry: string; documentType: string; documentNumber: string };
}
export interface UpdatePersonRequest {
  readonly firstNames: string;
  readonly lastNames: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly birthDate: string | null;
  readonly expectedUpdatedAt: string;
}
export const EMPTY_QUERY: PeopleQuery = {
  page: 1,
  pageSize: 10,
  search: '',
  branchId: '',
  active: '',
};
export function identification(person: Person): string {
  const current = person.documents.find((document) => document.isCurrent);
  return current
    ? `${current.documentType} ${current.documentNumber}`
    : person.hasDocuments || person.documents.length
      ? 'Sin documento vigente'
      : 'Documento pendiente de regularización';
}
export function calendarDate(value: string | null): string {
  if (!value) return 'No registrada';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'No registrada';
}
export function systemDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'No disponible';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value));
}
