import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { vi } from 'vitest';
import { AdminMarketplacePanel } from './admin-marketplace-panel';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { createContractAdminServiceMock, createMarketplaceFeeConfigFixture } from '../../../../testing/web3-fakes';

function setup(pendingOwner = '') {
  const contractAdmin = createContractAdminServiceMock();
  const feeConfig = createMarketplaceFeeConfigFixture();

  TestBed.configureTestingModule({
    imports: [AdminMarketplacePanel],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractAdminService, useValue: contractAdmin },
      MessageService,
      ConfirmationService,
    ],
  });

  const fixture = TestBed.createComponent(AdminMarketplacePanel);
  fixture.componentRef.setInput('marketplaceFee', feeConfig);
  fixture.componentRef.setInput('marketplacePendingOwner', pendingOwner);
  fixture.detectChanges();
  return { fixture, contractAdmin, feeConfig };
}

async function stable(fixture: ComponentFixture<AdminMarketplacePanel>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminMarketplacePanel', () => {
  describe('marketplaceFee effect', () => {
    it('initializes feeSink and feeBps from marketplaceFee input', async () => {
      const cfg = createMarketplaceFeeConfigFixture({ feeSink: '0xFEESINK', platformFeeBps: 300n });
      const contractAdmin = createContractAdminServiceMock();
      TestBed.configureTestingModule({
        imports: [AdminMarketplacePanel],
        providers: [
          provideRouter([]),
          ...provideTranslateTesting(),
          { provide: ContractAdminService, useValue: contractAdmin },
          MessageService,
          ConfirmationService,
        ],
      });
      const fixture = TestBed.createComponent(AdminMarketplacePanel);
      fixture.componentRef.setInput('marketplaceFee', cfg);
      fixture.componentRef.setInput('marketplacePendingOwner', '');
      fixture.detectChanges();
      await stable(fixture);
      const comp = fixture.componentInstance as unknown as {
        marketplaceFeeSink: () => string;
        marketplaceFeeBps: () => number;
      };
      expect(comp.marketplaceFeeSink()).toBe('0xFEESINK');
      expect(comp.marketplaceFeeBps()).toBe(300);
    });

    it('leaves signals at defaults when marketplaceFee is null', () => {
      const contractAdmin = createContractAdminServiceMock();
      TestBed.configureTestingModule({
        imports: [AdminMarketplacePanel],
        providers: [
          provideRouter([]),
          ...provideTranslateTesting(),
          { provide: ContractAdminService, useValue: contractAdmin },
          MessageService,
          ConfirmationService,
        ],
      });
      const fixture = TestBed.createComponent(AdminMarketplacePanel);
      fixture.componentRef.setInput('marketplaceFee', null);
      fixture.componentRef.setInput('marketplacePendingOwner', '');
      fixture.detectChanges();
      const comp = fixture.componentInstance as unknown as {
        marketplaceFeeSink: () => string;
        marketplaceFeeBps: () => number;
      };
      expect(comp.marketplaceFeeSink()).toBe('');
      expect(comp.marketplaceFeeBps()).toBe(0);
    });
  });

  describe('hasMarketplacePendingOwner computed', () => {
    it('is false when pending owner is empty', () => {
      const { fixture } = setup('');
      const comp = fixture.componentInstance as unknown as { hasMarketplacePendingOwner: () => boolean };
      expect(comp.hasMarketplacePendingOwner()).toBe(false);
    });

    it('is false when pending owner is zero address', () => {
      const { fixture } = setup('0x0000000000000000000000000000000000000000');
      const comp = fixture.componentInstance as unknown as { hasMarketplacePendingOwner: () => boolean };
      expect(comp.hasMarketplacePendingOwner()).toBe(false);
    });

    it('is true when pending owner is a real address', () => {
      const { fixture } = setup('0x1234567890123456789012345678901234567890');
      const comp = fixture.componentInstance as unknown as { hasMarketplacePendingOwner: () => boolean };
      expect(comp.hasMarketplacePendingOwner()).toBe(true);
    });
  });

  describe('confirmMarketplaceSetFee', () => {
    it('calls adminMarketplaceSetPlatformFee with correct params on confirm', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        marketplaceFeeSink: { set: (v: string) => void };
        marketplaceFeeBps: { set: (v: number) => void };
        confirmMarketplaceSetFee: () => void;
      };
      comp.marketplaceFeeSink.set('0xFEESINK');
      comp.marketplaceFeeBps.set(300);
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      comp.confirmMarketplaceSetFee();
      await stable(fixture);
      expect(contractAdmin.adminMarketplaceSetPlatformFee).toHaveBeenCalledWith('0xFEESINK', 300n, expect.any(Function));
    });

    it('shows error on marketplace fee failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminMarketplaceSetPlatformFee.mockRejectedValue(new Error('fail'));
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { confirmMarketplaceSetFee: () => void };
      comp.confirmMarketplaceSetFee();
      await stable(fixture);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('marketplaceAcceptOwnership', () => {
    it('calls adminMarketplaceAcceptOwnership and emits reloadRequested', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance;
      const reloadSpy = vi.fn();
      comp.reloadRequested.subscribe(reloadSpy);
      await comp.marketplaceAcceptOwnership();
      expect(contractAdmin.adminMarketplaceAcceptOwnership).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminMarketplaceAcceptOwnership.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.marketplaceAcceptOwnership();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('confirmMarketplacePause', () => {
    it('calls adminMarketplacePause when confirm accepted', async () => {
      const { fixture, contractAdmin } = setup();
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      fixture.componentInstance.confirmMarketplacePause();
      await stable(fixture);
      expect(contractAdmin.adminMarketplacePause).toHaveBeenCalled();
    });

    it('shows error on marketplace pause failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminMarketplacePause.mockRejectedValue(new Error('fail'));
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      fixture.componentInstance.confirmMarketplacePause();
      await stable(fixture);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('marketplaceUnpause', () => {
    it('calls adminMarketplaceUnpause', async () => {
      const { fixture, contractAdmin } = setup();
      await fixture.componentInstance.marketplaceUnpause();
      expect(contractAdmin.adminMarketplaceUnpause).toHaveBeenCalled();
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminMarketplaceUnpause.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.marketplaceUnpause();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('isBusy computed', () => {
    it('is false initially', () => {
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

  describe('template coverage', () => {
    it('renders fee summary when marketplaceFee is provided', () => {
      const { fixture, feeConfig } = setup();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain(feeConfig.feeSink);
    });

    it('shows noPendingOwner message when hasMarketplacePendingOwner is false', () => {
      const { fixture } = setup('');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-message')).toBeTruthy();
    });

    it('shows acceptOwnership button when hasMarketplacePendingOwner is true and triggers marketplaceAcceptOwnership on click', async () => {
      const { fixture, contractAdmin } = setup('0x1234567890123456789012345678901234567890');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const { By } = await import('@angular/platform-browser');
      const buttons = fixture.debugElement.queryAll(By.css('p-button'));
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((b) => b.triggerEventHandler('onClick', {}));
      await fixture.whenStable();
      expect(contractAdmin.adminMarketplaceAcceptOwnership).toHaveBeenCalled();
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
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', 100));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', null));
      de.queryAll(By.css('app-transaction-widget')).forEach((e) =>
        e.triggerEventHandler('confirm', undefined),
      );
      de.queryAll(By.css('p-button')).forEach((e) => e.triggerEventHandler('onClick', {}));
      await fixture.whenStable();
      expect(contractAdmin.adminMarketplaceSetPlatformFee).toHaveBeenCalled();
    });
  });
});
