import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { vi } from 'vitest';
import { AdminForgePanel } from './admin-forge-panel';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { createContractAdminServiceMock } from '../../../../testing/web3-fakes';
import { environment } from '../../../../environments/environment';

const ADMIN = environment.admin;

function setup(forgeOwner = '', mintTiers: { index: number; price: bigint }[] | null = null) {
  const contractAdmin = createContractAdminServiceMock();

  TestBed.configureTestingModule({
    imports: [AdminForgePanel],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractAdminService, useValue: contractAdmin },
      MessageService,
      ConfirmationService,
    ],
  });

  const fixture = TestBed.createComponent(AdminForgePanel);
  fixture.componentRef.setInput('forgeOwner', forgeOwner);
  fixture.componentRef.setInput('mintTiers', mintTiers);
  fixture.detectChanges();
  return { fixture, contractAdmin };
}

async function stable(fixture: ComponentFixture<AdminForgePanel>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminForgePanel', () => {
  describe('isForgeOwner computed', () => {
    it('returns true when forge owner matches admin address', () => {
      const { fixture } = setup(ADMIN);
      const comp = fixture.componentInstance as unknown as { isForgeOwner: () => boolean };
      expect(comp.isForgeOwner()).toBe(true);
    });

    it('returns false when forge owner does not match admin', () => {
      const { fixture } = setup('0x0000000000000000000000000000000000000000');
      const comp = fixture.componentInstance as unknown as { isForgeOwner: () => boolean };
      expect(comp.isForgeOwner()).toBe(false);
    });

    it('returns false when forge owner is empty', () => {
      const { fixture } = setup('');
      const comp = fixture.componentInstance as unknown as { isForgeOwner: () => boolean };
      expect(comp.isForgeOwner()).toBe(false);
    });
  });

  describe('mintTiers effect', () => {
    it('initializes tierPriceInputs from mintTiers input', async () => {
      const tiers = [
        { index: 0, price: 100000000000000000n },
        { index: 1, price: 200000000000000000n },
      ];
      const { fixture } = setup('', tiers);
      await stable(fixture);
      const comp = fixture.componentInstance;
      expect(comp.getTierPriceInput(0)).toBeCloseTo(0.1, 8);
      expect(comp.getTierPriceInput(1)).toBeCloseTo(0.2, 8);
      expect(comp.getTierPriceInput(2)).toBe(0);
    });

    it('leaves tierPriceInputs at default zeros when mintTiers is null', () => {
      const { fixture } = setup('', null);
      const comp = fixture.componentInstance;
      for (let i = 0; i < 10; i++) {
        expect(comp.getTierPriceInput(i)).toBe(0);
      }
    });
  });

  describe('getTierPriceInput / updateTierPriceInput', () => {
    it('returns 0 for uninitialised index', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.getTierPriceInput(5)).toBe(0);
    });

    it('returns 0 for out-of-bounds index via ?? fallback', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.getTierPriceInput(99)).toBe(0);
    });

    it('sets value at index', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance;
      comp.updateTierPriceInput(2, 0.5);
      expect(comp.getTierPriceInput(2)).toBe(0.5);
    });
  });

  describe('updateTierPrices', () => {
    it('calls adminUpdateTierPrices with converted bigint prices', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance;
      comp.updateTierPriceInput(0, 0.1);
      comp.updateTierPriceInput(1, 0.2);
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await comp.updateTierPrices();
      expect(contractAdmin.adminUpdateTierPrices).toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('shows error toast when updateTierPrices fails', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminUpdateTierPrices.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.updateTierPrices();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('forgeAcceptOwnership', () => {
    it('calls adminForgeAcceptOwnership and emits reloadRequested', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance;
      const reloadSpy = vi.fn();
      comp.reloadRequested.subscribe(reloadSpy);
      await comp.forgeAcceptOwnership();
      expect(contractAdmin.adminForgeAcceptOwnership).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('shows error when acceptOwnership fails', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminForgeAcceptOwnership.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.forgeAcceptOwnership();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('confirmForgeWithdraw', () => {
    it('calls adminForgeWithdraw when confirm accepted', async () => {
      const { fixture, contractAdmin } = setup();
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      fixture.componentInstance.confirmForgeWithdraw();
      await stable(fixture);
      expect(contractAdmin.adminForgeWithdraw).toHaveBeenCalled();
    });

    it('shows error on withdraw failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminForgeWithdraw.mockRejectedValue(new Error('fail'));
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      fixture.componentInstance.confirmForgeWithdraw();
      await stable(fixture);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
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

  describe('template coverage', () => {
    it('shows already-owner tag when isForgeOwner is true', async () => {
      const { fixture } = setup(ADMIN);
      await stable(fixture);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-tag')).toBeTruthy();
    });

    it('shows accept-ownership button when isForgeOwner is false', async () => {
      const { fixture } = setup('0x0000000000000000000000000000000000000000');
      await stable(fixture);
      const { By } = await import('@angular/platform-browser');
      const de = fixture.debugElement;
      const buttons = de.queryAll(By.css('p-button'));
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('fires all model changes and confirm/click events in template', async () => {
      const { fixture, contractAdmin } = setup('', [{ index: 0, price: 100000000000000000n }]);
      await stable(fixture);
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const { By } = await import('@angular/platform-browser');
      const de = fixture.debugElement;
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', 1));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', null));
      de.queryAll(By.css('app-transaction-widget')).forEach((e) =>
        e.triggerEventHandler('confirm', undefined),
      );
      de.queryAll(By.css('p-button')).forEach((e) => e.triggerEventHandler('onClick', {}));
      await fixture.whenStable();
      expect(contractAdmin.adminUpdateTierPrices).toHaveBeenCalled();
    });
  });
});
