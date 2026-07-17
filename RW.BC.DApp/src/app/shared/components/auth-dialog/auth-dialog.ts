import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthDialogService } from '../../../core/auth/auth-dialog.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AccountStore } from '../../../core/auth/account.store';

const NICKNAME_PATTERN = /^[A-Za-z0-9 _]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const FIREBASE_EMAIL_IN_USE = 'auth/email-already-in-use';

@Component({
  selector: 'app-auth-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogModule, ButtonModule, InputTextModule, PasswordModule, MessageModule, TranslatePipe],
  templateUrl: './auth-dialog.html',
})
export class AuthDialog {
  protected readonly authDialog = inject(AuthDialogService);
  private readonly auth = inject(AuthService);
  private readonly accountStore = inject(AccountStore);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly nickname = signal('');
  protected readonly loading = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly emailValid = computed(() => EMAIL_PATTERN.test(this.email()));
  protected readonly passwordValid = computed(() => this.password().length >= MIN_PASSWORD_LENGTH);
  protected readonly nicknameValid = computed(() => NICKNAME_PATTERN.test(this.nickname()));
  protected readonly signupFormValid = computed(
    () => this.emailValid() && this.passwordValid() && this.nicknameValid(),
  );

  protected get visible(): boolean {
    return this.authDialog.visible();
  }

  protected switchToSignup(): void {
    this.errorKey.set(null);
    this.authDialog.setMode('signup');
  }

  protected switchToLogin(): void {
    this.errorKey.set(null);
    this.authDialog.setMode('login');
  }

  protected cancel(): void {
    this.authDialog.resolve(false);
  }

  async submitLogin(): Promise<void> {
    this.errorKey.set(null);
    this.loading.set(true);
    try {
      await this.auth.signIn(this.email(), this.password());
      await this.accountStore.refresh();
      this.authDialog.resolve(true);
    } catch {
      this.errorKey.set('auth.login.error');
    } finally {
      this.loading.set(false);
    }
  }

  async submitSignup(): Promise<void> {
    if (!this.signupFormValid()) return;
    this.errorKey.set(null);
    this.loading.set(true);
    try {
      await this.auth.signUp(this.email(), this.password(), this.nickname());
      await this.accountStore.refresh();
      this.authDialog.resolve(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === FIREBASE_EMAIL_IN_USE) {
        this.errorKey.set('auth.signup.errorEmailInUse');
      } else if (err instanceof HttpErrorResponse && err.status === 409) {
        this.errorKey.set('auth.signup.errorEmailInUse');
      } else {
        this.errorKey.set('auth.signup.error');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
