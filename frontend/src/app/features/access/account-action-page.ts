import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { PageHeading } from '../../shared/ui/page-heading';
import { AccountActionStore } from './account-action.store';
@Component({
  selector: 'app-account-action-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    ToastFeedback,
    PageHeading,
  ],
  providers: [AccountActionStore],
  styleUrl: '../training/catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-heading [title]="title" description="Acceso seguro a Misión Líder París." />
    @if (store.done()) {
      <app-toast-feedback
        severity="success"
        [message]="
          operation === 'forgot-password' || operation === 'resend-confirmation'
            ? 'Si la cuenta cumple los requisitos, recibirá instrucciones. Esta respuesta no garantiza entrega del correo.'
            : 'Operación completada. Ya puedes intentar iniciar sesión.'
        "
      />
    } @else {
      <form class="catalog-panel" [formGroup]="form" (ngSubmit)="submit()">
        @if (operation === 'forgot-password' || operation === 'resend-confirmation') {
          <label for="action-email">Correo electrónico *</label
          ><input
            pInputText
            id="action-email"
            type="email"
            formControlName="email"
            autocomplete="email"
            [readonly]="store.busy()"
          />
        } @else if (!token) {
          <app-toast-feedback
            severity="error"
            [message]="'Abre el enlace completo recibido por correo. No contiene una invitación o token válido.'"
          />
        }
        @if (passwordOperation) {
          <label for="new-password">Nueva contraseña *</label
          ><input
            pInputText
            id="new-password"
            type="password"
            formControlName="password"
            autocomplete="new-password"
            maxlength="128"
            [readonly]="store.busy()"
          />
          <label for="confirm-password">Confirmar nueva contraseña *</label
          ><input
            pInputText
            id="confirm-password"
            type="password"
            formControlName="confirmation"
            autocomplete="new-password"
            maxlength="128"
            [readonly]="store.busy()"
          />
          <p>
            Utiliza al menos 12 caracteres con mayúscula, minúscula, número y símbolo. El servidor
            aplica la política configurada.
          </p>
        }
        @if (
          form.touched &&
          (form.invalid ||
            (passwordOperation &&
              form.controls.password.value !== form.controls.confirmation.value))
        ) {
          <app-toast-feedback
            severity="error"
            [message]="'Revisa los datos obligatorios y confirma que las contraseñas coincidan.'"
          />
        }
        @if (store.error(); as error) {
          <app-toast-feedback severity="error" [message]="error" />
        }
        <button
          pButton
          type="submit"
          [loading]="store.busy()"
          [disabled]="
            store.busy() ||
            (!token && operation !== 'forgot-password' && operation !== 'resend-confirmation')
          "
        >
          {{ title }}
        </button>
      </form>
    }
    <a pButton [outlined]="true" routerLink="/acceso">Ir al acceso</a>
  `,
})
export class AccountActionPage {
  readonly store = inject(AccountActionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly operation = this.route.snapshot.data['operation'] as
    | 'activate-invitation'
    | 'forgot-password'
    | 'reset-password'
    | 'confirm-email'
    | 'resend-confirmation';
  readonly title =
    this.operation === 'activate-invitation'
      ? 'Activar cuenta'
      : this.operation === 'forgot-password'
        ? 'Recuperar acceso'
        : this.operation === 'reset-password'
          ? 'Restablecer contraseña'
          : this.operation === 'resend-confirmation'
            ? 'Solicitar confirmación'
            : 'Confirmar correo';
  readonly passwordOperation =
    this.operation === 'activate-invitation' || this.operation === 'reset-password';
  readonly token: string;
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    confirmation: [''],
  });
  constructor() {
    const params = new URLSearchParams(this.route.snapshot.fragment ?? '');
    this.token = params.get('token') ?? this.route.snapshot.queryParamMap.get('token') ?? '';
    this.form.controls.email.setValue(
      params.get('email') ?? this.route.snapshot.queryParamMap.get('email') ?? '',
    );
    if (this.passwordOperation) {
      this.form.controls.password.setValidators([
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
      ]);
      this.form.controls.confirmation.setValidators([Validators.required]);
    }
    if (this.route.snapshot.fragment || this.route.snapshot.queryParamMap.has('token'))
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        fragment: undefined,
        replaceUrl: true,
      });
  }
  async submit() {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || (this.passwordOperation && value.password !== value.confirmation))
      return;
    const body = this.passwordOperation
      ? { email: value.email, token: this.token, newPassword: value.password }
      : this.operation === 'confirm-email'
        ? { email: value.email, token: this.token }
        : { email: value.email };
    await this.store.submit(this.operation, body);
    if (this.store.done()) {
      this.form.controls.password.reset();
      this.form.controls.confirmation.reset();
    }
  }
}
