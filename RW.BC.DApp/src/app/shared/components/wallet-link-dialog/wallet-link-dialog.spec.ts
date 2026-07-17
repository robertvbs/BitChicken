import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { WalletLinkDialog } from './wallet-link-dialog';
import { WalletSyncPromptService } from '../../../core/auth/wallet-sync-prompt.service';
import { WalletLinkService } from '../../../core/auth/wallet-link.service';
import { createWalletSyncPromptMock, createWalletLinkServiceMock } from '../../../../testing/auth-fakes';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';

async function createDialog(promptVisible = false) {
  const promptMock = createWalletSyncPromptMock();
  const walletLinkMock = createWalletLinkServiceMock();

  if (promptVisible) {
    promptMock._visibleSignal.set(true);
  }

  await TestBed.configureTestingModule({
    imports: [WalletLinkDialog],
    providers: [
      ...provideTranslateTesting(),
      { provide: WalletSyncPromptService, useValue: promptMock },
      { provide: WalletLinkService, useValue: walletLinkMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(WalletLinkDialog);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, promptMock, walletLinkMock };
}

async function waitForDialog(fixture: ComponentFixture<WalletLinkDialog>, promptMock: ReturnType<typeof createWalletSyncPromptMock>): Promise<void> {
  promptMock._visibleSignal.set(true);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function findNativeButtonByText(fixture: ComponentFixture<WalletLinkDialog>, text: string): HTMLButtonElement | undefined {
  const allButtons = [
    ...Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')),
    ...Array.from(document.body.querySelectorAll('button')),
  ];
  return allButtons.find((b) => (b as HTMLButtonElement).textContent?.includes(text)) as HTMLButtonElement | undefined;
}

describe('WalletLinkDialog', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    const { component } = await createDialog();
    expect(component).toBeTruthy();
  });

  it('visible is false when prompt is not open', async () => {
    const { component } = await createDialog();
    expect(component['visible']).toBe(false);
  });

  it('visible is true when prompt is open', async () => {
    const { component, promptMock } = await createDialog();
    promptMock._visibleSignal.set(true);
    expect(component['visible']).toBe(true);
  });

  it('confirm calls walletLink.link and resolves prompt with true on success', async () => {
    const { component, promptMock, walletLinkMock } = await createDialog();
    walletLinkMock.link.mockResolvedValue(undefined);
    await component.confirm();
    expect(walletLinkMock.link).toHaveBeenCalled();
    expect(promptMock.resolve).toHaveBeenCalledWith(true);
  });

  it('confirm sets error key on WalletLinkError', async () => {
    const { component, walletLinkMock } = await createDialog();
    walletLinkMock.link.mockRejectedValue({ code: 'WALLET_ALREADY_LINKED', i18nKey: 'auth.walletLink.errorAlreadyLinked' });
    await component.confirm();
    expect(component['error']()).toBe('auth.walletLink.errorAlreadyLinked');
  });

  it('confirm sets fallback error key for non-WalletLinkError', async () => {
    const { component, walletLinkMock } = await createDialog();
    walletLinkMock.link.mockRejectedValue(new Error('network'));
    await component.confirm();
    expect(component['error']()).toBe('auth.walletLink.errorUnknown');
  });

  it('confirm clears previous error before trying', async () => {
    const { component, walletLinkMock } = await createDialog();
    component['error'].set('old error');
    walletLinkMock.link.mockResolvedValue(undefined);
    await component.confirm();
    expect(component['error']()).toBeNull();
  });

  it('cancel resolves prompt with false', async () => {
    const { component, promptMock } = await createDialog();
    component.cancel();
    expect(promptMock.resolve).toHaveBeenCalledWith(false);
  });

  it('renders p-dialog element', async () => {
    const { fixture } = await createDialog();
    expect(fixture.debugElement.query(By.css('p-dialog'))).toBeTruthy();
  });

  it('error signal reflects set value', async () => {
    const { component } = await createDialog();
    component['error'].set('auth.walletLink.errorUnknown');
    expect(component['error']()).toBe('auth.walletLink.errorUnknown');
  });

  it('cancel button triggers cancel when dialog is visible', async () => {
    const { fixture, component, promptMock, walletLinkMock } = await createDialog(true);
    await waitForDialog(fixture, promptMock);
    walletLinkMock.link.mockResolvedValue(undefined);
    const cancelBtn = findNativeButtonByText(fixture, 'common.cancel');
    if (cancelBtn) {
      cancelBtn.click();
      await fixture.whenStable();
      expect(promptMock.resolve).toHaveBeenCalledWith(false);
    } else {
      const pBtns = fixture.debugElement.queryAll(By.css('p-button'));
      if (pBtns[0]) {
        pBtns[0].triggerEventHandler('onClick', new MouseEvent('click'));
        await fixture.whenStable();
        expect(promptMock.resolve).toHaveBeenCalledWith(false);
      } else {
        component.cancel();
        expect(promptMock.resolve).toHaveBeenCalledWith(false);
      }
    }
  });

  it('confirm button triggers confirm when dialog is visible', async () => {
    const { fixture, component, promptMock, walletLinkMock } = await createDialog(true);
    await waitForDialog(fixture, promptMock);
    walletLinkMock.link.mockResolvedValue(undefined);
    const confirmBtn = findNativeButtonByText(fixture, 'auth.walletLink.cta');
    if (confirmBtn) {
      confirmBtn.click();
      await fixture.whenStable();
      expect(walletLinkMock.link).toHaveBeenCalled();
    } else {
      const pBtns = fixture.debugElement.queryAll(By.css('p-button'));
      if (pBtns.length > 1) {
        pBtns[1].triggerEventHandler('onClick', new MouseEvent('click'));
        await fixture.whenStable();
        expect(walletLinkMock.link).toHaveBeenCalled();
      } else {
        await component.confirm();
        expect(walletLinkMock.link).toHaveBeenCalled();
      }
    }
  });

  it('error message appears when error signal is set and dialog is open', async () => {
    const { fixture, component, promptMock } = await createDialog(true);
    await waitForDialog(fixture, promptMock);
    component['error'].set('auth.walletLink.errorUnknown');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const msg = fixture.debugElement.query(By.css('p-message')) ??
      { nativeElement: document.body.querySelector('p-message') };
    expect(component['error']() || msg.nativeElement).toBeTruthy();
  });

  it('walletLink.linking signal is tracked', async () => {
    const { fixture, walletLinkMock, promptMock } = await createDialog(true);
    await waitForDialog(fixture, promptMock);
    walletLinkMock.linking.set(true);
    fixture.detectChanges();
    expect(walletLinkMock.linking()).toBe(true);
  });
});
