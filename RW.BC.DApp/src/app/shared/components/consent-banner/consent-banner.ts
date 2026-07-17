import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { AnalyticsService } from '../../../core/analytics/analytics.service';

@Component({
  selector: 'app-consent-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TranslatePipe, RouterLink],
  templateUrl: './consent-banner.html',
})
export class ConsentBanner {
  private readonly analytics = inject(AnalyticsService);

  protected readonly visible = signal(this.shouldShow());

  protected accept(): void {
    this.analytics.consent(true);
    this.visible.set(false);
  }

  protected decline(): void {
    this.analytics.consent(false);
    this.visible.set(false);
  }

  private shouldShow(): boolean {
    try {
      const stored = localStorage.getItem('bitchicken.consent');
      return stored === null;
    } catch {
      return true;
    }
  }
}
