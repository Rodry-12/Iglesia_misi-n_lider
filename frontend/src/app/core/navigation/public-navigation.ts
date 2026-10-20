export interface PublicNavigationItem {
  readonly label: string;
  readonly path: string;
  readonly fragment?: string;
}

export const PUBLIC_NAVIGATION: readonly PublicNavigationItem[] = [
  { label: 'Inicio', path: '/' },
  { label: 'Acerca de', path: '/', fragment: 'nosotros' },
  { label: 'Donar', path: '/donar' },
  { label: 'Contacto', path: '/', fragment: 'contacto' },
];

export const PUBLIC_SIGN_IN: PublicNavigationItem = {
  label: 'Iniciar sesión',
  path: '/acceso',
};
