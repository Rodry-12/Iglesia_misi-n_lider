import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { AccessContext } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { CatalogStore } from './catalog.store';
import {
  CatalogItem,
  CatalogKind,
  CatalogRequest,
  MinistryProcess,
  catalogPermission,
  catalogSegment,
} from './catalog.models';
import { CatalogErrorMessage } from './catalog-actions';
import { DialogModule } from 'primeng/dialog';
import { Notifications } from '../../core/notifications/notifications';

@Component({
  selector: 'app-catalog-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    ToastFeedback,
    ConfirmDialogModule,
    CatalogErrorMessage,
    DialogModule,
  ],
  providers: [ConfirmationService, CatalogStore],
  templateUrl: './catalog-form-page.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFormPage {
  readonly store = inject(CatalogStore);
  readonly access = inject(AccessContext);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notifications = inject(Notifications);
  readonly visible = computed(
    () =>
      this.allowed() &&
      !this.savedId() &&
      (!this.id() || (!!this.original() && !this.store.detailLoading())) &&
      !this.store.optionsLoading(),
  );
  readonly kind = this.route.snapshot.data['kind'] as CatalogKind;
  readonly id = signal<string | null>(null);
  readonly original = signal<CatalogItem | null>(null);
  readonly savedId = signal<string | null>(null);
  readonly segment = catalogSegment(this.kind);
  readonly title = computed(
    () => `${this.id() ? 'Editar' : 'Crear'} ${this.kind === 'category' ? 'categoría' : 'proceso'}`,
  );
  readonly allowed = computed(() =>
    this.access.can(catalogPermission(this.kind, this.id() ? 'UPDATE' : 'CREATE'), null),
  );
  readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    description: ['', Validators.maxLength(4000)],
    sortOrder: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(2147483647),
        Validators.pattern(/^\d+$/),
      ],
    ],
    categoryId: [''],
  });
  private leaving?: Promise<boolean>;
  private finishLeaving?: (value: boolean) => void;
  constructor() {
    this.store.commandError.set(null);
    this.store.notice.set(null);
    if (this.kind === 'process') {
      this.form.controls.categoryId.setValidators([
        Validators.required,
        (control) =>
          this.store.options().some((c) => c.id === control.value) ? null : { category: true },
      ]);
      void this.store.loadOptions();
      effect(() => {
        this.store.options();
        untracked(() => this.form.controls.categoryId.updateValueAndValidity());
      });
    }
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      this.id.set(params.get('id'));
      this.original.set(null);
      this.savedId.set(null);
      if (this.id()) this.store.loadDetail(this.kind, this.id()!);
    });
    effect(() => {
      const item = this.store.item();
      if (item && item.id === this.id())
        untracked(() => {
          this.original.set(item);
          this.form.reset({
            name: item.name,
            description: item.description ?? '',
            sortOrder: item.sortOrder,
            categoryId: this.kind === 'process' ? (item as MinistryProcess).categoryId : '',
          });
        });
    });
    let identity = JSON.stringify(this.auth.session());
    effect(() => {
      const next = JSON.stringify(this.auth.session());
      if (next !== identity) {
        identity = next;
        untracked(() => {
          this.form.reset();
          this.original.set(null);
          this.savedId.set(null);
          this.confirmation.close();
          this.finishLeaving?.(true);
          this.finishLeaving = undefined;
          this.leaving = undefined;
        });
      }
    });
  }
  invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }
  changed(): boolean {
    const value = this.request();
    const original = this.original();
    return original
      ? value.name !== original.name ||
          value.description !== (original.description || null) ||
          value.sortOrder !== original.sortOrder ||
          (this.kind === 'process' && value.categoryId !== (original as MinistryProcess).categoryId)
      : this.form.dirty;
  }
  private request(): CatalogRequest {
    const value = this.form.getRawValue();
    return {
      name: (value.name ?? '').trim(),
      description: value.description?.trim() || null,
      sortOrder: Number(value.sortOrder),
      ...(this.kind === 'process' ? { categoryId: value.categoryId! } : {}),
    };
  }
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      !this.allowed() ||
      !this.changed() ||
      this.savedId() ||
      this.store.busy() ||
      this.store.optionsLoading() ||
      (this.kind === 'process' && this.store.optionsError())
    )
      return;
    this.form.disable({ emitEvent: false });
    try {
      const saved = await this.store.save(this.kind, this.id(), this.request());
      if (saved) {
        this.savedId.set(saved.id);
        this.form.markAsPristine();
        this.notifications.success('Cambios guardados.');
        this.cancel();
      }
    } finally {
      this.form.enable({ emitEvent: false });
    }
  }
  cancel(): void {
    void this.router.navigate(['/gestion/formacion', this.segment], {
      queryParams: this.route.snapshot.queryParams,
      state: { catalogUnchangedReturn: this.savedId() ? undefined : this.kind },
    });
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.auth.authenticated() || this.savedId()) return true;
    if (this.store.busy()) return false;
    if (!this.changed()) return true;
    if (this.leaving) return this.leaving;
    this.leaving = new Promise((resolve) => {
      this.finishLeaving = resolve;
      this.confirmation.confirm({
        header: '¿Descartar los cambios?',
        message: 'Hay cambios sin guardar. Si sales, se perderán.',
        acceptLabel: 'Descartar y salir',
        rejectLabel: 'Seguir editando',
        closeOnEscape: false,
        accept: () => {
          this.form.markAsPristine();
          this.leaving = undefined;
          this.finishLeaving = undefined;
          resolve(true);
        },
        reject: () => {
          this.leaving = undefined;
          this.finishLeaving = undefined;
          resolve(false);
        },
      });
    });
    return this.leaving;
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (this.auth.authenticated() && !this.savedId() && (this.changed() || this.store.busy()))
      event.preventDefault();
  }
}
