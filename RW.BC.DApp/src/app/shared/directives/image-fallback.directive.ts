import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: 'img[appImageFallback]',
})
export class ImageFallbackDirective {
  @HostListener('error', ['$event'])
  onError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target || typeof target.setAttribute !== 'function') return;
    target.setAttribute('src', ImageFallbackDirective.PLACEHOLDER_DATA_URI);
    target.classList.add('bc-img-broken');
  }

  static readonly PLACEHOLDER_DATA_URI =
    'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 1 1%22%3E%3C%2Fsvg%3E';
}
