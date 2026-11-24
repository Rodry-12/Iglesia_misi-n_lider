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
  input,
  output,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { PageHeading } from '../../shared/ui/page-heading';
import { AuthStore } from '../../core/auth/auth.store';
import { AccessContext } from '../../core/auth/access-context';
import { AssignmentStore } from './assignment.store';
import { AssignmentPerson } from './assignment.models';
import { TablePagination } from '../../shared/ui/table-pagination';
import { PaginatorState } from 'primeng/paginator';
import { LucideSearch, LucideX } from '@lucide/angular';
import { DialogModule } from 'primeng/dialog';
import { NgTemplateOutlet } from '@angular/common';
import { Person } from '../members/members.models';
import { Notifications } from '../../core/notifications/notifications';
@Component({
  selector: 'app-assignment-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToastFeedback,
    ConfirmDialogModule,
    PageHeading,
    TablePagination,
    LucideSearch,
    LucideX,
    DialogModule,
    NgTemplateOutlet,
  ],
  providers: [ConfirmationService],
  templateUrl: './assignment-page.html',
  styleUrls: ['./catalog.scss', './assignment-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentPage {
  readonly member = input<Person | null>(null);
  readonly closed = output<void>();
  readonly savedChange = output<void>();
  private readonly notifications = inject(Notifications);
  readonly store = inject(AssignmentStore);
  readonly access = inject(AccessContext);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  readonly id = this.route.snapshot.pathFromRoot?.some((r) => r.routeConfig?.path === 'miembros')
    ? null
    : this.route.snapshot.paramMap.get('id');
  readonly participant = signal<AssignmentPerson | null>(null);
  readonly responsible = signal<AssignmentPerson | null>(null);
  readonly categoryId = signal('');
  private readonly pageSizes = { participant: 10, responsible: 10 };
  readonly processes = computed(
    () => this.store.options()?.processes.filter((p) => p.categoryId === this.categoryId()) ?? [],
  );
  readonly form = inject(FormBuilder).nonNullable.group({
    personId: ['', Validators.required],
    categoryId: ['', Validators.required],
    processId: ['', Validators.required],
    responsiblePersonId: ['', Validators.required],
  });
  readonly searches = inject(FormBuilder).nonNullable.group({
    participant: [''],
    responsible: [''],
  });
  readonly stateForm = inject(FormBuilder).nonNullable.group({
    stateCode: ['', Validators.required],
  });
  readonly confirmingState = signal(false);
  readonly replacement = signal<AssignmentPerson | null>(null);
  readonly replacementSearch = inject(FormBuilder).nonNullable.control('');
  readonly replacementId = inject(FormBuilder).nonNullable.control('', Validators.required);
  readonly confirmingResponsible = signal(false);
  readonly canChangeResponsible = computed(() => {
    const assignment = this.store.detail();
    return !!assignment && this.access.can('PROCESS_CHANGE_RESPONSIBLE', assignment.branchId);
  });
  private finishResponsibleConfirmation?: (accepted: boolean) => void;
  readonly canChangeState = computed(() => {
    const assignment = this.store.detail();
    return !!assignment && this.access.can('PROCESS_CHANGE_STATUS', assignment.branchId);
  });
  private finishStateConfirmation?: (accepted: boolean) => void;
  private leaving?: Promise<boolean>;
  private finishLeaving?: (value: boolean) => void;
  constructor() {
    this.store.clear();
    if (this.id) this.store.loadDetail(this.id);
    else {
      this.store.loadOptions();
      effect(() => {
        const member = this.member();
        untracked(() => {
          if (!member) {
            this.search('participant');
            return;
          }
          const document = member.documents.find((d) => d.isCurrent && !d.endedAt);
          if (
            !member.isActive ||
            !member.branchId ||
            !document ||
            !this.access.can('PROCESS_ASSIGN', member.branchId)
          ) {
            this.notifications.warn(
              'La persona debe estar activa, tener documento vigente y una sede autorizada para asignar procesos.',
            );
            this.closed.emit();
            return;
          }
          this.form.controls.personId.setValue(member.id, { emitEvent: false });
          this.participant.set({
            id: member.id,
            name: `${member.firstNames} ${member.lastNames}`,
            branchId: member.branchId,
            branchName: member.branchName ?? 'Sede vigente',
            documentType: document.documentType,
            documentNumber: document.documentNumber,
          });
          this.search('responsible');
        });
      });
    }
    effect(() => {
      const assignment = this.store.detail();
      const allowed = this.canChangeResponsible();
      if (assignment && allowed)
        untracked(() => {
          this.resetReplacement();
          this.store.resetResponsible();
          this.searchReplacement();
        });
    });
    this.replacementSearch.valueChanges
      .pipe(debounceTime(2000), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.searchReplacement());
    this.replacementId.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((id) => {
      this.replacement.set(this.store.responsible()?.items.find((p) => p.id === id) ?? null);
    });
    effect(() => {
      const assignment = this.store.detail();
      const allowed = this.canChangeState();
      if (assignment)
        untracked(() => {
          this.stateForm.reset();
          if (allowed) this.store.loadTransitions(assignment.id);
          else this.store.resetTransitions();
        });
    });
    this.destroy.onDestroy(() => {
      this.finishResponsibleConfirmation?.(false);
      this.finishStateConfirmation?.(false);
      this.confirmation.close();
      if (this.member()) this.store.clear();
    });
    for (const channel of ['participant', 'responsible'] as const)
      this.searches.controls[channel].valueChanges
        .pipe(debounceTime(2000), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
        .subscribe(() => this.search(channel));
    this.form.controls.categoryId.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((id) => {
        this.categoryId.set(id);
        this.form.controls.processId.setValue('');
      });
    this.form.controls.personId.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((id) => {
        const person = this.store.participant()?.items.find((p) => p.id === id) ?? null;
        this.participant.set(person);
        this.responsible.set(null);
        this.form.controls.responsiblePersonId.setValue('');
        this.searches.controls.responsible.reset('', { emitEvent: false });
        this.store.resetResponsible();
        this.pageSizes.responsible = 10;
        if (person) this.search('responsible');
      });
    this.form.controls.responsiblePersonId.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((id) =>
        this.responsible.set(this.store.responsible()?.items.find((p) => p.id === id) ?? null),
      );
    let identity = JSON.stringify(this.auth.session());
    effect(() => {
      const next = JSON.stringify(this.auth.session());
      if (next !== identity) {
        identity = next;
        untracked(() => {
          this.form.reset(undefined, { emitEvent: false });
          this.searches.reset(undefined, { emitEvent: false });
          this.participant.set(null);
          this.responsible.set(null);
          this.categoryId.set('');
          this.stateForm.reset(undefined, { emitEvent: false });
          this.resetReplacement();
          this.finishResponsibleConfirmation?.(false);
          this.finishResponsibleConfirmation = undefined;
          this.confirmingResponsible.set(false);
          this.finishStateConfirmation?.(false);
          this.finishStateConfirmation = undefined;
          this.confirmingState.set(false);
          this.confirmation.close();
          this.finishLeaving?.(true);
          this.finishLeaving = undefined;
          this.leaving = undefined;
          if (this.member()) this.closed.emit();
        });
      }
    });
  }
  resetReplacement(): void {
    this.replacement.set(null);
    this.replacementId.reset('', { emitEvent: false });
    this.replacementSearch.reset('', { emitEvent: false });
  }
  async refreshDetail(): Promise<void> {
    if (this.id && (await this.canLeave())) {
      this.resetReplacement();
      this.store.loadDetail(this.id);
    }
  }
  searchReplacement(page = 1): void {
    const assignment = this.store.detail();
    if (assignment && this.canChangeResponsible() && !this.store.busy())
      this.store.searchReplacement(assignment.id, this.replacementSearch.value, page);
  }
  async changeResponsible(): Promise<void> {
    const assignment = this.store.detail();
    const candidate = this.replacement();
    if (
      !assignment ||
      !candidate ||
      !this.canChangeResponsible() ||
      this.store.busy() ||
      this.confirmingResponsible() ||
      this.confirmingState() ||
      candidate.branchId !== assignment.branchId ||
      candidate.id === assignment.personId ||
      candidate.id === assignment.responsiblePersonId
    )
      return;
    this.confirmingResponsible.set(true);
    const accepted = await new Promise<boolean>((resolve) => {
      this.finishResponsibleConfirmation = resolve;
      this.confirmation.confirm({
        header: '¿Cambiar el responsable?',
        message: `Se sustituirá a «${assignment.responsibleName ?? 'Responsable actual'}» por «${candidate.name}».`,
        acceptLabel: 'Confirmar responsable',
        rejectLabel: 'Cancelar cambio',
        closeOnEscape: false,
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
    this.finishResponsibleConfirmation = undefined;
    this.confirmingResponsible.set(false);
    if (
      !accepted ||
      !this.auth.authenticated() ||
      !this.canChangeResponsible() ||
      this.store.detail() !== assignment
    )
      return;
    if (
      await this.store.changeResponsible(
        assignment.id,
        candidate.id,
        assignment.responsiblePersonId,
      )
    )
      this.resetReplacement();
  }
  async changeState(): Promise<void> {
    this.stateForm.markAllAsTouched();
    const assignment = this.store.detail();
    const target = this.store
      .transitions()
      ?.find((s) => s.code === this.stateForm.controls.stateCode.value);
    if (
      !assignment ||
      !target ||
      !this.canChangeState() ||
      this.store.busy() ||
      this.confirmingState() ||
      this.confirmingResponsible() ||
      !!this.replacement()
    )
      return;
    this.confirmingState.set(true);
    const accepted = await new Promise<boolean>((resolve) => {
      this.finishStateConfirmation = resolve;
      this.confirmation.confirm({
        header: target.isFinal ? '¿Finalizar el proceso ministerial?' : '¿Cambiar el estado?',
        message: target.isFinal
          ? `La asignación pasará a «${target.name}» y se registrará su finalización. Esta operación no permite reabrirla.`
          : `La asignación pasará de «${assignment.stateName ?? assignment.stateCode}» a «${target.name}».`,
        acceptLabel: target.isFinal ? 'Confirmar finalización' : 'Confirmar cambio',
        rejectLabel: 'Cancelar cambio',
        closeOnEscape: false,
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
    this.finishStateConfirmation = undefined;
    this.confirmingState.set(false);
    if (
      !accepted ||
      !this.auth.authenticated() ||
      !this.canChangeState() ||
      this.store.detail() !== assignment
    )
      return;
    this.stateForm.disable({ emitEvent: false });
    try {
      if (await this.store.changeState(assignment.id, target.code)) this.stateForm.reset();
    } finally {
      this.stateForm.enable({ emitEvent: false });
    }
  }
  search(channel: 'participant' | 'responsible', page = 1): void {
    const person = this.participant();
    if (channel === 'responsible' && !person) return;
    this.store.search(
      channel,
      this.searches.controls[channel].value,
      page,
      channel === 'responsible' ? person!.branchId : undefined,
      channel === 'responsible' ? person!.id : undefined,
      this.pageSizes[channel],
    );
  }
  peoplePageChanged(channel: 'participant' | 'responsible', event: PaginatorState): void {
    this.pageSizes[channel] = event.rows ?? this.pageSizes[channel];
    this.search(channel, Math.floor((event.first ?? 0) / this.pageSizes[channel]) + 1);
  }
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const person = this.participant();
    const responsible = this.responsible();
    const value = this.form.getRawValue();
    if (
      this.form.invalid ||
      this.store.busy() ||
      this.store.saved() ||
      !person ||
      !responsible ||
      !this.access.can('PROCESS_ASSIGN', person.branchId) ||
      responsible.id === person.id ||
      responsible.branchId !== person.branchId ||
      !this.processes().some((p) => p.id === value.processId)
    )
      return;
    this.form.disable({ emitEvent: false });
    try {
      const saved = await this.store.save({
        personId: person.id,
        processId: value.processId,
        responsiblePersonId: responsible.id,
        branchId: person.branchId,
      });
      if (saved) {
        this.form.markAsPristine();
        if (this.member()) {
          this.notifications.success('Asignación guardada correctamente.');
          this.savedChange.emit();
        }
      }
    } finally {
      this.form.enable({ emitEvent: false });
    }
  }
  date(value: string): string {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
  async cancel(): Promise<void> {
    if (this.member()) {
      if (await this.canLeave()) this.closed.emit();
      return;
    }
    void this.router.navigate(['/gestion/formacion'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.auth.authenticated()) return true;
    // An authorization failure must reach the existing forbidden page even with a draft.
    if (this.router.currentNavigation()?.extractedUrl.toString() === '/sin-acceso') return true;
    if (this.store.busy()) return false;
    if (this.confirmingResponsible() || this.confirmingState()) return false;
    if (this.store.saved()) return true;
    if (this.id ? !this.replacement() : !this.form.dirty) return true;
    if (this.leaving) return this.leaving;
    this.leaving = new Promise((resolve) => {
      this.finishLeaving = resolve;
      const finish = (value: boolean) => {
        this.leaving = undefined;
        this.finishLeaving = undefined;
        resolve(value);
      };
      this.confirmation.confirm({
        header: this.id ? '¿Descartar el cambio de responsable?' : '¿Descartar la asignación?',
        message: 'Hay cambios sin guardar.',
        acceptLabel: 'Descartar y salir',
        rejectLabel: 'Seguir editando',
        closeOnEscape: false,
        accept: () => finish(true),
        reject: () => finish(false),
      });
    });
    return this.leaving;
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.auth.authenticated() &&
      !this.store.saved() &&
      (this.form.dirty || !!this.replacement() || this.store.busy())
    )
      event.preventDefault();
  }
}
