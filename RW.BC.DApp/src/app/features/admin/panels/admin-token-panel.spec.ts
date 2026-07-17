import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { vi } from 'vitest';
import { AdminTokenPanel } from './admin-token-panel';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { createContractAdminServiceMock, createTokenAdminStateFixture } from '../../../../testing/web3-fakes';

function setup(tokenState = createTokenAdminStateFixture()) {
  const contractAdmin = createContractAdminServiceMock();

  TestBed.configureTestingModule({
    imports: [AdminTokenPanel],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractAdminService, useValue: contractAdmin },
      MessageService,
      ConfirmationService,
    ],
  });

  const fixture = TestBed.createComponent(AdminTokenPanel);
  fixture.componentRef.setInput('tokenState', tokenState);
  fixture.detectChanges();
  return { fixture, contractAdmin };
}

async function stable(fixture: ComponentFixture<AdminTokenPanel>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminTokenPanel', () => {
  describe('tokenState effect', () => {
    it('initializes tokenEmissionCap from tokenState input (in ether units)', async () => {
      const state = createTokenAdminStateFixture({ emissionCap: 1000000000000000000000000n });
      const { fixture } = setup(state);
      await stable(fixture);
      const comp = fixture.componentInstance as unknown as { tokenEmissionCap: () => number };
      expect(comp.tokenEmissionCap()).toBeCloseTo(1000000);
    });

    it('leaves tokenEmissionCap at default when tokenState is null', () => {
      const contractAdmin = createContractAdminServiceMock();
      TestBed.configureTestingModule({
        imports: [AdminTokenPanel],
        providers: [
          provideRouter([]),
          ...provideTranslateTesting(),
          { provide: ContractAdminService, useValue: contractAdmin },
          MessageService,
          ConfirmationService,
        ],
      });
      const fixture = TestBed.createComponent(AdminTokenPanel);
      fixture.componentRef.setInput('tokenState', null);
      fixture.detectChanges();
      const comp = fixture.componentInstance as unknown as { tokenEmissionCap: () => number };
      expect(comp.tokenEmissionCap()).toBe(0);
    });
  });

  describe('tokenSetEmissionCap', () => {
    it('calls adminTokenSetEmissionCap with bigint parsed from ether units', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        tokenEmissionCap: { set: (v: number) => void };
        tokenSetEmissionCap: () => Promise<void>;
      };
      comp.tokenEmissionCap.set(9999);
      await comp.tokenSetEmissionCap();
      expect(contractAdmin.adminTokenSetEmissionCap).toHaveBeenCalledWith(9999000000000000000000n, expect.any(Function));
    });

    it('shows success toast on success', async () => {
      const { fixture } = setup();
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { tokenSetEmissionCap: () => Promise<void> };
      await comp.tokenSetEmissionCap();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminTokenSetEmissionCap.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { tokenSetEmissionCap: () => Promise<void> };
      await comp.tokenSetEmissionCap();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('confirmTokenPause', () => {
    it('calls adminTokenPause when confirm accepted', async () => {
      const { fixture, contractAdmin } = setup();
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      fixture.componentInstance.confirmTokenPause();
      await stable(fixture);
      expect(contractAdmin.adminTokenPause).toHaveBeenCalled();
    });

    it('shows error on token pause failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminTokenPause.mockRejectedValue(new Error('fail'));
      const confirmSvc = TestBed.inject(ConfirmationService);
      vi.spyOn(confirmSvc, 'confirm').mockImplementation(({ accept }) => { accept?.(); return confirmSvc; });
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      fixture.componentInstance.confirmTokenPause();
      await stable(fixture);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('tokenUnpause', () => {
    it('calls adminTokenUnpause', async () => {
      const { fixture, contractAdmin } = setup();
      await fixture.componentInstance.tokenUnpause();
      expect(contractAdmin.adminTokenUnpause).toHaveBeenCalled();
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminTokenUnpause.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.tokenUnpause();
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
    it('renders token state summary when tokenState is provided', () => {
      const state = createTokenAdminStateFixture();
      const { fixture } = setup(state);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain(String(state.emissionCap));
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
      expect(contractAdmin.adminTokenSetEmissionCap).toHaveBeenCalled();
    });
  });
});
