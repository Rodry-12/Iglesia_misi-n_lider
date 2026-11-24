import { Directive, HostListener, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserAccountEditor } from './user-account-editor';

@Directive()
export abstract class UserDialogBase {
  readonly editor = inject(UserAccountEditor);
  readonly closed = output<void>();
  readonly saved = output<string>();
  constructor() {
    this.editor.completed
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.saved.emit(this.editor.store.notice() ?? ''));
    this.editor.failed.pipe(takeUntilDestroyed()).subscribe(() => this.closed.emit());
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.editor.form.dirty || this.editor.store.busy()) event.preventDefault();
  }
  async close() {
    if (await this.editor.canLeave()) {
      this.editor.form.markAsPristine();
      this.closed.emit();
    }
  }
  canLeave() {
    return this.editor.canLeave();
  }
}
