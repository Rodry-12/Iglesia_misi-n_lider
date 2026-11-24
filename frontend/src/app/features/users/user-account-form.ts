import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { UserAccountEditor } from './user-account-editor';

@Component({
  selector: 'app-user-account-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    CheckboxModule,
    ToastFeedback,
  ],
  templateUrl: './user-account-form.html',
  styleUrls: ['../training/catalog.scss', './user-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAccountForm {
  readonly formId = input<string | null>(null);
  readonly showSubmit = input(true);
  readonly lookupOpen = signal(false);
  readonly editor = inject(UserAccountEditor);
  readonly form = this.editor.form;
  readonly store = this.editor.store;
  readonly editing = this.editor.editing;
  readonly confirming = this.editor.confirming;
  readonly selectedPerson = this.editor.selectedPerson;
  readonly document = this.editor.document;
  readonly permissionOptions = this.editor.permissionOptions;
  readonly permissionGroups = computed(() => {
    const modules: Record<string, string> = {
      PERSON: 'Personas',
      PROCESS: 'Procesos ministeriales',
      BRANCH: 'Sedes',
      CATEGORY: 'Categorías',
      REPORT: 'Reportes',
      USER: 'Usuarios',
    };
    const groups = new Map<string, ReturnType<typeof this.permissionOptions>>();
    for (const permission of this.permissionOptions()) {
      const label = modules[permission.code.split('_')[0]] ?? 'Otras acciones';
      const items = groups.get(label) ?? [];
      items.push(permission);
      groups.set(label, items);
    }
    return Array.from(groups, ([label, items]) => ({ label, items }));
  });
  readonly roleOptions = this.editor.roleOptions;
  globalOnly(code: string) {
    // Presentation only: these operations remain global in the existing API.
    return [
      'BRANCH_CREATE',
      'BRANCH_UPDATE',
      'CATEGORY_CREATE',
      'CATEGORY_UPDATE',
      'PROCESS_CREATE',
      'PROCESS_UPDATE',
      'PERSON_TRANSFER',
    ].includes(code);
  }
  get inviting() {
    return this.editor.inviting;
  }
  save() {
    return this.editor.save();
  }
  role(id: string) {
    return this.editor.role(id);
  }
  roleChanged(index: number) {
    this.editor.roleChanged(index);
  }
  findPerson(page = 1) {
    this.editor.findPerson(page);
  }
  choosePerson(id: string) {
    this.editor.choosePerson(id);
    this.lookupOpen.set(false);
  }
  toggleLookup() {
    this.lookupOpen.update((value) => !value);
    this.store.clearPeopleSearch();
  }
  searchOnEnter(event: Event) {
    event.preventDefault();
    this.findPerson();
  }
  unlink() {
    this.editor.unlink();
  }
  addGrant() {
    this.editor.addGrant();
  }
  removeGrant(index: number) {
    this.editor.removeGrant(index);
  }
  cancelEdit() {
    return this.editor.cancelEdit();
  }
}
