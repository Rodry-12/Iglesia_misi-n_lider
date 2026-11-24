import { TestBed } from '@angular/core/testing';
import { Notifications } from '../../core/notifications/notifications';
import { ToastFeedback } from './toast-feedback';

describe('avisos declarativos en el Toast global', () => {
  it('emite al cambiar el mensaje sin insertar banners ni repetirlo al renderizar', () => {
    const service = TestBed.inject(Notifications);
    const messages: any[] = [];
    service.messageObserver.subscribe((value) => messages.push(value));
    const fixture = TestBed.createComponent(ToastFeedback);
    fixture.componentRef.setInput('severity', 'warn');
    fixture.componentRef.setInput('message', ' No tienes\n autorización. ');
    fixture.detectChanges();
    fixture.detectChanges();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ severity: 'warn', detail: 'No tienes autorización.' });
    expect(fixture.nativeElement.textContent).toBe('');
    expect(fixture.nativeElement.querySelector('[role=alert],p-message')).toBeNull();
    fixture.componentRef.setInput('message', 'Operación confirmada.');
    fixture.componentRef.setInput('severity', 'success');
    fixture.detectChanges();
    expect(messages).toHaveLength(2);
    expect(messages[1].severity).toBe('success');
  });

  it('comparte deduplicación con los stores sin volver a notificar un error idéntico', () => {
    const service = TestBed.inject(Notifications);
    const messages: unknown[] = [];
    service.messageObserver.subscribe((value) => messages.push(value));
    service.warn('No disponible.');
    const fixture = TestBed.createComponent(ToastFeedback);
    fixture.componentRef.setInput('message', ' No\n disponible. ');
    fixture.detectChanges();
    expect(messages).toHaveLength(1);
  });
});
