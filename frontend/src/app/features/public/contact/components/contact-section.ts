import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CONTACT_GATEWAY } from '../data-access/contact-gateway';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { ToastFeedback } from '../../../../shared/ui/toast-feedback';

@Component({
  selector: 'app-contact-section',
  imports: [ReactiveFormsModule, InputTextModule, TextareaModule, ButtonModule, ToastFeedback],
  templateUrl: './contact-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactSection {
  private readonly gateway = inject(CONTACT_GATEWAY);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly status = signal<'idle' | 'invalid' | 'sending' | 'success' | 'error'>('idle');
  readonly form = inject(FormBuilder).nonNullable.group({
    user: [
      '',
      [Validators.required, Validators.maxLength(40), Validators.pattern(/^[\p{L}\p{M}\s'-]+$/u)],
    ],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(40)]],
    content: ['', [Validators.required, Validators.maxLength(300)]],
  });
  invalid(field: 'user' | 'email' | 'subject' | 'content'): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }
  async submit(): Promise<void> {
    if (this.status() === 'sending') return;
    const raw = this.form.getRawValue();
    const message = {
      user: raw.user.trim(),
      email: raw.email.trim(),
      subject: raw.subject.trim(),
      content: raw.content.trim(),
    };
    this.form.patchValue(message);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.status.set('invalid');
      const field = Object.keys(this.form.controls).find((key) => this.form.get(key)?.invalid);
      this.element.nativeElement
        .querySelector<HTMLElement>(`[formControlName="${field}"]`)
        ?.focus();
      return;
    }
    this.status.set('sending');
    this.form.disable({ emitEvent: false });
    try {
      await this.gateway.send(message);
      this.form.reset();
      this.status.set('success');
    } catch {
      this.status.set('error');
    } finally {
      this.form.enable({ emitEvent: false });
    }
  }
}
