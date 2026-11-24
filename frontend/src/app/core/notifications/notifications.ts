import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

/** One application-wide PrimeNG bus. Messages must contain presentation text only. */
@Injectable({ providedIn: 'root' })
export class Notifications extends MessageService {
  private last = '';
  private lastAt = 0;
  success(detail: string) {
    this.show('success', 'Operación completada', detail);
  }
  info(detail: string) {
    this.show('info', 'Información', detail);
  }
  warn(detail: string) {
    this.show('warn', 'Revisa la operación', detail);
  }
  error(detail: string) {
    this.show('error', 'No se pudo completar', detail);
  }
  private show(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string) {
    detail = detail.replace(/\s+/g, ' ').trim();
    const signature = detail;
    if (!detail || (signature === this.last && Date.now() - this.lastAt < 1500)) return;
    this.last = signature;
    this.lastAt = Date.now();
    // At most one notification, including bursts from concurrent requests.
    this.clear();
    this.add({
      severity,
      summary,
      detail,
      life: severity === 'error' ? 7000 : 5000,
      closable: true,
    });
  }
}
