import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Notifications } from './notifications';

describe('notificaciones globales', () => {
  it('comparte el bus PrimeNG y evita duplicados de distintos consumidores', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useExisting: Notifications }],
    });
    const service = TestBed.inject(Notifications),
      bus = TestBed.inject(MessageService),
      received: unknown[] = [];
    bus.messageObserver.subscribe((message) => received.push(message));
    service.success('Sede creada.');
    service.success('Sede creada.');
    expect(bus).toBe(service);
    expect(received).toHaveLength(1);
  });
  it('limita acumulación,expone las cuatro severidades ypermite cierre manual', () => {
    const service = TestBed.inject(Notifications),
      messages: any[] = [],
      clears = vi.fn();
    service.messageObserver.subscribe((message) => messages.push(message));
    service.clearObserver.subscribe(clears);
    service.success('Confirmada');
    service.info('Información');
    service.warn('Conflicto');
    service.error('Error');
    expect(messages.map((message) => message.severity)).toEqual([
      'success',
      'info',
      'warn',
      'error',
    ]);
    expect(clears).toHaveBeenCalledTimes(4);
    expect(messages.every((m) => m.closable && m.life >= 5000)).toBe(true);
  });
});
