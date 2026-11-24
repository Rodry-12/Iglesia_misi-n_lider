import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LucidePencil } from '@lucide/angular';
import { AssignmentStore } from './assignment.store';
import { Assignment, AssignmentParticipant } from './assignment.models';
import { AccessContext } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { Notifications } from '../../core/notifications/notifications';
import { TablePagination } from '../../shared/ui/table-pagination';
import { AssignmentProgressEditor } from './assignment-progress-editor';

@Component({
  selector: 'app-participant-processes-dialog',
  imports: [DialogModule, ButtonModule, LucidePencil, TablePagination, AssignmentProgressEditor],
  providers: [AssignmentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participant-processes-dialog.html',
  styleUrls: ['./catalog.scss', './participant-processes.scss'],
})
export class ParticipantProcessesDialog {
  readonly person = input.required<AssignmentParticipant>();
  readonly editable = input(false);
  readonly closed = output<void>();
  readonly savedChange = output<void>();
  readonly store = inject(AssignmentStore);
  readonly access = inject(AccessContext);
  private readonly auth = inject(AuthStore);
  private readonly notifications = inject(Notifications);
  readonly editing = signal<string | null>(null);
  constructor() {
    const identity = JSON.stringify(this.auth.session());
    effect(() => {
      if (JSON.stringify(this.auth.session()) !== identity) untracked(() => this.closed.emit());
    });
    effect(() => {
      const person = this.person();
      untracked(() => this.store.loadPersonAssignments(person.personId));
    });
    effect(() => {
      const error = this.store.errors().list;
      if (error && !this.store.list())
        untracked(() => {
          this.notifications.error(error);
          this.closed.emit();
        });
    });
  }
  canEdit(item: Assignment): boolean {
    return (
      !['COMPLETED', 'WITHDRAWN'].includes(item.stateCode) &&
      (this.access.can('PROCESS_CHANGE_STATUS', item.branchId) ||
        this.access.can('PROCESS_CHANGE_RESPONSIBLE', item.branchId))
    );
  }
  saved(): void {
    this.editing.set(null);
    const list = this.store.list();
    this.store.loadPersonAssignments(
      this.person().personId,
      list?.pageNumber ?? 1,
      list?.pageSize ?? 10,
    );
    this.savedChange.emit();
  }
  page(page: number, pageSize: number): void {
    this.store.loadPersonAssignments(this.person().personId, page, pageSize);
  }
  date(value: string | null, empty: string): string {
    return value
      ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
      : empty;
  }
}
