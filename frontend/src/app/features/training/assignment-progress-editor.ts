import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { AssignmentStore } from './assignment.store';
import { AccessContext } from '../../core/auth/access-context';
import { Notifications } from '../../core/notifications/notifications';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { TablePagination } from '../../shared/ui/table-pagination';
import { PaginatorState } from 'primeng/paginator';
import { LucideSearch, LucideX } from '@lucide/angular';

/** Edits one assignment using the existing commands and server-provided transitions. */
@Component({
  selector: 'app-assignment-progress-editor',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    SelectModule,
    InputTextModule,
    ConfirmDialogModule,
    ToastFeedback,
    TablePagination,
    LucideSearch,
    LucideX,
  ],
  providers: [AssignmentStore, ConfirmationService],
  templateUrl: './assignment-progress-editor.html',
  styleUrls: [
    './catalog.scss',
    './participant-processes.scss',
    './assignment-progress-editor.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentProgressEditor {
  readonly assignmentId = input.required<string>();
  readonly closed = output<void>();
  readonly savedChange = output<void>();
  readonly store = inject(AssignmentStore);
  readonly access = inject(AccessContext);
  private readonly notifications = inject(Notifications);
  private readonly confirmation = inject(ConfirmationService);
  readonly mode = signal<'state' | 'responsible'>('state');
  readonly state = new FormControl('', { nonNullable: true });
  readonly responsible = new FormControl('', { nonNullable: true });
  readonly search = new FormControl('', { nonNullable: true });
  readonly confirming = signal(false);
  private readonly responsibleSearch = viewChild<ElementRef<HTMLInputElement>>('responsibleSearch');
  focusResponsibleSearch(): void {
    this.responsibleSearch()?.nativeElement.focus();
  }
  private responsiblePageSize = 10;
  private finishConfirmation?: (accepted: boolean) => void;
  readonly canState = computed(() => {
    const item = this.store.detail();
    return !!item && this.access.can('PROCESS_CHANGE_STATUS', item.branchId);
  });
  readonly canResponsible = computed(() => {
    const item = this.store.detail();
    return (
      !!item &&
      !['COMPLETED', 'WITHDRAWN'].includes(item.stateCode) &&
      this.access.can('PROCESS_CHANGE_RESPONSIBLE', item.branchId)
    );
  });
  selectedState() {
    return this.store.transitions()?.find((s) => s.code === this.state.value);
  }
  selectedResponsible() {
    return this.store.responsible()?.items.find((p) => p.id === this.responsible.value);
  }
  setMode(mode: 'state' | 'responsible'): void {
    if (!this.store.busy() && !this.confirming()) this.mode.set(mode);
  }
  constructor() {
    effect(() => {
      const id = this.assignmentId();
      untracked(() => this.store.loadDetail(id));
    });
    effect(() => {
      const item = this.store.detail();
      const canState = this.canState();
      const canResponsible = this.canResponsible();
      if (!item) return;
      untracked(() => {
        this.state.reset('');
        this.responsible.reset('');
        if (canState) this.store.loadTransitions(item.id);
        this.mode.set(canState ? 'state' : 'responsible');
      });
    });
    // The responsible directory is needed only when the user chooses that operation.
    effect(() => {
      const item = this.store.detail();
      const mode = this.mode();
      const allowed = this.canResponsible();
      const loaded = this.store.responsible();
      const loading = this.store.loading().responsible;
      const error = this.store.errors().responsible;
      if (item && mode === 'responsible' && allowed && !loaded && !loading && !error)
        untracked(() => this.searchResponsible());
    });
    this.search.valueChanges
      .pipe(debounceTime(2000), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.searchResponsible());
    inject(DestroyRef).onDestroy(() => {
      this.finishConfirmation?.(false);
      this.confirmation.close();
    });
  }
  searchResponsible(page = 1): void {
    const item = this.store.detail();
    if (item && this.canResponsible() && !this.store.busy()) {
      this.responsible.reset('');
      this.store.searchReplacement(item.id, this.search.value, page, this.responsiblePageSize);
    }
  }
  responsiblePage(event: PaginatorState): void {
    this.responsiblePageSize = event.rows ?? 10;
    this.searchResponsible(Math.floor((event.first ?? 0) / this.responsiblePageSize) + 1);
  }
  canSave(): boolean {
    if (this.store.busy() || this.confirming()) return false;
    if (this.mode() === 'state')
      return (
        this.canState() &&
        !this.store.loading().transitions &&
        this.state.value !== this.store.detail()?.stateCode &&
        !!this.selectedState()
      );
    const item = this.store.detail();
    return (
      !!item &&
      this.canResponsible() &&
      !this.store.loading().responsible &&
      !!this.store
        .responsible()
        ?.items.some(
          (p) =>
            p.id === this.responsible.value &&
            p.branchId === item.branchId &&
            p.id !== item.personId &&
            p.id !== item.responsiblePersonId,
        )
    );
  }
  async save(): Promise<void> {
    const item = this.store.detail();
    const mode = this.mode();
    if (!item || !this.canSave()) return;
    const state = this.store.transitions()?.find((s) => s.code === this.state.value);
    const responsible = this.store
      .responsible()
      ?.items.find((p) => p.id === this.responsible.value);
    this.confirming.set(true);
    const accepted = await new Promise<boolean>((resolve) => {
      this.finishConfirmation = resolve;
      this.confirmation.confirm({
        header:
          mode === 'state'
            ? state?.isFinal
              ? '¿Finalizar el proceso ministerial?'
              : '¿Cambiar el estado?'
            : '¿Cambiar el responsable?',
        message:
          mode === 'state'
            ? `El proceso «${item.processName}» pasará a «${state?.name}».${state?.isFinal ? ' Se registrará su finalización y no podrá reabrirse.' : ''}`
            : `Se sustituirá al responsable actual por «${responsible?.name}».`,
        acceptLabel: 'Confirmar cambio',
        rejectLabel: 'Cancelar cambio',
        closeOnEscape: false,
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
    this.finishConfirmation = undefined;
    this.confirming.set(false);
    if (!accepted || this.store.detail() !== item || this.mode() !== mode || !this.canSave())
      return;
    const result =
      mode === 'state'
        ? await this.store.changeState(item.id, state!.code)
        : await this.store.changeResponsible(item.id, responsible!.id, item.responsiblePersonId);
    if (result) {
      this.notifications.success(
        mode === 'state'
          ? 'Estado actualizado correctamente.'
          : 'Responsable actualizado correctamente.',
      );
      this.savedChange.emit();
    }
  }
  close(): void {
    if (this.store.busy() || this.confirming()) return;
    if (!this.state.value && !this.responsible.value) {
      this.closed.emit();
      return;
    }
    this.confirming.set(true);
    this.confirmation.confirm({
      header: '¿Descartar los cambios?',
      message: 'Hay una selección sin guardar.',
      acceptLabel: 'Descartar y volver',
      rejectLabel: 'Seguir editando',
      closeOnEscape: false,
      accept: () => {
        this.confirming.set(false);
        this.closed.emit();
      },
      reject: () => this.confirming.set(false),
    });
  }
}
