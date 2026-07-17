import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-egg-hatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './egg-hatch.html',
  styleUrl: './egg-hatch.css',
  host: {
    class: 'bc-egg',
    'aria-hidden': 'true',
  },
})
export class EggHatch {}
