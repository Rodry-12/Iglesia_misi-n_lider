import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideUsers,
  LucideBookOpen,
  LucideMapPin,
  LucideShieldCheck,
  LucideLayoutDashboard,
} from '@lucide/angular';

@Component({
  selector: 'app-management-icon',
  imports: [LucideUsers, LucideBookOpen, LucideMapPin, LucideShieldCheck, LucideLayoutDashboard],
  host: { 'aria-hidden': 'true', class: 'inline-flex shrink-0' },
  template: `
    @switch (path()) {
      @case ('/gestion/miembros') {
        <svg lucideUsers [size]="20"></svg>
      }
      @case ('/gestion/formacion') {
        <svg lucideBookOpen [size]="20"></svg>
      }
      @case ('/gestion/sedes') {
        <svg lucideMapPin [size]="20"></svg>
      }
      @case ('/gestion/usuarios') {
        <svg lucideShieldCheck [size]="20"></svg>
      }
      @default {
        <svg lucideLayoutDashboard [size]="20"></svg>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagementIcon {
  readonly path = input('/gestion');
}
