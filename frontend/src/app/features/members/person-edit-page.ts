import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  signal,
  input,
  output,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { Notifications } from '../../core/notifications/notifications';
import { AccessContext } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { MembersStore } from './members.store';
import { Person, identification, UpdatePersonRequest } from './members.models';
import { birthDateValue, optionalEmail, requiredText, validBirthDate } from './person-form';

@Component({
  selector: 'app-person-edit-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DatePickerModule,
    ToastFeedback,
    ConfirmDialogModule,
    DialogModule,
  ],
  providers: [ConfirmationService, MembersStore],
  templateUrl: './person-edit-page.html',
  styleUrls: ['./person-registration-page.scss', './person-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonEditPage {
  readonly personId = input.required<string>();
  readonly closed = output<void>();
  readonly savedChange = output<void>();
  private readonly notifications = inject(Notifications);
  readonly store = inject(MembersStore);
  readonly access = inject(AccessContext);
  private readonly auth = inject(AuthStore);
  private readonly confirmation = inject(ConfirmationService);
  readonly identification = identification;
  readonly isCurrentDocument = (document: Person['documents'][number]) => document.isCurrent;
  readonly original = signal<Person | null>(null);
  readonly saved = signal(false);
  readonly form = inject(FormBuilder).group({
    firstNames: ['', [requiredText, Validators.maxLength(150)]],
    lastNames: ['', [requiredText, Validators.maxLength(150)]],
    phone: ['', Validators.maxLength(30)],
    email: ['', [optionalEmail, Validators.maxLength(255)]],
    birthDate: [null as Date | null, validBirthDate],
  });
  readonly maxDate = new Date(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  readonly allowed = computed(() => {
    const person = this.original();
    return (
      !!person &&
      !!person.updatedAt &&
      this.access.can('PERSON_VIEW', person.branchId) &&
      this.access.can('PERSON_UPDATE', person.branchId)
    );
  });
  private id = '';
  private leaving?: Promise<boolean>;
  private resolveLeaving?: (value: boolean) => void;
  constructor() {
    const identity = JSON.stringify(this.auth.session());
    effect(() => {
      if (JSON.stringify(this.auth.session()) !== identity) this.closed.emit();
    });
    this.store.updateError.set(null);
    effect(() => {
      const id = this.personId();
      untracked(() => {
        this.id = id;
        this.reload();
      });
    });
    effect(() => {
      if (this.store.detailLoading()) return;
      const error = this.store.detailError();
      if (error) {
        this.notifications.error(
          error === 'not-found'
            ? 'Persona no encontrada.'
            : error === 'forbidden'
              ? 'No tienes permiso para consultar esta persona.'
              : 'No fue posible consultar la persona.',
        );
        this.closed.emit();
      } else if (this.original() && !this.allowed()) {
        this.notifications.warn(
          'No tienes permiso efectivo de edición para esta sede o no hay una versión disponible.',
        );
        this.closed.emit();
      }
    });
    effect(() => {
      const person = this.store.person();
      untracked(() => {
        if (!person || person.id !== this.id) return;
        this.original.set(person);
        const date = person.birthDate?.split('-').map(Number);
        this.form.reset({
          firstNames: person.firstNames,
          lastNames: person.lastNames,
          phone: person.phone ?? '',
          email: person.email ?? '',
          birthDate: date ? new Date(date[0], date[1] - 1, date[2]) : null,
        });
      });
    });
    effect(() => {
      const identity = this.auth.session();
      if (!identity)
        untracked(() => {
          this.original.set(null);
          this.form.reset();
          this.confirmation.close();
          this.resolveLeaving?.(true);
          this.leaving = undefined;
          this.resolveLeaving = undefined;
        });
    });
    // Store clears on every identity/grant change; also erase any local draft immediately.
    effect(() => {
      if (!this.store.person() && !this.store.detailLoading())
        untracked(() => {
          this.original.set(null);
          this.form.reset();
        });
    });
  }
  changed(): boolean {
    const person = this.original();
    if (!person) return false;
    const value = this.values();
    return (
      value.firstNames !== person.firstNames ||
      value.lastNames !== person.lastNames ||
      value.phone !== (person.phone || null) ||
      value.email !== (person.email || null) ||
      value.birthDate !== person.birthDate
    );
  }
  private values() {
    const value = this.form.getRawValue();
    return {
      firstNames: (value.firstNames ?? '').trim(),
      lastNames: (value.lastNames ?? '').trim(),
      phone: value.phone?.trim() || null,
      email: value.email?.trim() || null,
      birthDate: birthDateValue(value.birthDate),
    };
  }
  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (
      !this.allowed() ||
      this.form.invalid ||
      !this.changed() ||
      this.store.updating() ||
      this.saved() ||
      this.store.updateError() === 'conflict'
    )
      return;
    const request: UpdatePersonRequest = {
      ...this.values(),
      expectedUpdatedAt: this.original()!.updatedAt!,
    };
    this.form.disable({ emitEvent: false });
    try {
      const result = await this.store.update(this.id, request);
      if (result) {
        this.saved.set(true);
        this.form.markAsPristine();
        this.notifications.success('Cambios guardados correctamente.');
        this.savedChange.emit();
      }
    } finally {
      this.form.enable({ emitEvent: false });
    }
  }
  reload(): void {
    this.original.set(null);
    this.form.reset();
    this.saved.set(false);
    this.store.updateError.set(null);
    this.store.loadPerson(this.id);
  }
  async reloadConfirmed(): Promise<void> {
    if (await this.canLeave()) this.reload();
  }
  async cancel(): Promise<void> {
    if (await this.canLeave()) this.closed.emit();
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.auth.authenticated() || this.saved()) return true;
    if (this.store.updating()) return false;
    if (!this.changed()) return true;
    if (this.leaving) return this.leaving;
    this.leaving = new Promise<boolean>((resolve) => {
      this.resolveLeaving = resolve;
      this.confirmation.confirm({
        header: '¿Descartar los cambios?',
        message: 'Hay cambios sin guardar. Si sales, se perderán.',
        acceptLabel: 'Descartar y salir',
        rejectLabel: 'Seguir editando',
        closeOnEscape: false,
        accept: () => {
          this.form.reset();
          this.original.set(null);
          this.leaving = undefined;
          this.resolveLeaving = undefined;
          resolve(true);
        },
        reject: () => {
          this.leaving = undefined;
          this.resolveLeaving = undefined;
          resolve(false);
        },
      });
    });
    return this.leaving;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.auth.authenticated() && !this.saved() && (this.changed() || this.store.updating()))
      event.preventDefault();
  }
}
