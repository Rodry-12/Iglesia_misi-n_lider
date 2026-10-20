import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

export interface SiteDraft {
  readonly name: string;
  readonly city: string;
}

@Component({
  selector: 'app-site-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="validate()" class="grid gap-4" novalidate>
      <div class="grid gap-2">
        <label for="site-name">Nombre de la sede</label>
        <input
          pInputText
          id="site-name"
          formControlName="name"
          autocomplete="off"
          maxlength="80"
          [invalid]="form.controls.name.touched && form.controls.name.invalid"
          aria-describedby="site-name-error"
        />
        @if (form.controls.name.touched && form.controls.name.invalid) {
          <p id="site-name-error" class="field-error">Escribe un nombre de hasta 80 caracteres.</p>
        }
      </div>
      <div class="grid gap-2">
        <label for="site-city">Municipio</label>
        <input
          pInputText
          id="site-city"
          formControlName="city"
          autocomplete="address-level2"
          maxlength="80"
          [invalid]="form.controls.city.touched && form.controls.city.invalid"
          aria-describedby="site-city-error"
        />
        @if (form.controls.city.touched && form.controls.city.invalid) {
          <p id="site-city-error" class="field-error">Escribe el municipio, hasta 80 caracteres.</p>
        }
      </div>
      <div class="flex flex-wrap gap-3">
        <button pButton type="submit">Validar vista previa</button>
        <button pButton [text]="true" type="button" (click)="reset()">Limpiar</button>
      </div>
    </form>
  `,
  styles: '.field-error { color: var(--ml-color-danger); font-size: 0.875rem; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteForm {
  readonly validated = output<SiteDraft>();
  readonly cleared = output<void>();
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80), Validators.pattern(/\S/)]],
    city: ['', [Validators.required, Validators.maxLength(80), Validators.pattern(/\S/)]],
  });

  validate(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.validated.emit({ name: value.name.trim(), city: value.city.trim() });
  }

  reset(): void {
    this.form.reset();
    this.cleared.emit();
  }
}
