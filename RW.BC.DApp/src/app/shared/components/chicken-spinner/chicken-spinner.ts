import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-chicken-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chicken-spinner.html',
  styleUrl: './chicken-spinner.css',
  host: {
    role: 'status',
    '[attr.aria-label]': 'label()',
  },
})
export class ChickenSpinner {
  readonly label = input<string>('');
}
