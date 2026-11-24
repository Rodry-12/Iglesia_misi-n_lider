import { computed, Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HttpActivity {
  private readonly requests = signal(0);
  private readonly blockingRegions = signal(0);
  readonly busy = computed(() => this.requests() > 0);
  readonly regionBlocked = computed(() => this.blockingRegions() > 0);

  beginRequest(): () => void {
    return this.track(this.requests);
  }
  beginBlockingRegion(): () => void {
    return this.track(this.blockingRegions);
  }

  private track(counter: WritableSignal<number>): () => void {
    counter.update((value) => value + 1);
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      counter.update((value) => value - 1);
    };
  }
}
