import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  output,
  untracked,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { KeyFilterModule } from 'primeng/keyfilter';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { Notifications } from '../../core/notifications/notifications';
import { AccessContext } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { MembersStore } from './members.store';
import { CreatePersonRequest } from './members.models';

import { birthDateValue, validBirthDate, requiredText, optionalEmail } from './person-form';
export { birthDateValue, validBirthDate } from './person-form';

@Component({
  selector: 'app-person-registration-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    KeyFilterModule,
    SelectModule,
    DatePickerModule,
    ToastFeedback,
    ConfirmDialogModule,
    DialogModule,
  ],
  providers: [ConfirmationService, MembersStore],
  templateUrl: './person-registration-page.html',
  styleUrls: ['./person-registration-page.scss', './person-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonRegistrationPage {
  readonly closed = output<void>();
  readonly savedChange = output<void>();
  private readonly notifications = inject(Notifications);
  readonly store = inject(MembersStore);
  readonly access = inject(AccessContext);
  private readonly auth = inject(AuthStore);
  private readonly confirmation = inject(ConfirmationService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly form = inject(FormBuilder).group({
    issuingCountry: ['CO', [requiredText, Validators.pattern(/^\s*[a-zA-Z]{2}\s*$/)]],
    documentType: ['', [requiredText, Validators.maxLength(30)]],
    documentNumber: ['', [requiredText, Validators.pattern(/^[0-9]+$/), Validators.maxLength(50)]],
    firstNames: ['', [requiredText, Validators.maxLength(150)]],
    lastNames: ['', [requiredText, Validators.maxLength(150)]],
    phone: ['', [Validators.pattern(/^[0-9]+$/), Validators.maxLength(30)]],
    email: ['', [optionalEmail, Validators.maxLength(255)]],
    birthDate: [null as Date | null, validBirthDate],
    branchId: ['', Validators.required],
  });
  readonly maxDate = new Date(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  readonly opened = computed(
    () => !this.store.optionsLoading() && !!this.store.registrationOptions()?.branches.length,
  );
  private leaving?: Promise<boolean>;

  constructor() {
    const identity = JSON.stringify(this.auth.session());
    effect(() => {
      if (JSON.stringify(this.auth.session()) !== identity) this.closed.emit();
    });
    this.store.loadRegistrationOptions();
    effect(() => {
      if (this.store.optionsLoading()) return;
      if (this.store.optionsError()) {
        this.notifications.error('No fue posible obtener las opciones de registro.');
        this.closed.emit();
      } else if (
        this.store.registrationOptions() &&
        !this.store.registrationOptions()!.branches.length
      ) {
        this.notifications.warn('No tienes una sede activa disponible para registrar personas.');
        this.closed.emit();
      }
    });
    effect(() => {
      const options = this.store.registrationOptions();
      if (options?.branches.length === 1)
        untracked(() => this.form.controls.branchId.setValue(options.branches[0].id));
    });
    effect(() => {
      if (!this.auth.session())
        untracked(() => {
          this.form.reset();
          this.form.markAsPristine();
          this.confirmation.close();
        });
    });
  }
  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }
  error(name: keyof typeof this.form.controls): string {
    const control: AbstractControl = this.form.controls[name];
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength'))
      return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    if (control.hasError('email'))
      return 'Escribe un correo válido, por ejemplo nombre@dominio.com.';
    if (control.hasError('pattern'))
      return name === 'issuingCountry'
        ? 'Usa el código del país de dos letras.'
        : 'Ingresa únicamente números del 0 al 9, sin espacios ni símbolos.';
    if (control.hasError('future')) return 'La fecha de nacimiento no puede ser futura.';
    return 'Revisa el valor ingresado.';
  }
  async submit(): Promise<void> {
    if (this.store.creating() || this.store.created()) return;
    for (const name of [
      'firstNames',
      'lastNames',
      'phone',
      'email',
      'issuingCountry',
      'documentType',
      'documentNumber',
    ] as const) {
      const control = this.form.controls[name];
      let value = (control.value ?? '').trim();
      if (name === 'issuingCountry' || name === 'documentType' || name === 'documentNumber')
        value = value.toUpperCase();
      control.setValue(value, { emitEvent: false });
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const value = this.form.getRawValue();
    const request: CreatePersonRequest = {
      person: {
        firstNames: value.firstNames!,
        lastNames: value.lastNames!,
        phone: value.phone || null,
        email: value.email || null,
        birthDate: birthDateValue(value.birthDate),
      },
      branchId: value.branchId!,
      document: {
        issuingCountry: value.issuingCountry!,
        documentType: value.documentType!,
        documentNumber: value.documentNumber!,
      },
    };
    this.form.disable({ emitEvent: false });
    try {
      if (await this.store.create(request)) {
        this.form.reset();
        this.form.markAsPristine();
        this.notifications.success('Persona registrada correctamente.');
        this.savedChange.emit();
      }
    } finally {
      this.form.enable({ emitEvent: false });
    }
  }
  async cancel(): Promise<void> {
    if (await this.canLeave()) this.closed.emit();
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.auth.authenticated() || this.store.created()) return true;
    if (this.store.creating()) return false;
    if (!this.form.dirty) return true;
    if (this.leaving) return this.leaving;
    this.leaving = new Promise<boolean>((resolve) =>
      this.confirmation.confirm({
        header: '¿Descartar el registro?',
        message: 'Hay datos sin guardar. Si sales, se perderán.',
        acceptLabel: 'Descartar y salir',
        rejectLabel: 'Seguir registrando',
        closeOnEscape: false,
        accept: () => {
          this.leaving = undefined;
          this.form.markAsPristine();
          resolve(true);
        },
        reject: () => {
          this.leaving = undefined;
          resolve(false);
        },
      }),
    );
    return this.leaving;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.auth.authenticated() &&
      (this.form.dirty || this.store.creating()) &&
      !this.store.created()
    )
      event.preventDefault();
  }
}
