import { ChurchContent } from './church-content.model';

/** Fuente: HTML original. Confirmar vigencia institucional antes del lanzamiento. */
export const CHURCH_CONTENT = {
  name: 'Iglesia Misión Líder París',
  shortName: 'Misión Líder París',
  logoPath: '/assets/images/MISIÓN LÍDER .png',
  donationQrPath: '/assets/images/qr.png',
  welcome:
    'Somos una iglesia de amor, fe y poder. Más que una iglesia somos una familia y estamos aquí para bendecir tu vida.',
  mission:
    'Atraer las personas a Jesús, plantarlas en la iglesia, formarlas como líderes y equiparlas para ejercer su ministerio; usando los dones y talentos dados por Dios, para establecer su Reino en la tierra.',
  vision:
    'Es el sueño de comunicar las Buenas Noticias de Jesús y formar líderes en el departamento Antioqueño, en Colombia y el mundo.',
  email: 'iglesiamisionliderparis@gmail.com',
  phone: '+573204139770',
  phoneLabel: '+57 320 413 9770',
  whatsapp: 'https://api.whatsapp.com/send?phone=573204139770',
  facebook: 'https://www.facebook.com/mision.lider.paris',
  instagram: 'https://www.instagram.com/misionliderparis/',
  youtube: 'https://www.youtube.com/channel/UCb5TXyYyzrnd3robsZHuL3A',
  maps: 'https://www.google.com/maps/place/Iglesia+mision+lider/@6.316172,-75.5832974,19.71z/data=!4m13!1m7!3m6!1s0x8e442ee6811041db:0x39e3f6c81ba7351b!2sCra.+78a+%2325b-49+int+132,+Bello,+Antioquia!3b1!8m2!3d6.316044!4d-75.5826538!3m4!1s0x8e442f0f89cbb5d5:0x492d8d78da4123a3!8m2!3d6.3161655!4d-75.5828863',
  services: [
    { name: 'Servicio de miércoles', day: 'Miércoles', time: '7:00 p. m.' },
    { name: 'Servicio de jóvenes', day: 'Sábado', time: '7:00 p. m.' },
    { name: 'Servicio dominical', day: 'Domingo', time: '9:00 a. m.' },
  ],
} as const satisfies ChurchContent;
