import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WalletSyncPromptService {
  private readonly _visible = signal(false);
  private _resolveFn: ((linked: boolean) => void) | null = null;

  readonly visible = this._visible.asReadonly();

  open(): Promise<boolean> {
    this._visible.set(true);
    return new Promise<boolean>((resolve) => {
      this._resolveFn = resolve;
    });
  }

  resolve(linked: boolean): void {
    this._visible.set(false);
    if (this._resolveFn) {
      this._resolveFn(linked);
      this._resolveFn = null;
    }
  }
}
