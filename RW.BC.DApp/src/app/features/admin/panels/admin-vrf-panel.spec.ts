import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { AdminVrfPanel } from './admin-vrf-panel';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { createContractAdminServiceMock, createForgeVRFConfigFixture } from '../../../../testing/web3-fakes';

function setup(vrfConfig = createForgeVRFConfigFixture()) {
  const contractAdmin = createContractAdminServiceMock();

  TestBed.configureTestingModule({
    imports: [AdminVrfPanel],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractAdminService, useValue: contractAdmin },
      MessageService,
    ],
  });

  const fixture = TestBed.createComponent(AdminVrfPanel);
  fixture.componentRef.setInput('vrfConfig', vrfConfig);
  fixture.detectChanges();
  return { fixture, contractAdmin };
}

async function stable(fixture: ComponentFixture<AdminVrfPanel>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminVrfPanel', () => {
  describe('vrfConfig effect', () => {
    it('initializes signals from vrfConfig input', async () => {
      const cfg = createForgeVRFConfigFixture({
        keyHash: '0xABC',
        subId: 42n,
        callbackGasLimit: 300000,
        requestConfirmations: 5,
      });
      const { fixture } = setup(cfg);
      await stable(fixture);
      const comp = fixture.componentInstance as unknown as {
        vrfKeyHash: () => string;
        vrfSubId: () => number;
        vrfCallbackGasLimit: () => number;
        vrfRequestConfirmations: () => number;
      };
      expect(comp.vrfKeyHash()).toBe('0xABC');
      expect(comp.vrfSubId()).toBe(42);
      expect(comp.vrfCallbackGasLimit()).toBe(300000);
      expect(comp.vrfRequestConfirmations()).toBe(5);
    });

    it('leaves signals at defaults when vrfConfig is null', () => {
      const contractAdmin = createContractAdminServiceMock();
      TestBed.configureTestingModule({
        imports: [AdminVrfPanel],
        providers: [
          provideRouter([]),
          ...provideTranslateTesting(),
          { provide: ContractAdminService, useValue: contractAdmin },
          MessageService,
        ],
      });
      const fixture = TestBed.createComponent(AdminVrfPanel);
      fixture.componentRef.setInput('vrfConfig', null);
      fixture.detectChanges();
      const comp = fixture.componentInstance as unknown as {
        vrfKeyHash: () => string;
        vrfSubId: () => number;
        vrfCallbackGasLimit: () => number;
        vrfRequestConfirmations: () => number;
      };
      expect(comp.vrfKeyHash()).toBe('');
      expect(comp.vrfSubId()).toBe(0);
      expect(comp.vrfCallbackGasLimit()).toBe(200000);
      expect(comp.vrfRequestConfirmations()).toBe(3);
    });
  });

  describe('forgeSetVRFConfig', () => {
    it('calls adminForgeSetVRFConfig with correct config', async () => {
      const { fixture, contractAdmin } = setup();
      const comp = fixture.componentInstance as unknown as {
        vrfKeyHash: { set: (v: string) => void };
        vrfSubId: { set: (v: number) => void };
        vrfCallbackGasLimit: { set: (v: number) => void };
        vrfRequestConfirmations: { set: (v: number) => void };
        forgeSetVRFConfig: () => Promise<void>;
      };
      comp.vrfKeyHash.set('0xABC123');
      comp.vrfSubId.set(42);
      comp.vrfCallbackGasLimit.set(300000);
      comp.vrfRequestConfirmations.set(5);
      await comp.forgeSetVRFConfig();
      expect(contractAdmin.adminForgeSetVRFConfig).toHaveBeenCalledWith(
        { keyHash: '0xABC123', subId: 42n, callbackGasLimit: 300000, requestConfirmations: 5 },
        expect.any(Function),
      );
    });

    it('shows success toast on success', async () => {
      const { fixture } = setup();
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { forgeSetVRFConfig: () => Promise<void> };
      await comp.forgeSetVRFConfig();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('shows error on failure', async () => {
      const { fixture, contractAdmin } = setup();
      contractAdmin.adminForgeSetVRFConfig.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as { forgeSetVRFConfig: () => Promise<void> };
      await comp.forgeSetVRFConfig();
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
    it('renders VRF config fieldset with all inputs', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-fieldset')).toBeTruthy();
    });

    it('fires all model changes and confirm events in template', async () => {
      const { fixture, contractAdmin } = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const { By } = await import('@angular/platform-browser');
      const de = fixture.debugElement;
      de.queryAll(By.css('input[pInputText]')).forEach((e) => e.triggerEventHandler('ngModelChange', '0xABC'));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', 42));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', null));
      de.queryAll(By.css('app-transaction-widget')).forEach((e) =>
        e.triggerEventHandler('confirm', undefined),
      );
      await fixture.whenStable();
      expect(contractAdmin.adminForgeSetVRFConfig).toHaveBeenCalled();
    });
  });
});
