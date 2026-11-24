import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

export function createBranchForm() {
  return inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/\S/)]],
    name: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    address: ['', Validators.maxLength(250)],
    phone: ['', Validators.maxLength(30)],
  });
}
export type BranchForm = ReturnType<typeof createBranchForm>;

@Component({
  selector: 'app-branch-form-fields',
  imports: [ReactiveFormsModule, InputTextModule],
  template: `
    <div class="branch-fields" [formGroup]="form()">
      @for (field of fields; track field.key) {
        <div class="branch-field" [class.wide]="field.key === 'address' || field.key === 'name'">
          <label [for]="'branch-' + field.key"
            >{{ field.label }}{{ field.required ? ' *' : '' }}</label
          >
          <input
            pInputText
            [id]="'branch-' + field.key"
            [formControlName]="field.key"
            [type]="field.key === 'phone' ? 'tel' : 'text'"
            [maxlength]="field.max"
            [readonly]="busy()"
            [invalid]="invalid(field.key)"
            [attr.aria-invalid]="invalid(field.key)"
            [attr.aria-describedby]="invalid(field.key) ? 'branch-' + field.key + '-error' : null"
          />
          @if (invalid(field.key)) {
            <small [id]="'branch-' + field.key + '-error'" role="alert">
              {{ field.required ? 'Escribe ' + field.label.toLowerCase() + '. ' : '' }}Máximo
              {{ field.max }} caracteres.
            </small>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './branch-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchFormFields {
  readonly form = input.required<BranchForm>();
  readonly busy = input(false);
  readonly fields = [
    { key: 'code', label: 'Código', max: 20, required: true },
    { key: 'name', label: 'Nombre', max: 150, required: true },
    { key: 'address', label: 'Dirección', max: 250, required: false },
    { key: 'phone', label: 'Teléfono', max: 30, required: false },
  ] as const;
  invalid(key: keyof BranchForm['controls']) {
    const control = this.form().controls[key];
    return control.touched && control.invalid;
  }
}
