import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PageHeading } from '../../shared/ui/page-heading';
import { AuthStore } from '../../core/auth/auth.store';
import { CHURCH_CONTENT } from '../../core/content/church-content';
import { ToastFeedback } from '../../shared/ui/toast-feedback';

@Component({
  selector: 'app-access-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PageHeading,
    ToastFeedback,
  ],
  templateUrl: './access-page.html',
  styleUrl: './access-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessPage {
  readonly auth = inject(AuthStore);
  readonly church = CHURCH_CONTENT;
  readonly showPassword = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  constructor() {
    effect(() => {
      if (this.auth.authenticated()) void this.router.navigateByUrl('/gestion');
    });
  }

  invalid(field: 'email' | 'password'): boolean {
    return this.form.controls[field].touched && this.form.controls[field].invalid;
  }

  async submit(): Promise<void> {
    if (this.auth.busy()) return;
    this.form.controls.email.setValue(this.form.controls.email.value.trim());
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const field = this.form.controls.email.invalid ? 'email' : 'password';
      this.element.nativeElement
        .querySelector<HTMLElement>(`[formControlName="${field}"]`)
        ?.focus();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.form.disable({ emitEvent: false });
    try {
      if (await this.auth.login(email, password)) this.form.controls.password.reset();
    } finally {
      this.form.enable({ emitEvent: false });
    }
  }
}
