export interface ChurchService {
  readonly name: string;
  readonly day: string;
  readonly time: string;
}

export interface ChurchContent {
  readonly name: string;
  readonly shortName: string;
  readonly welcome: string;
  readonly mission: string;
  readonly vision: string;
  readonly email: string;
  readonly phone: string;
  readonly phoneLabel: string;
  readonly whatsapp: string;
  readonly facebook: string;
  readonly instagram: string;
  readonly youtube: string;
  readonly maps: string;
  readonly logoPath: string;
  readonly donationQrPath: string;
  readonly services: readonly ChurchService[];
}
