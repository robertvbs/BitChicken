import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { toString as qrToString } from 'qrcode';

@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="inline-block rounded-md bg-white p-2" [innerHTML]="svg()"></div>`,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly size = input(160);

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly svg = signal<SafeHtml>('');

  constructor() {
    effect(() => {
      const value = this.value();
      const size = this.size();
      void this.render(value, size);
    });
  }

  private async render(value: string, size: number): Promise<void> {
    try {
      const markup = await qrToString(value, { type: 'svg', margin: 1, width: size });
      this.svg.set(this.sanitizer.bypassSecurityTrustHtml(markup));
    } catch {
      this.svg.set('');
    }
  }
}
