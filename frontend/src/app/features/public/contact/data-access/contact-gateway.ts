import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';

export interface ContactMessage {
  readonly user: string;
  readonly email: string;
  readonly subject: string;
  readonly content: string;
}
export interface ContactGateway {
  send(message: ContactMessage): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class EmailJsContactGateway implements ContactGateway {
  private readonly http = inject(HttpClient);
  async send(message: ContactMessage): Promise<void> {
    // Configuración pública presente en src/js/form.js. No contiene una clave privada.
    await firstValueFrom(
      this.http
        .post(
          'https://api.emailjs.com/api/v1.0/email/send',
          {
            service_id: 'service_l49xl0j',
            template_id: 'template_qwccze9',
            user_id: 'UZdTzitkN7lOw9igx',
            template_params: message,
          },
          { responseType: 'text' },
        )
        .pipe(timeout({ first: 15000 })),
    );
  }
}

export const CONTACT_GATEWAY = new InjectionToken<ContactGateway>('CONTACT_GATEWAY', {
  providedIn: 'root',
  factory: () => inject(EmailJsContactGateway),
});
