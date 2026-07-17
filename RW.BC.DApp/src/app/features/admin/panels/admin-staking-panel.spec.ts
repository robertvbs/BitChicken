import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { vi } from 'vitest';
import { AdminStakingPanel } from './admin-staking-panel';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { createContractAdminServiceMock, createStakingConfigFixture } from '../../../../testing/web3-fakes';

function setup(stakingPendingOwner = '') {
  const contractAdmin = createContractAdminServiceMock();
  const cfg = createStakingConfigFixture();

  TestBed.configureTestingModule({
    imports: [AdminStakingPanel],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractAdminService, useValue: contractAdmin },
      MessageService,
      ConfirmationService,
    ],
  });

  const fixture = TestBed.createComponent(AdminStakingPanel);
  fixture.componentRef.setInput('stakingConfig', cfg);
  fixture.componentRef.setInput('stakingPendingOwner', stakingPendingOwner);
  fixture.detectChanges();
  return { fixture, contractAdmin, cfg };
}

async function stable(fixture: ComponentFixture<AdminStakingPanel>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminStakingPanel', () => {
  describe('stakingConfig effect', () => {
    it('initializes rate/weight signals from stakingConfig input', async () => {
      const { fixture, cfg } = setup();
      await stable(fixture);
      const comp = fixture.componentInstance as unknown as {
        stakingBaseRate: () => number;
        stakingWHealth: () => number;
        stakingWSkill: () => number;
        stakingWMorale: () => number;
        stakingClaimBurnBps: () => number;
        stakingIdealMultiplierBps: () => number;
      };
      expect(comp.stakingBaseRate()).toBe(Number(cfg.baseRate));
      expect(comp.stakingWHealth()).toBe(Number(cfg.wHealth));
      expect(comp.stakingWSkill()).toBe(Number(cfg.wSkill));
      expect(comp.stakingWMorale()).toBe(Number(cfg.wMorale));
      expect(comp.stakingClaimBurnBps()).toBe(Number(cfg.claimBurnBps));
      expect(comp.stakingIdealMultiplierBps()).toBe(Number(cfg.idealPairMultiplierBps));
    });
  });

  describe('hasStakingPendingOwner computed', () => {
    it('is false when pending owner is empty', () => {
      const { fixture } = setup('');
      const comp = fixture.componentInstance as unknown as { hasStakingPendingOwner: () => boolean };
      expect(comp.hasStakingPendingOwner()).toBe(false);
    });

    it('is false when pending owner is zero address', () => {
      const { fixture } = setup('0x0000000000000000000000000000000000000000');
      const comp = fixture.componentInstance as unknown as { hasStakingPendingOwner: () => boolean };
      expect(comp.hasStakingPendingOwner()).toBe(false);
    });

    it('is true when pending owner is a real address', () => {
      const { fixture } = setup('0x1234567890123456789012345678901234567890');
      const comp = fixture.componentInstance as unknown as { hasStakingPendingOwner: () => boolean };
      expect(comp.hasStakingPendingOwner()).toBe(true);
    });
  });

  describe('stakingSetBaseRate', () => {
    it('calls adminStakingSetBaseRate with bigint', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        stakingBaseRate: { set: (v: number) => void };
        stakingSetBaseRate: () => Promise<void>;
      };
      comp.stakingBaseRate.set(1500);
      await comp.stakingSetBaseRate();
      expect(contractAdmin.adminStakingSetBaseRate).toHaveBeenCalledWith(1500n, expect.any(Function));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminStakingSetBaseRate.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { stakingSetBaseRate: () => Promise<void> };
      await comp.stakingSetBaseRate();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('stakingSetWeights', () => {
    it('calls adminStakingSetWeights with three bigint weights', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        stakingWHealth: { set: (v: number) => void };
        stakingWSkill: { set: (v: number) => void };
        stakingWMorale: { set: (v: number) => void };
        stakingSetWeights: () => Promise<void>;
      };
      comp.stakingWHealth.set(100);
      comp.stakingWSkill.set(200);
      comp.stakingWMorale.set(300);
      await comp.stakingSetWeights();
      expect(contractAdmin.adminStakingSetWeights).toHaveBeenCalledWith(100n, 200n, 300n, expect.any(Function));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminStakingSetWeights.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { stakingSetWeights: () => Promise<void> };
      await comp.stakingSetWeights();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('stakingSetClaimBurnBps', () => {
    it('calls adminStakingSetClaimBurnBps', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        stakingClaimBurnBps: { set: (v: number) => void };
        stakingSetClaimBurnBps: () => Promise<void>;
      };
      comp.stakingClaimBurnBps.set(200);
      await comp.stakingSetClaimBurnBps();
      expect(contractAdmin.adminStakingSetClaimBurnBps).toHaveBeenCalledWith(200n, expect.any(Function));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminStakingSetClaimBurnBps.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { stakingSetClaimBurnBps: () => Promise<void> };
      await comp.stakingSetClaimBurnBps();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('stakingSetIdealPairMultiplierBps', () => {
    it('calls adminStakingSetIdealPairMultiplierBps', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        stakingIdealMultiplierBps: { set: (v: number) => void };
        stakingSetIdealPairMultiplierBps: () => Promise<void>;
      };
      comp.stakingIdealMultiplierBps.set(25000);
      await comp.stakingSetIdealPairMultiplierBps();
      expect(contractAdmin.adminStakingSetIdealPairMultiplierBps).toHaveBeenCalledWith(25000n, expect.any(Function));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminStakingSetIdealPairMultiplierBps.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { stakingSetIdealPairMultiplierBps: () => Promise<void> };
      await comp.stakingSetIdealPairMultiplierBps();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('stakingAcceptOwnership', () => {
    it('calls adminStakingAcceptOwnership and emits reloadRequested', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance;
      const reloadSpy = vi.fn();
      comp.reloadRequested.subscribe(reloadSpy);
      await comp.stakingAcceptOwnership();
      expect(contractAdmin.adminStakingAcceptOwnership).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminStakingAcceptOwnership.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.stakingAcceptOwnership();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('confirmStakingPause', () => {
    it('calls adminStakingPause when confirm accepted', async () => {
      const { fixture, contractAdmin } = setup();
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      fixture.componentInstance.confirmStakingPause();
      await stable(fixture);
      expect(contractAdmin.adminStakingPause).toHaveBeenCalled();
    });

    it('shows error on staking pause failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminStakingPause.mockRejectedValue(new Error('fail'));
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      fixture.componentInstance.confirmStakingPause();
      await stable(fixture);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('stakingUnpause', () => {
    it('calls adminStakingUnpause', async () => {
      const { fixture, contractAdmin } = setup();
      await fixture.componentInstance.stakingUnpause();
      expect(contractAdmin.adminStakingUnpause).toHaveBeenCalled();
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminStakingUnpause.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.stakingUnpause();
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
    it('renders staking config summary when stakingConfig is provided', () => {
      const { fixture, cfg } = setup();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain(String(cfg.baseRate));
    });

    it('shows noPendingOwner message when hasStakingPendingOwner is false', () => {
      const { fixture } = setup('');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-message')).toBeTruthy();
    });

    it('shows acceptOwnership button when hasStakingPendingOwner is true and triggers stakingAcceptOwnership on click', async () => {
      const { fixture, contractAdmin } = setup('0x1234567890123456789012345678901234567890');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const { By } = await import('@angular/platform-browser');
      const buttons = fixture.debugElement.queryAll(By.css('p-button'));
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((b) => b.triggerEventHandler('onClick', {}));
      await fixture.whenStable();
      expect(contractAdmin.adminStakingAcceptOwnership).toHaveBeenCalled();
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
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', 100));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', null));
      de.queryAll(By.css('app-transaction-widget')).forEach((e) =>
        e.triggerEventHandler('confirm', undefined),
      );
      de.queryAll(By.css('p-button')).forEach((e) => e.triggerEventHandler('onClick', {}));
      await fixture.whenStable();
      expect(contractAdmin.adminStakingSetBaseRate).toHaveBeenCalled();
    });
  });
});
