import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { vi } from 'vitest';
import { AdminEditionsPanel } from './admin-editions-panel';
import { ContractReadService } from '../../../core/web3/contract-read.service';
import { ContractAdminService } from '../../../core/web3/contract-admin.service';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import {
  createContractReadServiceMock,
  createContractAdminServiceMock,
  createEditionFixture,
} from '../../../../testing/web3-fakes';
import { PinataUploadService } from '../../../core/ipfs/pinata-upload.service';

function setup(catalog = [createEditionFixture()]) {
  const contractRead = createContractReadServiceMock();
  const contractAdmin = createContractAdminServiceMock();
  const contract = { ...contractRead, ...contractAdmin };

  TestBed.configureTestingModule({
    imports: [AdminEditionsPanel],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractReadService, useValue: contract },
      { provide: ContractAdminService, useValue: contract },
      MessageService,
      ConfirmationService,
    ],
  });

  const fixture = TestBed.createComponent(AdminEditionsPanel);
  fixture.componentRef.setInput('catalog', catalog);
  fixture.detectChanges();
  return { fixture, contract };
}

async function stable(fixture: ComponentFixture<AdminEditionsPanel>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminEditionsPanel', () => {
  describe('previewUrl computed', () => {
    it('returns empty string when no artURI', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        regArtURI: { set: (v: string) => void };
        previewUrl: () => string;
      };
      comp.regArtURI.set('');
      expect(comp.previewUrl()).toBe('');
    });

    it('returns full URL when artURI starts with http', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        regArtURI: { set: (v: string) => void };
        previewUrl: () => string;
      };
      comp.regArtURI.set('https://example.com/image.png');
      expect(comp.previewUrl()).toBe('https://example.com/image.png');
    });

    it('prepends ipfsGateway for CID', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        regArtURI: { set: (v: string) => void };
        previewUrl: () => string;
      };
      comp.regArtURI.set('QmTest');
      const preview = comp.previewUrl();
      expect(preview).toContain('QmTest');
      expect(preview).toContain('ipfs');
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

  describe('updateTierWeight / getTierWeight', () => {
    it('sets and gets tier weight at index', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance;
      comp.updateTierWeight(3, 15);
      expect(comp.getTierWeight(3)).toBe(15);
    });

    it('returns 0 for unset weights', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.getTierWeight(5)).toBe(0);
    });

    it('returns 0 for out-of-bounds index via ?? fallback', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.getTierWeight(99)).toBe(0);
    });
  });

  describe('formatEditionPrice', () => {
    it('formats bigint price to BNB string', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.formatEditionPrice(100000000000000000n)).toBe('0.1');
    });
  });

  describe('savePinataJwt', () => {
    it('calls pinata.setJwt and shows success toast', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        pinataJwt: { set: (v: string) => void };
        savePinataJwt: () => void;
      };
      comp.pinataJwt.set('my-test-jwt');
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      comp.savePinataJwt();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });
  });

  describe('handleImageUpload', () => {
    it('does nothing when no file is selected', async () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        uploading: () => boolean;
        handleImageUpload: (e: Event) => Promise<void>;
      };
      const event = { target: { files: [] } } as unknown as Event;
      await comp.handleImageUpload(event);
      expect(comp.uploading()).toBe(false);
    });

    it('does nothing when input.files is undefined', async () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        uploading: () => boolean;
        handleImageUpload: (e: Event) => Promise<void>;
      };
      const event = { target: { files: undefined } } as unknown as Event;
      await comp.handleImageUpload(event);
      expect(comp.uploading()).toBe(false);
    });

    it('uploads file and shows success toast', async () => {
      const { fixture } = setup();
      const pinata = TestBed.inject(PinataUploadService);
      vi.spyOn(pinata, 'uploadImage').mockResolvedValue('QmUploadedCID');
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as {
        regArtURI: () => string;
        uploading: () => boolean;
        handleImageUpload: (e: Event) => Promise<void>;
      };
      const file = new File(['data'], 'nft.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      await comp.handleImageUpload(event);
      expect(comp.regArtURI()).toBe('ipfs://QmUploadedCID');
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
      expect(comp.uploading()).toBe(false);
    });

    it('shows error toast when upload fails', async () => {
      const { fixture } = setup();
      const pinata = TestBed.inject(PinataUploadService);
      vi.spyOn(pinata, 'uploadImage').mockRejectedValue(new Error('network error'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      const comp = fixture.componentInstance as unknown as {
        uploading: () => boolean;
        handleImageUpload: (e: Event) => Promise<void>;
      };
      const file = new File(['data'], 'nft.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      await comp.handleImageUpload(event);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
      expect(comp.uploading()).toBe(false);
    });
  });

  describe('registerEdition', () => {
    it('calls adminRegisterEdition with correct params including tierWeights', async () => {
      const { fixture, contract } = setup();
      const comp = fixture.componentInstance;
      const priv = comp as unknown as {
        regName: { set: (v: string) => void };
        regArtURI: { set: (v: string) => void };
        regHealth: { set: (v: number) => void };
        regSkill: { set: (v: number) => void };
        regMorale: { set: (v: number) => void };
        regRarity: { set: (v: number) => void };
        regMaxSupply: { set: (v: number) => void };
        regPrice: { set: (v: number) => void };
        regDistribution: { set: (v: number) => void };
        regMintStart: { set: (v: null) => void };
        regMintEnd: { set: (v: null) => void };
      };
      priv.regName.set('Test Hen');
      priv.regArtURI.set('QmTestCID');
      priv.regHealth.set(80);
      priv.regSkill.set(70);
      priv.regMorale.set(60);
      priv.regRarity.set(1);
      priv.regMaxSupply.set(500);
      priv.regPrice.set(0.1);
      priv.regDistribution.set(0);
      priv.regMintStart.set(null);
      priv.regMintEnd.set(null);
      comp.updateTierWeight(0, 10);
      comp.updateTierWeight(1, 20);

      await comp.registerEdition();

      expect(contract.adminRegisterEdition).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Hen',
          artURI: 'QmTestCID',
          health: 80,
          skill: 70,
          morale: 60,
          rarity: 1,
          maxSupply: 500,
          mintStart: 0,
          mintEnd: 0,
          price: BigInt(Math.round(0.1 * 1e18)),
          distribution: 0,
          tierWeights: [10, 20, 0, 0, 0, 0, 0, 0, 0, 0],
        }),
        expect.any(Function),
      );
    });

    it('converts Date to unix timestamps for mintStart/mintEnd', async () => {
      const { fixture, contract } = setup();
      const comp = fixture.componentInstance;
      const priv = comp as unknown as {
        regMintStart: { set: (v: Date) => void };
        regMintEnd: { set: (v: Date) => void };
      };
      const date = new Date('2025-01-01T00:00:00Z');
      priv.regMintStart.set(date);
      priv.regMintEnd.set(date);
      await comp.registerEdition();
      expect(contract.adminRegisterEdition).toHaveBeenCalledWith(
        expect.objectContaining({
          mintStart: Math.floor(date.getTime() / 1000),
          mintEnd: Math.floor(date.getTime() / 1000),
        }),
        expect.any(Function),
      );
    });

    it('shows success toast and emits reloadRequested after successful registration', async () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance;
      const reloadSpy = vi.fn();
      comp.reloadRequested.subscribe(reloadSpy);
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await comp.registerEdition();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('shows error toast when registration fails', async () => {
      const { fixture, contract } = setup();
      contract.adminRegisterEdition.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.registerEdition();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('toggleEditionActive', () => {
    it('calls adminSetEditionActive with toggled value (true→false)', async () => {
      const { fixture, contract } = setup();
      const edition = createEditionFixture({ active: true });
      await fixture.componentInstance.toggleEditionActive(edition);
      expect(contract.adminSetEditionActive).toHaveBeenCalledWith(edition.id, false, expect.any(Function));
    });

    it('toggles false→true for inactive edition', async () => {
      const { fixture, contract } = setup();
      const edition = createEditionFixture({ active: false });
      await fixture.componentInstance.toggleEditionActive(edition);
      expect(contract.adminSetEditionActive).toHaveBeenCalledWith(edition.id, true, expect.any(Function));
    });

    it('shows error toast when toggle fails', async () => {
      const { fixture, contract } = setup();
      contract.adminSetEditionActive.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await fixture.componentInstance.toggleEditionActive(createEditionFixture());
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('openWindowEditor', () => {
    it('sets windowEditionId and opens dialog with null dates for zero timestamps', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance;
      const edition = createEditionFixture({ id: 3n, mintStart: 0, mintEnd: 0 });
      comp.openWindowEditor(edition);
      const priv = comp as unknown as {
        windowEditionId: () => bigint | null;
        windowMintStart: () => Date | null;
        windowMintEnd: () => Date | null;
        windowDialogVisible: () => boolean;
      };
      expect(priv.windowEditionId()).toBe(3n);
      expect(priv.windowMintStart()).toBeNull();
      expect(priv.windowMintEnd()).toBeNull();
      expect(priv.windowDialogVisible()).toBe(true);
    });

    it('converts non-zero mintStart/mintEnd to Date objects', () => {
      const { fixture } = setup();
      const edition = createEditionFixture({ id: 7n, mintStart: 1700000000, mintEnd: 1800000000 });
      fixture.componentInstance.openWindowEditor(edition);
      const priv = fixture.componentInstance as unknown as {
        windowMintStart: () => Date | null;
        windowMintEnd: () => Date | null;
      };
      expect(priv.windowMintStart()).toBeInstanceOf(Date);
      expect(priv.windowMintEnd()).toBeInstanceOf(Date);
    });
  });

  describe('saveEditionWindow', () => {
    it('does nothing when windowEditionId is null', async () => {
      const { fixture, contract } = setup();
      const comp = fixture.componentInstance as unknown as {
        windowEditionId: { set: (v: null) => void };
        saveEditionWindow: () => Promise<void>;
      };
      comp.windowEditionId.set(null);
      await comp.saveEditionWindow();
      expect(contract.adminSetEditionWindow).not.toHaveBeenCalled();
    });

    it('calls adminSetEditionWindow and closes dialog on success', async () => {
      const { fixture, contract } = setup();
      const comp = fixture.componentInstance;
      const priv = comp as unknown as {
        windowEditionId: { set: (v: bigint) => void };
        windowMintStart: { set: (v: null) => void };
        windowMintEnd: { set: (v: null) => void };
        windowDialogVisible: () => boolean;
        saveEditionWindow: () => Promise<void>;
      };
      priv.windowEditionId.set(2n);
      priv.windowMintStart.set(null);
      priv.windowMintEnd.set(null);
      await priv.saveEditionWindow();
      expect(contract.adminSetEditionWindow).toHaveBeenCalledWith(2n, 0, 0, expect.any(Function));
      expect(priv.windowDialogVisible()).toBe(false);
    });

    it('uses Date values for start/end when set', async () => {
      const { fixture, contract } = setup();
      const comp = fixture.componentInstance;
      const priv = comp as unknown as {
        windowEditionId: { set: (v: bigint) => void };
        windowMintStart: { set: (v: Date) => void };
        windowMintEnd: { set: (v: Date) => void };
        saveEditionWindow: () => Promise<void>;
      };
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-12-31T00:00:00Z');
      priv.windowEditionId.set(4n);
      priv.windowMintStart.set(start);
      priv.windowMintEnd.set(end);
      await priv.saveEditionWindow();
      expect(contract.adminSetEditionWindow).toHaveBeenCalledWith(
        4n,
        Math.floor(start.getTime() / 1000),
        Math.floor(end.getTime() / 1000),
        expect.any(Function),
      );
    });

    it('emits reloadRequested after success', async () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance;
      const reloadSpy = vi.fn();
      comp.reloadRequested.subscribe(reloadSpy);
      const priv = comp as unknown as {
        windowEditionId: { set: (v: bigint) => void };
        saveEditionWindow: () => Promise<void>;
      };
      priv.windowEditionId.set(1n);
      await priv.saveEditionWindow();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('shows error toast when saveEditionWindow fails', async () => {
      const { fixture, contract } = setup();
      const comp = fixture.componentInstance;
      const priv = comp as unknown as {
        windowEditionId: { set: (v: bigint) => void };
        saveEditionWindow: () => Promise<void>;
      };
      priv.windowEditionId.set(1n);
      contract.adminSetEditionWindow.mockRejectedValue(new Error('fail'));
      const messages = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messages, 'add');
      await priv.saveEditionWindow();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('rarityOptions and distributionOptions', () => {
    it('rarityOptions returns 5 rarity levels', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as { rarityOptions: () => unknown[] };
      expect(comp.rarityOptions()).toHaveLength(5);
    });

    it('distributionOptions returns 1 option', () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as { distributionOptions: () => unknown[] };
      expect(comp.distributionOptions()).toHaveLength(1);
    });
  });

  describe('template coverage', () => {
    it('renders uploading spinner when uploading is true', async () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as { uploading: { set: (v: boolean) => void } };
      comp.uploading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pi-spinner')).toBeTruthy();
    });

    it('renders art preview when previewUrl returns a value', async () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        regArtURI: { set: (v: string) => void };
        previewUrl: () => string;
      };
      comp.regArtURI.set('https://example.com/test.png');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('img[alt="art preview"]')).toBeTruthy();
    });

    it('renders catalog table with editions and fires model changes', async () => {
      const catalog = [
        createEditionFixture({ id: 1n, maxSupply: 0, rarity: 0 }),
        createEditionFixture({ id: 2n, maxSupply: 1000, rarity: 4 }),
      ];
      const { fixture, contract } = setup(catalog);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-table')).toBeTruthy();
      const { By } = await import('@angular/platform-browser');
      const de = fixture.debugElement;
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', 1));
      de.queryAll(By.css('p-inputnumber')).forEach((e) => e.triggerEventHandler('ngModelChange', null));
      de.queryAll(By.css('p-select')).forEach((e) => e.triggerEventHandler('ngModelChange', 1));
      de.queryAll(By.css('p-datepicker')).forEach((e) =>
        e.triggerEventHandler('ngModelChange', new Date('2025-01-01T00:00:00Z')),
      );
      de.queryAll(By.css('p-toggleswitch')).forEach((e) => e.triggerEventHandler('ngModelChange', true));
      de.queryAll(By.css('input[pInputText]')).forEach((e) => e.triggerEventHandler('ngModelChange', 'value'));
      de.queryAll(By.css('input[type="file"]')).forEach((e) =>
        e.triggerEventHandler('change', { target: { files: [] } }),
      );
      de.queryAll(By.css('img')).forEach((e) =>
        e.triggerEventHandler('error', { target: { style: {} } }),
      );
      de.queryAll(By.css('p-button')).forEach((e) => e.triggerEventHandler('onClick', {}));
      de.queryAll(By.css('app-transaction-widget')).forEach((e) =>
        e.triggerEventHandler('confirm', undefined),
      );
      await fixture.whenStable();
      expect(contract.adminRegisterEdition).toHaveBeenCalled();
    });

    it('renders empty catalog message when catalog is empty', () => {
      const { fixture } = setup([]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-table')).toBeTruthy();
    });

    it('window dialog is rendered when windowDialogVisible is true and onHide closes it', async () => {
      const { fixture } = setup();
      const comp = fixture.componentInstance as unknown as {
        windowDialogVisible: { set: (v: boolean) => void } & (() => boolean);
        windowEditionId: { set: (v: bigint) => void };
      };
      comp.windowDialogVisible.set(true);
      comp.windowEditionId.set(1n);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('p-dialog')).toBeTruthy();
      const { By } = await import('@angular/platform-browser');
      const de = fixture.debugElement;
      de.queryAll(By.css('p-dialog p-datepicker, p-datepicker')).forEach((e) => {
        e.triggerEventHandler('ngModelChange', new Date('2025-01-01T00:00:00Z'));
      });
      de.queryAll(By.css('p-dialog app-transaction-widget, app-transaction-widget')).forEach((e) => {
        e.triggerEventHandler('confirm', undefined);
      });
      await fixture.whenStable();
      const dialogs = de.queryAll(By.css('p-dialog'));
      if (dialogs.length > 0) {
        dialogs[dialogs.length - 1].triggerEventHandler('onHide', undefined);
        expect((comp.windowDialogVisible as unknown as () => boolean)()).toBe(false);
      }
    });
  });
});
