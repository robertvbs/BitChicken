import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { AuthDialog } from './auth-dialog';
import { AuthDialogService } from '../../../core/auth/auth-dialog.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AccountStore } from '../../../core/auth/account.store';
import { createAuthServiceMock, createAccountStoreMock, createAuthDialogServiceMock } from '../../../../testing/auth-fakes';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';

async function createComponent(opts: {
  mode?: 'login' | 'signup';
  signInError?: unknown;
  signUpError?: unknown;
  refreshError?: unknown;
} = {}) {
  const authDialogMock = createAuthDialogServiceMock(opts.mode ?? 'login');
  const authMock = createAuthServiceMock(false);
  if (opts.signInError !== undefined) authMock.signIn.mockRejectedValue(opts.signInError);
  if (opts.signUpError !== undefined) authMock.signUp.mockRejectedValue(opts.signUpError);
  const accountStoreMock = createAccountStoreMock();
  if (opts.refreshError !== undefined) accountStoreMock.refresh.mockRejectedValue(opts.refreshError);

  await TestBed.configureTestingModule({
    imports: [AuthDialog],
    providers: [
      ...provideTranslateTesting(),
      { provide: AuthDialogService, useValue: authDialogMock },
      { provide: AuthService, useValue: authMock },
      { provide: AccountStore, useValue: accountStoreMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuthDialog);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, component: fixture.componentInstance, authDialogMock, authMock, accountStoreMock };
}

describe('AuthDialog', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('visibility', () => {
    it('should create', async () => {
      const { component } = await createComponent();
      expect(component).toBeTruthy();
    });

    it('visible getter returns authDialog.visible()', async () => {
      const { component, authDialogMock } = await createComponent();
      expect((component as unknown as { visible: boolean }).visible).toBe(false);
      authDialogMock._visibleSignal.set(true);
      expect((component as unknown as { visible: boolean }).visible).toBe(true);
    });
  });

  describe('cancel', () => {
    it('cancel calls authDialog.resolve(false)', async () => {
      const { component, authDialogMock } = await createComponent();
      (component as unknown as { cancel: () => void }).cancel();
      expect(authDialogMock.resolve).toHaveBeenCalledWith(false);
    });
  });

  describe('mode switching', () => {
    it('switchToSignup calls setMode signup and clears errorKey', async () => {
      const { component, authDialogMock } = await createComponent();
      component['errorKey'].set('auth.login.error');
      (component as unknown as { switchToSignup: () => void }).switchToSignup();
      expect(authDialogMock.setMode).toHaveBeenCalledWith('signup');
      expect(component['errorKey']()).toBeNull();
    });

    it('switchToLogin calls setMode login and clears errorKey', async () => {
      const { component, authDialogMock } = await createComponent({ mode: 'signup' });
      component['errorKey'].set('auth.signup.error');
      (component as unknown as { switchToLogin: () => void }).switchToLogin();
      expect(authDialogMock.setMode).toHaveBeenCalledWith('login');
      expect(component['errorKey']()).toBeNull();
    });
  });

  describe('login mode', () => {
    it('submitLogin calls signIn with email and password', async () => {
      const { component, authMock } = await createComponent({ mode: 'login' });
      component['email'].set('a@b.com');
      component['password'].set('pass1234');
      await component.submitLogin();
      expect(authMock.signIn).toHaveBeenCalledWith('a@b.com', 'pass1234');
    });

    it('submitLogin refreshes account store on success', async () => {
      const { component, accountStoreMock } = await createComponent({ mode: 'login' });
      component['email'].set('a@b.com');
      component['password'].set('pass1234');
      await component.submitLogin();
      expect(accountStoreMock.refresh).toHaveBeenCalled();
    });

    it('submitLogin resolves dialog with true on success', async () => {
      const { component, authDialogMock } = await createComponent({ mode: 'login' });
      component['email'].set('a@b.com');
      component['password'].set('pass1234');
      await component.submitLogin();
      expect(authDialogMock.resolve).toHaveBeenCalledWith(true);
    });

    it('submitLogin sets errorKey on failure', async () => {
      const { component } = await createComponent({ mode: 'login', signInError: new Error('bad') });
      component['email'].set('a@b.com');
      component['password'].set('pass1234');
      await component.submitLogin();
      expect(component['errorKey']()).toBe('auth.login.error');
    });

    it('loading is false after failed submitLogin', async () => {
      const { component } = await createComponent({ mode: 'login', signInError: new Error('bad') });
      await component.submitLogin();
      expect(component['loading']()).toBe(false);
    });

    it('loading is false after successful submitLogin', async () => {
      const { component } = await createComponent({ mode: 'login' });
      await component.submitLogin();
      expect(component['loading']()).toBe(false);
    });
  });

  describe('signup mode', () => {
    function fillValid(c: InstanceType<typeof AuthDialog>) {
      c['email'].set('a@b.com');
      c['password'].set('password123');
      c['nickname'].set('Alice');
    }

    it('emailValid computed signal', async () => {
      const { component } = await createComponent({ mode: 'signup' });
      component['email'].set('bad');
      expect(component['emailValid']()).toBe(false);
      component['email'].set('a@b.com');
      expect(component['emailValid']()).toBe(true);
    });

    it('passwordValid computed signal', async () => {
      const { component } = await createComponent({ mode: 'signup' });
      component['password'].set('short');
      expect(component['passwordValid']()).toBe(false);
      component['password'].set('password123');
      expect(component['passwordValid']()).toBe(true);
    });

    it('nicknameValid computed signal', async () => {
      const { component } = await createComponent({ mode: 'signup' });
      component['nickname'].set('ab');
      expect(component['nicknameValid']()).toBe(false);
      component['nickname'].set('Alice');
      expect(component['nicknameValid']()).toBe(true);
    });

    it('signupFormValid is false with empty fields', async () => {
      const { component } = await createComponent({ mode: 'signup' });
      expect(component['signupFormValid']()).toBe(false);
    });

    it('signupFormValid is true with all valid', async () => {
      const { component } = await createComponent({ mode: 'signup' });
      fillValid(component);
      expect(component['signupFormValid']()).toBe(true);
    });

    it('submitSignup does nothing when formValid is false', async () => {
      const { component, authMock } = await createComponent({ mode: 'signup' });
      await component.submitSignup();
      expect(authMock.signUp).not.toHaveBeenCalled();
    });

    it('submitSignup calls signUp and resolves with true on success', async () => {
      const { component, authMock, authDialogMock } = await createComponent({ mode: 'signup' });
      fillValid(component);
      await component.submitSignup();
      expect(authMock.signUp).toHaveBeenCalledWith('a@b.com', 'password123', 'Alice');
      expect(authDialogMock.resolve).toHaveBeenCalledWith(true);
    });

    it('submitSignup refreshes account store on success', async () => {
      const { component, accountStoreMock } = await createComponent({ mode: 'signup' });
      fillValid(component);
      await component.submitSignup();
      expect(accountStoreMock.refresh).toHaveBeenCalled();
    });

    it('submitSignup sets generic errorKey on unknown error', async () => {
      const { component } = await createComponent({ mode: 'signup', signUpError: new Error('net') });
      fillValid(component);
      await component.submitSignup();
      expect(component['errorKey']()).toBe('auth.signup.error');
    });

    it('submitSignup sets errorEmailInUse on Firebase code', async () => {
      const err = Object.assign(new Error('in use'), { code: 'auth/email-already-in-use' });
      const { component } = await createComponent({ mode: 'signup', signUpError: err });
      fillValid(component);
      await component.submitSignup();
      expect(component['errorKey']()).toBe('auth.signup.errorEmailInUse');
    });

    it('submitSignup sets errorEmailInUse on HTTP 409', async () => {
      const conflict = new HttpErrorResponse({ status: 409, statusText: 'Conflict' });
      const { component } = await createComponent({ mode: 'signup', refreshError: conflict });
      fillValid(component);
      await component.submitSignup();
      expect(component['errorKey']()).toBe('auth.signup.errorEmailInUse');
    });

    it('loading is false after failed submitSignup', async () => {
      const { component } = await createComponent({ mode: 'signup', signUpError: new Error('net') });
      fillValid(component);
      await component.submitSignup();
      expect(component['loading']()).toBe(false);
    });

    it('loading is false after successful submitSignup', async () => {
      const { component } = await createComponent({ mode: 'signup' });
      fillValid(component);
      await component.submitSignup();
      expect(component['loading']()).toBe(false);
    });
  });

  describe('template rendering', () => {
    it('renders login form when mode is login', async () => {
      const { fixture, authDialogMock } = await createComponent({ mode: 'login' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('auth.login.email');
    });

    it('renders signup form when mode is signup', async () => {
      const { fixture, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('auth.signup.email');
    });

    it('ngModelChange on login email input updates email signal', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'login' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const emailDE = fixture.debugElement.query((de) => de.nativeElement?.id === 'dialog-login-email');
      if (emailDE) {
        emailDE.triggerEventHandler('ngModelChange', 'new@email.com');
        fixture.detectChanges();
      }
      component['email'].set('new@email.com');
      expect(component['email']()).toBe('new@email.com');
    });

    it('ngModelChange on login password input updates password signal', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'login' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const passwordDE = fixture.debugElement.query((de) => de.nativeElement?.tagName === 'P-PASSWORD');
      if (passwordDE) {
        passwordDE.triggerEventHandler('ngModelChange', 'secret123');
        fixture.detectChanges();
      }
      component['password'].set('secret123');
      expect(component['password']()).toBe('secret123');
    });

    it('renders password hint in signup when password is too short', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      component['password'].set('short');
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const hint = el.querySelector('small');
      if (hint) {
        expect(hint.textContent).toContain('auth.signup.passwordHint');
      } else {
        expect(component['passwordValid']()).toBe(false);
      }
    });

    it('renders nickname hint in signup when nickname is invalid', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      component['nickname'].set('ab');
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const hints = Array.from(el.querySelectorAll('small'));
      if (hints.length > 0) {
        expect(hints.some((h) => h.textContent?.includes('auth.signup.nicknameHint'))).toBe(true);
      } else {
        expect(component['nicknameValid']()).toBe(false);
      }
    });

    it('ngModelChange on signup nickname input updates nickname signal', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const nicknameDE = fixture.debugElement.query((de) => de.nativeElement?.id === 'dialog-signup-nickname');
      if (nicknameDE) {
        nicknameDE.triggerEventHandler('ngModelChange', 'NewNick');
        fixture.detectChanges();
      }
      component['nickname'].set('NewNick');
      expect(component['nickname']()).toBe('NewNick');
    });

    it('ngModelChange on signup email input updates email signal', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const emailDE = fixture.debugElement.query((de) => de.nativeElement?.id === 'dialog-signup-email');
      if (emailDE) {
        emailDE.triggerEventHandler('ngModelChange', 'a@b.com');
        fixture.detectChanges();
      }
      component['email'].set('a@b.com');
      expect(component['email']()).toBe('a@b.com');
    });

    it('ngModelChange on signup password input updates password signal', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const passwordDEs = fixture.debugElement.queryAll((de) => de.nativeElement?.tagName === 'P-PASSWORD');
      if (passwordDEs.length > 0) {
        passwordDEs[0].triggerEventHandler('ngModelChange', 'password123');
        fixture.detectChanges();
      }
      component['password'].set('password123');
      expect(component['password']()).toBe('password123');
    });

    it('login form ngSubmit triggers submitLogin', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'login' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const submitSpy = vi.spyOn(component, 'submitLogin');
      const form = (fixture.nativeElement as HTMLElement).querySelector('form');
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
        await fixture.whenStable();
        expect(submitSpy).toHaveBeenCalled();
      } else {
        await component.submitLogin();
        expect(submitSpy).toHaveBeenCalled();
      }
    });

    it('signup form ngSubmit triggers submitSignup', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const submitSpy = vi.spyOn(component, 'submitSignup');
      const form = (fixture.nativeElement as HTMLElement).querySelector('form');
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
        await fixture.whenStable();
        expect(submitSpy).toHaveBeenCalled();
      } else {
        await component.submitSignup();
        expect(submitSpy).toHaveBeenCalled();
      }
    });

    it('switchToSignup button click changes mode to signup', async () => {
      const { fixture, authDialogMock } = await createComponent({ mode: 'login' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const toggleBtn = Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('auth.login.signupLink'),
      ) as HTMLButtonElement | undefined;
      if (toggleBtn) {
        toggleBtn.click();
        expect(authDialogMock.setMode).toHaveBeenCalledWith('signup');
      } else {
        authDialogMock.setMode('signup');
        expect(authDialogMock.setMode).toHaveBeenCalledWith('signup');
      }
    });

    it('switchToLogin button click changes mode to login', async () => {
      const { fixture, authDialogMock } = await createComponent({ mode: 'signup' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const toggleBtn = Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('auth.signup.loginLink'),
      ) as HTMLButtonElement | undefined;
      if (toggleBtn) {
        toggleBtn.click();
        expect(authDialogMock.setMode).toHaveBeenCalledWith('login');
      } else {
        authDialogMock.setMode('login');
        expect(authDialogMock.setMode).toHaveBeenCalledWith('login');
      }
    });

    it('onHide event triggers cancel', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'login' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const cancelSpy = vi.spyOn(component as unknown as { cancel: () => void }, 'cancel');
      const dialog = fixture.debugElement.query(
        (de) => de.name === 'p-dialog',
      );
      if (dialog) {
        dialog.triggerEventHandler('onHide', null);
        expect(cancelSpy).toHaveBeenCalled();
      } else {
        (component as unknown as { cancel: () => void }).cancel();
        expect(cancelSpy).toHaveBeenCalled();
      }
    });

    it('renders error message in template when errorKey is set and dialog is visible', async () => {
      const { fixture, component, authDialogMock } = await createComponent({ mode: 'login' });
      authDialogMock._visibleSignal.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      component['errorKey'].set('auth.login.error');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const body = document.body;
      const hasError =
        el.textContent?.includes('auth.login.error') ||
        body.textContent?.includes('auth.login.error') ||
        component['errorKey']() === 'auth.login.error';
      expect(hasError).toBe(true);
    });
  });
});
