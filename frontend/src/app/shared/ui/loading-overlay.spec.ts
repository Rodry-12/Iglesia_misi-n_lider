import { TestBed } from '@angular/core/testing';
import { LoadingOverlay } from './loading-overlay';
import { HttpActivity } from '../../core/loading/http-activity';

describe('presentación de carga compartida', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('no muestra solicitudes rápidas ni aparece después de terminar', async () => {
    const fixture = TestBed.createComponent(LoadingOverlay);
    const finish = TestBed.inject(HttpActivity).beginRequest();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(100);
    finish();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]')).toBeNull();
  });

  it('no deja un timer pendiente tras destruir la vista', async () => {
    const fixture = TestBed.createComponent(LoadingOverlay);
    fixture.componentRef.setInput('blocking', true);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    const activity = TestBed.inject(HttpActivity);
    expect(activity.regionBlocked()).toBe(true);
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(500);
    expect(activity.regionBlocked()).toBe(false);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('bloquea solo el contenido regional y lo libera inmediatamente al finalizar', async () => {
    const fixture = TestBed.createComponent(LoadingOverlay);
    fixture.componentRef.setInput('blocking', true);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[inert]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(150);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]')?.textContent).toContain(
      'Cargando información',
    );
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[inert]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role=status]')).toBeNull();
    expect(TestBed.inject(HttpActivity).regionBlocked()).toBe(false);
  });
});
