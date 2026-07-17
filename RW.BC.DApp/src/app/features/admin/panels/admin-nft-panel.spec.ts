import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { vi } from 'vitest';
import { AdminNftPanel } from './admin-nft-panel';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { createContractAdminServiceMock } from '../../../../testing/web3-fakes';

function setup(nftPendingOwner = '') {
  const contractAdmin = createContractAdminServiceMock();

  TestBed.configureTestingModule({
    imports: [AdminNftPanel],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractAdminService, useValue: contractAdmin },
      MessageService,
      ConfirmationService,
    ],
  });

  const fixture = TestBed.createComponent(AdminNftPanel);
  fixture.componentRef.setInput('nftPendingOwner', nftPendingOwner);
  fixture.detectChanges();
  return { fixture, contractAdmin };
}

async function stable(fixture: ComponentFixture<AdminNftPanel>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminNftPanel', () => {
  describe('hasNftPendingOwner computed', () => {
    it('is false when pending owner is empty string', () => {
      const { fixture } = setup('');
      const comp = fixture.componentInstance as unknown as { hasNftPendingOwner: () => boolean };
      expect(comp.hasNftPendingOwner()).toBe(false);
    });

    it('is false when pending owner is zero address', () => {
      const { fixture } = setup('0x0000000000000000000000000000000000000000');
      const comp = fixture.componentInstance as unknown as { hasNftPendingOwner: () => boolean };
      expect(comp.hasNftPendingOwner()).toBe(false);
    });

    it('is true when pending owner is a real address', () => {
      const { fixture } = setup('0x1234567890123456789012345678901234567890');
      const comp = fixture.componentInstance as unknown as { hasNftPendingOwner: () => boolean };
      expect(comp.hasNftPendingOwner()).toBe(true);
    });
  });

  describe('isBusy computed', () => {
    it('is false when idle and busy input is false', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as { isBusy: () => boolean };
      expect(comp.isBusy()).toBe(false);
    });

    it('is true when busy input is true', () => {
      const { fixture } = setup();
      fixture.componentRef.setInput('busy', true);
      const comp = fixture.componentInstance as unknown as { isBusy: () => boolean };
      expect(comp.isBusy()).toBe(true);
    });
  });

  describe('setRoyalty', () => {
    it('calls adminSetRoyalty with receiver and bps', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        royaltyReceiver: { set: (v: string) => void };
        royaltyBps: { set: (v: number) => void };
        setRoyalty: () => Promise<void>;
      };
      comp.royaltyReceiver.set('0xABCD');
      comp.royaltyBps.set(300);
      await comp.setRoyalty();
      expect(contractAdmin.adminSetRoyalty).toHaveBeenCalledWith('0xABCD', 300, expect.any(Function));
    });

    it('shows success toast on success', async () => {
      const { fixture } = setup();
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { setRoyalty: () => Promise<void> };
      await comp.setRoyalty();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('shows error toast on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminSetRoyalty.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { setRoyalty: () => Promise<void> };
      await comp.setRoyalty();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('setRenamePrice', () => {
    it('calls adminSetRenamePrice with bigint value', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        renamePrice: { set: (v: number) => void };
        setRenamePrice: () => Promise<void>;
      };
      comp.renamePrice.set(500);
      await comp.setRenamePrice();
      expect(contractAdmin.adminSetRenamePrice).toHaveBeenCalledWith(500n, expect.any(Function));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminSetRenamePrice.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { setRenamePrice: () => Promise<void> };
      await comp.setRenamePrice();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('setReferralLevels', () => {
    it('parses CSV inputs and calls adminSetReferralLevels with thresholds and rates', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        referralThresholds: { set: (v: string) => void };
        referralRatesBps: { set: (v: string) => void };
        setReferralLevels: () => Promise<void>;
      };
      comp.referralThresholds.set('0, 3, 6');
      comp.referralRatesBps.set('200, 400, 600');
      await comp.setReferralLevels();
      expect(contractAdmin.adminSetReferralLevels).toHaveBeenCalledWith(
        [0n, 3n, 6n],
        [200, 400, 600],
        expect.any(Function),
      );
    });

    it('uses the default table when inputs are unchanged', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as { setReferralLevels: () => Promise<void> };
      await comp.setReferralLevels();
      expect(contractAdmin.adminSetReferralLevels).toHaveBeenCalledWith(
        [0n, 3n, 6n, 8n, 10n],
        [200, 400, 600, 800, 1000],
        expect.any(Function),
      );
    });

    it('shows error when a threshold is not a valid integer', async () => {
      const { fixture } = setup();
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as {
        referralThresholds: { set: (v: string) => void };
        setReferralLevels: () => Promise<void>;
      };
      comp.referralThresholds.set('0, abc');
      await comp.setReferralLevels();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminSetReferralLevels.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { setReferralLevels: () => Promise<void> };
      await comp.setReferralLevels();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('setForge', () => {
    it('calls adminSetForge with address string', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        forgeAddress: { set: (v: string) => void };
        setForge: () => Promise<void>;
      };
      comp.forgeAddress.set('0xFORGE');
      await comp.setForge();
      expect(contractAdmin.adminSetForge).toHaveBeenCalledWith('0xFORGE', expect.any(Function));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminSetForge.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { setForge: () => Promise<void> };
      await comp.setForge();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('nftAcceptOwnership', () => {
    it('calls adminNftAcceptOwnership and emits reloadRequested on success', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance;
      const reloadSpy = vi.fn();
      comp.reloadRequested.subscribe(reloadSpy);
      await comp.nftAcceptOwnership();
      expect(contractAdmin.adminNftAcceptOwnership).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminNftAcceptOwnership.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.nftAcceptOwnership();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('confirmNftPause', () => {
    it('calls adminNftPause when confirm accepted', async () => {
      const { fixture, contractAdmin } = setup();
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      fixture.componentInstance.confirmNftPause();
      await stable(fixture);
      expect(contractAdmin.adminNftPause).toHaveBeenCalled();
    });

    it('shows error on pause failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminNftPause.mockRejectedValue(new Error('fail'));
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      fixture.componentInstance.confirmNftPause();
      await stable(fixture);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('nftUnpause', () => {
    it('calls adminNftUnpause', async () => {
      const { fixture, contractAdmin } = setup();
      await fixture.componentInstance.nftUnpause();
      expect(contractAdmin.adminNftUnpause).toHaveBeenCalled();
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminNftUnpause.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.nftUnpause();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('confirmNftWithdraw', () => {
    it('calls adminNftWithdraw when confirm accepted', async () => {
      const { fixture, contractAdmin } = setup();
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      fixture.componentInstance.confirmNftWithdraw();
      await stable(fixture);
      expect(contractAdmin.adminNftWithdraw).toHaveBeenCalled();
    });

    it('shows error on withdraw failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminNftWithdraw.mockRejectedValue(new Error('fail'));
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      fixture.componentInstance.confirmNftWithdraw();
      await stable(fixture);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('template coverage', () => {
    it('shows noPendingOwner message when hasNftPendingOwner is false', () => {
      const { fixture } = setup('');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-message')).toBeTruthy();
    });

    it('shows acceptOwnership button when hasNftPendingOwner is true and triggers nftAcceptOwnership on click', async () => {
      const { fixture, contractAdmin } = setup('0x1234567890123456789012345678901234567890');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const { By } = await import('@angular/platform-browser');
      const buttons = fixture.debugElement.queryAll(By.css('p-button'));
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((b) => b.triggerEventHandler('onClick', {}));
      await fixture.whenStable();
      expect(contractAdmin.adminNftAcceptOwnership).toHaveBeenCalled();
    });

    it('fires all model changes and events in template', async () => {
      const { fixture, contractAdmin } = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const { By } = await import('@angular/platform-browser');
      const de = fixture.debugElement;
      de.queryAll(By.css('input[pInputText]')).forEach((e) => e.triggerEventHandler('ngModelChange', '0xValue'));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', 10));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', null));
      de.queryAll(By.css('app-transaction-widget')).forEach((e) =>
        e.triggerEventHandler('confirm', undefined),
      );
      de.queryAll(By.css('p-button')).forEach((e) => e.triggerEventHandler('onClick', {}));
      await fixture.whenStable();
      expect(contractAdmin.adminSetRoyalty).toHaveBeenCalled();
    });
  });
});
