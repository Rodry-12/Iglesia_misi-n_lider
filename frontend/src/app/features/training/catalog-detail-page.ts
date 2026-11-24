import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { CatalogStore } from './catalog.store';
import { CatalogKind, MinistryProcess, catalogSegment } from './catalog.models';
import { CatalogErrorMessage } from './catalog-actions';
@Component({
  selector: 'app-catalog-detail',
  imports: [ButtonModule, CatalogErrorMessage, DialogModule],
  templateUrl: './catalog-detail-page.html',
  styleUrl: './catalog.scss',
  providers: [CatalogStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailPage {
  readonly store = inject(CatalogStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  close(): void {
    void this.router.navigate(['/gestion/formacion', this.segment], {
      queryParams: this.route.snapshot.queryParams,
      state: { catalogUnchangedReturn: this.kind },
    });
  }
  readonly kind = this.route.snapshot.data['kind'] as CatalogKind;
  readonly segment = catalogSegment(this.kind);
  asProcess() {
    return this.store.item() as MinistryProcess | null;
  }
  private id = '';
  constructor() {
    this.store.notice.set(null);
    this.store.commandError.set(null);
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.retry();
    });
  }
  retry(): void {
    this.store.loadDetail(this.kind, this.id);
  }
}
