import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Iglesia Misión Líder París',
    loadComponent: () => import('./home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'donar',
    title: 'Donaciones · Iglesia Misión Líder París',
    loadComponent: () => import('./donations/donations-page').then((m) => m.DonationsPage),
  },
  {
    path: 'contacto',
    title: 'Contacto · Iglesia Misión Líder París',
    loadComponent: () => import('./contact/contact-page').then((m) => m.ContactPage),
  },
  {
    path: '**',
    title: 'Página no encontrada · Iglesia Misión Líder París',
    loadComponent: () => import('./not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
