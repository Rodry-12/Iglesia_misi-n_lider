/** Contenido recuperado del HTML original. Confirmar vigencia antes de publicar. */
export const PUBLIC_REFERENCE = {
  communityDescription:
    'Nuestra comunidad es un lugar en donde los heridos, rechazados y pobres en espíritu, encontrarán aceptación en el amor de Cristo; donde encontrarán redención y un propósito para sus vidas.',
  slides: [
    {
      src: '/assets/images/bienvenidos.png',
      alt: 'Bienvenida a Mision Lider Paris 1',
    },
    {
      src: '/assets/images/Bienvenidos2.png',
      alt: 'Bienvenida a Mision Lider Paris 2',
    },
    {
      src: '/assets/images/Bienvenidos4.PNG',
      alt: 'Bienvenida a Mision Lider Paris 3',
    },
  ],
  ministries: [
    {
      id: 0,
      title: 'Ministerio de Alabanza',
      prefix: 'Ministerio',
      label: 'de Alabanza',
      image: '/assets/images/alabanza1.jpg',
      description:
        'Somos un ministerio caracterizado por adorar a nuestro creador con pasión e integridad en respuesta a la gracia y misericordia de Dios, que desea predicar el evangelio por medio de la música.',
    },
    {
      id: 1,
      title: 'Ministerio de Servidores',
      prefix: 'Ministerio',
      label: 'de Servidores',
      image: '/assets/images/servidores.jpeg',
      description:
        'Es un ministerio apasionado en servir a otros, se destaca por el amor, la entrega, la pasión, la organización del templo, creando un ambiente propicio para cada persona que llega a su encuentro con Dios.',
    },
    {
      id: 2,
      title: 'Ministerio Infantil',
      prefix: 'Ministerio',
      label: 'Infantil',
      image: '/assets/images/ministerio_infantil.jpg',
      description:
        'Es un ministerio apasionado, que se destaca en la formación y preparación de los niños, su principal objetivo es conducirlos a conocer a Jesus.',
    },
    {
      id: 3,
      title: 'Ministerio Jóvenes',
      prefix: 'Ministerio',
      label: 'Jóvenes',
      image: '/assets/images/jovenes.jpg',
      description:
        'Tiene como objetivo conducir, equipar y capacitar a los jóvenes a darse cuenta de su propio valor, a descubrir, a desarrollar sus dones y habilidades sociales, culturales, mentales y espirituales para una vida de servicio dentro y fuera de la iglesia de Dios.',
    },
    {
      id: 4,
      title: 'Escuela: de Formación',
      prefix: 'Escuela:',
      label: 'de Formación',
      image: '/assets/images/formacion.jpeg',
      description:
        'Son escuelas que permite formar y preparar lideres de excelencia para la obra del Señor.',
    },
  ],
  services: [
    {
      title: 'Servicio de Miércoles',
      schedule: 'Hora: 7:00 PM',
      image: '/assets/images/servicio-miercoles.png',
      frontClass: 'servicio-miercoles',
      description:
        'Es un día en el cual nos reunimos para adorar y glorificar el nombre de nuestro Dios, con un tiempo de alabanza, adoración, una prédica relevante y práctica.',
      invitation: '¡Eres más que bienvenido!',
    },
    {
      title: 'Servicio de Jóvenes',
      schedule: '(sábados) Hora: 7:00 PM',
      image: '/assets/images/servicio-sabado.png',
      frontClass: 'servicio-sabado',
      description:
        'Es un espacio en el cual jóvenes de nuestra congregación se reúnen para alabar y escuchar a Dios con pasión. Jóvenes que les apasiona adorar a nuestro Dios, que procuran vivir cada día en santidad, y con un deseo inmenso de dar a conocer a más jóvenes el amor de Dios por medio de Jesús.',
      invitation: '¡Bienvenido, te esperamos con alegria!',
    },
    {
      title: 'Servicio Dominical',
      schedule: 'Hora: 9:00 AM',
      image: '/assets/images/servicio-domingo.png',
      frontClass: 'servicio-domingo',
      description:
        'Es un servicio en el cual adoramos con todo nuestro ser a Dios, mediante la alabanza, adoración y predica. Es el momento en el cual adores a nuestro Dios.',
      invitation: '¡No te lo pierdas, te esperamos!',
    },
  ],
} as const;
export type ReferenceService = (typeof PUBLIC_REFERENCE.services)[number];
