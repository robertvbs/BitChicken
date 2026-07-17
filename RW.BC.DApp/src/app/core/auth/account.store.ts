import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccountDto } from './auth.models';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly api = inject(AuthApiService);
  private readonly auth = inject(AuthService);

  private readonly _account = signal<AccountDto | null>(null);
  private readonly _settledUid = signal<string | null>(null);
  private hydratedUid: string | null = null;

  readonly account = this._account.asReadonly();
  readonly walletLinked = computed(() => this._account()?.walletLinked ?? false);
  readonly nickname = computed(() => this._account()?.nickname ?? null);
  readonly ready = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return true;
    return this._settledUid() === user.uid;
  });

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        if (this.hydratedUid === user.uid) return;
        this.hydratedUid = user.uid;
        this.api.getMe().then((account) => {
          this._account.set(account);
          this._settledUid.set(user.uid);
        }).catch(() => {
          this.hydratedUid = null;
          this._settledUid.set(user.uid);
        });
      } else {
        this.hydratedUid = null;
        this._settledUid.set(null);
        this._account.set(null);
      }
    });
  }

  async refresh(): Promise<void> {
    const account = await this.api.getMe();
    this._account.set(account);
    const user = this.auth.currentUser();
    if (user) {
      this.hydratedUid = user.uid;
      this._settledUid.set(user.uid);
    }
  }

  setAccount(account: AccountDto | null): void {
    this._account.set(account);
  }

  clear(): void {
    this.hydratedUid = null;
    this._settledUid.set(null);
    this._account.set(null);
  }
}
