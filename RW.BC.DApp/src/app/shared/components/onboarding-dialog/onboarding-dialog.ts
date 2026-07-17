import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';

const STORAGE_KEY = 'bitchicken.onboarded';

@Component({
  selector: 'app-onboarding-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, TranslatePipe],
  templateUrl: './onboarding-dialog.html',
})
export class OnboardingDialog {
  private readonly router = inject(Router);

  protected readonly visible = signal(this.shouldShow());

  protected readonly steps = [
    'onboarding.step1',
    'onboarding.step2',
    'onboarding.step3',
    'onboarding.step4',
    'onboarding.step5',
  ];

  protected close(): void {
    this.visible.set(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
    }
  }

  private shouldShow(): boolean {
    if (this.router.url === '/') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  }
}
