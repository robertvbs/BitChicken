import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-ambient-background',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ambient-background.html',
  styleUrl: './ambient-background.css',
})
export class AmbientBackground {
  protected readonly theme = inject(ThemeService);
}
