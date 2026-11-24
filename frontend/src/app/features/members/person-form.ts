import { AbstractControl, ValidatorFn, Validators } from '@angular/forms';

export const requiredText: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };
export const optionalEmail: ValidatorFn = (control) =>
  Validators.email({ value: (control.value ?? '').trim() } as AbstractControl);
export function birthDateValue(date: Date | null): string | null {
  return date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : null;
}
export const validBirthDate: ValidatorFn = (control) => {
  const date: unknown = control.value;
  if (date === null) return null;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return { date: true };
  return birthDateValue(date)! <= new Date().toISOString().slice(0, 10) ? null : { future: true };
};
