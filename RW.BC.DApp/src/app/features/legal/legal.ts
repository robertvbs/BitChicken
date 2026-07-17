import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TranslatePipe } from '@ngx-translate/core';

interface FaqEntry {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-legal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, TranslatePipe],
  templateUrl: './legal.html',
})
export class Legal {
  readonly faq: FaqEntry[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    question: `legal.faq.q${n}`,
    answer: `legal.faq.a${n}`,
  }));

  readonly risks: string[] = [1, 2, 3, 4].map((n) => `legal.risk.item${n}`);

  readonly terms: string[] = [1, 2, 3].map((n) => `legal.terms.p${n}`);
}
