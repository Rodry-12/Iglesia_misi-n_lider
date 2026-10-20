import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteHeader } from './components/site-header/site-header';
import { SiteFooter } from './components/site-footer/site-footer';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
  host: { class: 'public-site' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayout {}
