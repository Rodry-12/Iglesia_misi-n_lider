import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { AccountActionStore } from './account-action.store';
import { AccountActionPage } from './account-action-page';
describe('HU-012 activación', () => {
  it('retira el token de la URL, valida coincidencia y solo confirma éxito tras204', async () => {
    TestBed.configureTestingModule({
      imports: [AccountActionPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { operation: 'activate-invitation' },
              fragment: 'email=recipient%40example.invalid&token=synthetic-token',
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    });
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccountActionPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    expect(navigation).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ replaceUrl: true, fragment: undefined, queryParams: {} }),
    );
    page.form.patchValue({ password: 'ValidPassword123!', confirmation: 'different' });
    await page.submit();
    http.expectNone('/api/v1/auth/activate-invitation');
    page.form.controls.confirmation.setValue('ValidPassword123!');
    const pending = page.submit();
    expect(page.store.done()).toBe(false);
    const request = http.expectOne('/api/v1/auth/activate-invitation');
    expect(request.request.body).toEqual({
      email: 'recipient@example.invalid',
      token: 'synthetic-token',
      newPassword: 'ValidPassword123!',
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    expect(page.store.done()).toBe(true);
    expect(page.form.controls.password.value).toBe('');
    http.verify();
  });
  it('enlace inválido conserva estado de error sin éxito falso', async () => {
    TestBed.configureTestingModule({
      providers: [AccountActionStore, provideHttpClient(), provideHttpClientTesting()],
    });
    const store = TestBed.inject(AccountActionStore);
    const http = TestBed.inject(HttpTestingController);
    const pending = store.submit('activate-invitation', {});
    await store.submit('activate-invitation', {});
    http
      .expectOne('/api/v1/auth/activate-invitation')
      .flush({}, { status: 400, statusText: 'Invalid' });
    await pending;
    expect(store.done()).toBe(false);
    expect(store.error()).toContain('enlace');
    http.verify();
  });
});
