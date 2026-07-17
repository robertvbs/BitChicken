import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenuItem } from 'primeng/api';
import { AnalyticsService } from '../../../core/analytics/analytics.service';

interface ShareTarget {
  name: string;
  icon: string;
  href: (url: string, text: string) => string;
}

const enc = encodeURIComponent;

@Component({
  selector: 'app-share-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, MenuModule, TranslatePipe],
  templateUrl: './share-buttons.html',
})
export class ShareButtons {
  readonly url = input.required<string>();
  readonly message = input<string>('');

  private readonly translate = inject(TranslateService);
  private readonly analytics = inject(AnalyticsService);

  protected readonly canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  protected readonly targets: ShareTarget[] = [
    { name: 'WhatsApp', icon: 'pi pi-whatsapp', href: (u, t) => `https://wa.me/?text=${enc(`${t} ${u}`)}` },
    { name: 'Telegram', icon: 'pi pi-telegram', href: (u, t) => `https://t.me/share/url?url=${enc(u)}&text=${enc(t)}` },
    { name: 'X', icon: 'pi pi-twitter', href: (u, t) => `https://twitter.com/intent/tweet?text=${enc(t)}&url=${enc(u)}` },
    { name: 'Facebook', icon: 'pi pi-facebook', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
    { name: 'LinkedIn', icon: 'pi pi-linkedin', href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}` },
    { name: 'E-mail', icon: 'pi pi-envelope', href: (u, t) => `mailto:?subject=${enc(this.subject())}&body=${enc(`${t} ${u}`)}` },
  ];

  protected buildMenuItems(): MenuItem[] {
    const items: MenuItem[] = this.targets.map((target) => ({
      label: target.name,
      icon: target.icon,
      command: () => {
        this.analytics.track('share', { method: target.name, content_type: 'referral', item_id: 'referral' });
        window.open(this.link(target), '_blank', 'noopener,noreferrer');
      },
    }));

    if (this.canNativeShare) {
      items.unshift({
        label: this.translate.instant('share.native'),
        icon: 'pi pi-share-alt',
        command: () => void this.nativeShare(),
      });
    }

    return items;
  }

  protected link(target: ShareTarget): string {
    return target.href(this.url(), this.text());
  }

  protected async nativeShare(): Promise<void> {
    try {
      await navigator.share({ title: this.subject(), text: this.text(), url: this.url() });
      this.analytics.track('share', { method: 'native', content_type: 'referral', item_id: 'referral' });
    } catch {
    }
  }

  private text(): string {
    return this.message() || this.translate.instant('share.message');
  }

  private subject(): string {
    return this.translate.instant('share.subject');
  }
}
