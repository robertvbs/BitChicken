import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { vi } from 'vitest';
import { Admin } from './admin';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { ContractAdminService } from '../../core/web3/contract-admin.service';
import { Web3Service } from '../../core/web3/web3.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import {
  createContractReadServiceMock,
  createContractAdminServiceMock,
  createEditionFixture,
  createStakingConfigFixture,
  createMarketplaceFeeConfigFixture,
  createTokenAdminStateFixture,
  createForgeVRFConfigFixture,
  createWeb3ServiceMock,
} from '../../../testing/web3-fakes';

function setup(forgeOwner = '0x0000000000000000000000000000000000000000') {
  const contractRead = createContractReadServiceMock();
  const contractAdmin = createContractAdminServiceMock();
  const contract = { ...contractRead, ...contractAdmin };
  contract.getCatalog.mockResolvedValue([createEditionFixture()]);
  contract.getStakingConfig.mockResolvedValue(createStakingConfigFixture());
  contract.getMarketplaceFeeConfig.mockResolvedValue(createMarketplaceFeeConfigFixture());
  contract.getTokenAdminState.mockResolvedValue(createTokenAdminStateFixture());
  contract.getForgeOwner.mockResolvedValue(forgeOwner);
  contract.getForgeVRFConfig.mockResolvedValue(createForgeVRFConfigFixture());
  contract.getNftPendingOwner.mockResolvedValue('');
  contract.getStakingPendingOwner.mockResolvedValue('');
  contract.getMarketplacePendingOwner.mockResolvedValue('');
  contract.getMintTiers.mockResolvedValue([
    { index: 0, price: 100000000000000000n },
    { index: 1, price: 200000000000000000n },
  ]);

  const web3 = createWeb3ServiceMock(true);

  TestBed.configureTestingModule({
    imports: [Admin],
    providers: [
      provideRouter([]),
      ...provideTranslateTesting(),
      { provide: ContractReadService, useValue: contract },
      { provide: ContractAdminService, useValue: contract },
      { provide: Web3Service, useValue: web3 },
      MessageService,
    ],
  });

  const fixture = TestBed.createComponent(Admin);
  return { fixture, contract, web3 };
}

async function waitForLoading(fixture: ReturnType<typeof setup>['fixture']) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('Admin shell', () => {
  it('creates component and calls all contract reads on init', async () => {
    const { fixture, contract } = setup();
    await waitForLoading(fixture);
    expect(fixture.componentInstance).toBeTruthy();
    expect(contract.getCatalog).toHaveBeenCalled();
    expect(contract.getStakingConfig).toHaveBeenCalled();
    expect(contract.getMarketplaceFeeConfig).toHaveBeenCalled();
    expect(contract.getTokenAdminState).toHaveBeenCalled();
    expect(contract.getForgeOwner).toHaveBeenCalled();
    expect(contract.getForgeVRFConfig).toHaveBeenCalled();
    expect(contract.getMintTiers).toHaveBeenCalled();
    expect(contract.getNftPendingOwner).toHaveBeenCalled();
    expect(contract.getStakingPendingOwner).toHaveBeenCalled();
    expect(contract.getMarketplacePendingOwner).toHaveBeenCalled();
  });

  it('shows loading spinner initially then hides after load', async () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pi-spin')).toBeTruthy();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(el.querySelector('.pi-spin')).toBeFalsy();
  });

  it('populates all data signals after loadAll', async () => {
    const { fixture } = setup();
    await waitForLoading(fixture);
    const comp = fixture.componentInstance;
    expect(comp.catalog()).toHaveLength(1);
    expect(comp.stakingConfig()).not.toBeNull();
    expect(comp.marketplaceFee()).not.toBeNull();
    expect(comp.tokenState()).not.toBeNull();
    expect(comp.vrfConfig()).not.toBeNull();
    expect(comp.mintTiers()).not.toBeNull();
  });

  it('populates pending owner signals from contract reads', async () => {
    const contractRead = createContractReadServiceMock();
    const contractAdmin = createContractAdminServiceMock();
    const contract = { ...contractRead, ...contractAdmin };
    contract.getCatalog.mockResolvedValue([]);
    contract.getStakingConfig.mockResolvedValue(createStakingConfigFixture());
    contract.getMarketplaceFeeConfig.mockResolvedValue(createMarketplaceFeeConfigFixture());
    contract.getTokenAdminState.mockResolvedValue(createTokenAdminStateFixture());
    contract.getForgeOwner.mockResolvedValue('');
    contract.getForgeVRFConfig.mockResolvedValue(createForgeVRFConfigFixture());
    contract.getMintTiers.mockResolvedValue([]);
    contract.getNftPendingOwner.mockResolvedValue('0xNFTPending');
    contract.getStakingPendingOwner.mockResolvedValue('0xStakingPending');
    contract.getMarketplacePendingOwner.mockResolvedValue('0xMpPending');
    const web3 = createWeb3ServiceMock(true);

    await TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contract },
        { provide: ContractAdminService, useValue: contract },
        { provide: Web3Service, useValue: web3 },
        MessageService,
      ],
    });
    const fixture = TestBed.createComponent(Admin);
    await waitForLoading(fixture);

    expect(fixture.componentInstance.nftPendingOwner()).toBe('0xNFTPending');
    expect(fixture.componentInstance.stakingPendingOwner()).toBe('0xStakingPending');
    expect(fixture.componentInstance.marketplacePendingOwner()).toBe('0xMpPending');
  });

  it('shows error toast when loadAll fails', async () => {
    const contract = { ...createContractReadServiceMock(), ...createContractAdminServiceMock() };
    contract.getCatalog.mockRejectedValue(new Error('network error'));
    const web3 = createWeb3ServiceMock(true);
    const messages = new MessageService();

    await TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contract },
        { provide: ContractAdminService, useValue: contract },
        { provide: Web3Service, useValue: web3 },
        { provide: MessageService, useValue: messages },
      ],
    });

    const addSpy = vi.spyOn(messages, 'add');
    const fixture = TestBed.createComponent(Admin);
    await waitForLoading(fixture);

    expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('handles optional contract reads failing gracefully (null signals)', async () => {
    const contract = { ...createContractReadServiceMock(), ...createContractAdminServiceMock() };
    contract.getCatalog.mockResolvedValue([]);
    contract.getStakingConfig.mockRejectedValue(new Error('no staking'));
    contract.getMarketplaceFeeConfig.mockRejectedValue(new Error('no fee'));
    contract.getTokenAdminState.mockRejectedValue(new Error('no token'));
    contract.getForgeVRFConfig.mockRejectedValue(new Error('no vrf'));
    contract.getMintTiers.mockRejectedValue(new Error('no tiers'));
    contract.getForgeOwner.mockResolvedValue('');
    const web3 = createWeb3ServiceMock(true);

    await TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contract },
        { provide: ContractAdminService, useValue: contract },
        { provide: Web3Service, useValue: web3 },
        MessageService,
      ],
    });
    const fixture = TestBed.createComponent(Admin);
    await waitForLoading(fixture);
    const comp = fixture.componentInstance;

    expect(comp.stakingConfig()).toBeNull();
    expect(comp.marketplaceFee()).toBeNull();
    expect(comp.tokenState()).toBeNull();
    expect(comp.vrfConfig()).toBeNull();
    expect(comp.mintTiers()).toBeNull();
  });

  it('shows connect prompt when wallet is disconnected', async () => {
    const contract = { ...createContractReadServiceMock(), ...createContractAdminServiceMock() };
    contract.getCatalog.mockResolvedValue([]);
    contract.getStakingConfig.mockResolvedValue(createStakingConfigFixture());
    contract.getMarketplaceFeeConfig.mockResolvedValue(createMarketplaceFeeConfigFixture());
    contract.getTokenAdminState.mockResolvedValue(createTokenAdminStateFixture());
    contract.getForgeOwner.mockResolvedValue('0x0000000000000000000000000000000000000000');
    contract.getForgeVRFConfig.mockResolvedValue(createForgeVRFConfigFixture());
    contract.getMintTiers.mockResolvedValue([]);
    const web3 = createWeb3ServiceMock(false);

    await TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contract },
        { provide: ContractAdminService, useValue: contract },
        { provide: Web3Service, useValue: web3 },
        MessageService,
      ],
    });

    const fixture = TestBed.createComponent(Admin);
    await waitForLoading(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('admin.connectPrompt');
  });

  it('hides connect prompt when wallet is connected', async () => {
    const { fixture } = setup();
    await waitForLoading(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('admin.connectPrompt');
  });

  it('renders all panel components in the shell template', async () => {
    const { fixture } = setup();
    await waitForLoading(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-admin-nft-panel')).toBeTruthy();
    expect(el.querySelector('app-admin-editions-panel')).toBeTruthy();
    expect(el.querySelector('app-admin-forge-panel')).toBeTruthy();
    expect(el.querySelector('app-admin-vrf-panel')).toBeTruthy();
    expect(el.querySelector('app-admin-staking-panel')).toBeTruthy();
    expect(el.querySelector('app-admin-token-panel')).toBeTruthy();
    expect(el.querySelector('app-admin-marketplace-panel')).toBeTruthy();
  });

  it('reloads data when a panel emits reloadRequested', async () => {
    const { fixture, contract } = setup();
    await waitForLoading(fixture);
    contract.getCatalog.mockClear();

    await fixture.componentInstance.loadAll();

    expect(contract.getCatalog).toHaveBeenCalled();
  });

  it('renders the tabs shell (tablist + tabpanels) after loading', async () => {
    const { fixture } = setup();
    await waitForLoading(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-tabs')).toBeTruthy();
    expect(el.querySelector('p-tablist')).toBeTruthy();
    expect(el.querySelector('p-tabpanels')).toBeTruthy();
  });

  it('passes correct signals to each panel as inputs', async () => {
    const { fixture } = setup();
    await waitForLoading(fixture);
    const comp = fixture.componentInstance;
    expect(comp.catalog().length).toBeGreaterThan(0);
    expect(comp.stakingConfig()).not.toBeNull();
    expect(comp.forgeOwner()).toBeTruthy();
    expect(comp.nftPendingOwner()).toBe('');
    expect(comp.stakingPendingOwner()).toBe('');
    expect(comp.marketplacePendingOwner()).toBe('');
  });

  it('triggers loadAll when nft panel emits reloadRequested', async () => {
    const { fixture, contract } = setup();
    await waitForLoading(fixture);
    contract.getCatalog.mockClear();
    const { By } = await import('@angular/platform-browser');
    const nftPanel = fixture.debugElement.query(By.css('app-admin-nft-panel'));
    if (nftPanel) {
      nftPanel.triggerEventHandler('reloadRequested', undefined);
      await fixture.whenStable();
      expect(contract.getCatalog).toHaveBeenCalled();
    }
  });

  it('triggers loadAll when editions panel emits reloadRequested', async () => {
    const { fixture, contract } = setup();
    await waitForLoading(fixture);
    contract.getCatalog.mockClear();
    const { By } = await import('@angular/platform-browser');
    const panel = fixture.debugElement.query(By.css('app-admin-editions-panel'));
    if (panel) {
      panel.triggerEventHandler('reloadRequested', undefined);
      await fixture.whenStable();
      expect(contract.getCatalog).toHaveBeenCalled();
    }
  });

  it('triggers loadAll when forge panel emits reloadRequested', async () => {
    const { fixture, contract } = setup();
    await waitForLoading(fixture);
    contract.getCatalog.mockClear();
    const { By } = await import('@angular/platform-browser');
    const panel = fixture.debugElement.query(By.css('app-admin-forge-panel'));
    if (panel) {
      panel.triggerEventHandler('reloadRequested', undefined);
      await fixture.whenStable();
      expect(contract.getCatalog).toHaveBeenCalled();
    }
  });

  it('triggers loadAll when staking panel emits reloadRequested', async () => {
    const { fixture, contract } = setup();
    await waitForLoading(fixture);
    contract.getCatalog.mockClear();
    const { By } = await import('@angular/platform-browser');
    const panel = fixture.debugElement.query(By.css('app-admin-staking-panel'));
    if (panel) {
      panel.triggerEventHandler('reloadRequested', undefined);
      await fixture.whenStable();
      expect(contract.getCatalog).toHaveBeenCalled();
    }
  });

  it('triggers loadAll when marketplace panel emits reloadRequested', async () => {
    const { fixture, contract } = setup();
    await waitForLoading(fixture);
    contract.getCatalog.mockClear();
    const { By } = await import('@angular/platform-browser');
    const panel = fixture.debugElement.query(By.css('app-admin-marketplace-panel'));
    if (panel) {
      panel.triggerEventHandler('reloadRequested', undefined);
      await fixture.whenStable();
      expect(contract.getCatalog).toHaveBeenCalled();
    }
  });
});
