import { Injectable, signal } from '@angular/core';

export type AuthDialogMode = 'login' | 'signup';

@Injectable({ providedIn: 'root' })
export class AuthDialogService {
  private readonly _visible = signal(false);
  private readonly _mode = signal<AuthDialogMode>('login');
  private _resolveFn: ((success: boolean) => void) | null = null;

  readonly visible = this._visible.asReadonly();
  readonly mode = this._mode.asReadonly();

  open(mode: AuthDialogMode = 'login'): Promise<boolean> {
    this._mode.set(mode);
    this._visible.set(true);
    return new Promise<boolean>((resolve) => {
      this._resolveFn = resolve;
    });
  }

  setMode(mode: AuthDialogMode): void {
    this._mode.set(mode);
  }

  resolve(success: boolean): void {
    this._visible.set(false);
    if (this._resolveFn) {
      this._resolveFn(success);
      this._resolveFn = null;
    }
  }
}
