import { ErrorHandler, inject, isDevMode } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { describeError } from '../web3/web3-errors';
import { Web3Error } from '../web3/web3.models';

export class AppErrorHandler implements ErrorHandler {
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);

  handleError(error: unknown): void {
    if (isDevMode()) {
      console.error('[AppErrorHandler]', error);
    }

    if (error instanceof Web3Error) {
      const detail = describeError(error, this.translate);
      this.messages.add({ severity: 'error', summary: detail, life: 6000 });
      return;
    }

    const unexpectedKey = 'errors.unexpected';
    this.messages.add({
      severity: 'error',
      summary: this.translate.instant(unexpectedKey),
      life: 6000,
    });
  }
}
