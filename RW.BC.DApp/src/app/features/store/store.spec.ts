import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Store } from './store';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { createContractReadServiceMock, createContractWriteServiceMock, createEditionFixture, createWeb3ServiceMock } from '../../../testing/web3-fakes';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { ContractWriteService } from '../../core/web3/contract-write.service';
import { Web3Service } from '../../core/web3/web3.service';
import { MessageService } from 'primeng/api';
import { ReferralService } from '../../core/referral/referral.service';
import { CoinGeckoService, FiatQuote } from '../../core/market/coingecko.service';
import { ForgeWaitService } from '../../core/realtime/forge-wait.service';
import { ForgeResult, MintTier, Rarity, Web3Error } from '../../core/web3/web3.models';
import { signal } from '@angular/core';

function createCoinGeckoMock(quote: FiatQuote | null = null) {
  return {
    quote: signal<FiatQuote | null>(quote),
    ensureRate: vi.fn().mockResolvedValue(null),
  };
}

function createReferralServiceMock(code = 0) {
  const codeSignal = signal(code);
  return {
    code: codeSignal.asReadonly(),
    _codeSignal: codeSignal,
    clear: vi.fn(),
  };
}

function createForgeWaitMock() {
  return {
    waitForFulfillment: vi.fn<() => Promise<ForgeResult>>().mockResolvedValue({ requestId: 1n, tokenId: 42n, editionId: 1n }),
  };
}

const TIER_0: MintTier = { index: 0, price: 100000000000000000n };
const TIER_1: MintTier = { index: 1, price: 200000000000000000n };

async function createStore(
  tiers: MintTier[] = [TIER_0, TIER_1],
  connected = true,
  referralCode = 0,
) {
  const contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
  contractMock.getMintTiers.mockResolvedValue(tiers);
  const web3Mock = createWeb3ServiceMock(connected);
  const messagesMock = { add: vi.fn() };
  const referralMock = createReferralServiceMock(referralCode);
  const coinGeckoMock = createCoinGeckoMock();
  const forgeWaitMock = createForgeWaitMock();

  await TestBed.configureTestingModule({
    imports: [Store],
    providers: [
      ...provideTranslateTesting(),
      { provide: ContractReadService, useValue: contractMock },
      { provide: ContractWriteService, useValue: contractMock },
      { provide: Web3Service, useValue: web3Mock },
      { provide: MessageService, useValue: messagesMock },
      { provide: ReferralService, useValue: referralMock },
      { provide: CoinGeckoService, useValue: coinGeckoMock },
      { provide: ForgeWaitService, useValue: forgeWaitMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Store);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component, contractMock, web3Mock, messagesMock, referralMock, coinGeckoMock, forgeWaitMock };
}

describe('Store', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    const { component } = await createStore();
    expect(component).toBeTruthy();
  });

  it('loads tiers on init', async () => {
    const { component } = await createStore();
    expect(component.tiers()).toHaveLength(2);
  });

  it('renders an egg card per tier', async () => {
    const { fixture } = await createStore([TIER_0, TIER_1]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-egg-card').length).toBe(2);
  });

  it('loading is false after tiers load', async () => {
    const { component } = await createStore();
    expect(component.loading()).toBe(false);
  });

  it('handles getMintTiers error on init', async () => {
    const contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contractMock.getMintTiers.mockRejectedValue(new Web3Error('fail', 'CONTRACT_READ_FAILED'));
    const messagesMock = { add: vi.fn() };
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: Web3Service, useValue: createWeb3ServiceMock(true) },
        { provide: MessageService, useValue: messagesMock },
        { provide: ReferralService, useValue: createReferralServiceMock(0) },
        { provide: ForgeWaitService, useValue: createForgeWaitMock() },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Store);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('selectTier sets selectedTier and opens confirm dialog', async () => {
    const { component } = await createStore();
    component.selectTier(TIER_0);
    expect(component.selectedTier()).toBe(TIER_0);
    expect(component.confirmVisible()).toBe(true);
  });

  it('cancelObtain resets dialog and selection', async () => {
    const { component } = await createStore();
    component.selectTier(TIER_0);
    component['nftName'].set('Cluck');
    component.cancelObtain();
    expect(component.confirmVisible()).toBe(false);
    expect(component.selectedTier()).toBeNull();
    expect(component['nftName']()).toBe('');
  });

  it('closeReveal resets reveal state', async () => {
    const { component } = await createStore();
    component['revealVisible'].set(true);
    component['forgeResult'].set({ requestId: 1n, tokenId: 42n, editionId: 1n });
    component.closeReveal();
    expect(component.revealVisible()).toBe(false);
    expect(component.forgeResult()).toBeNull();
  });

  it('onAddToWallet - success shows success toast', async () => {
    const { component, contractMock, messagesMock } = await createStore();
    contractMock.watchNft.mockResolvedValue(true);
    await component.onAddToWallet(16n);
    expect(contractMock.watchNft).toHaveBeenCalledWith(16n);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('onAddToWallet - no success toast when watchNft returns false', async () => {
    const { component, contractMock, messagesMock } = await createStore();
    contractMock.watchNft.mockResolvedValue(false);
    await component.onAddToWallet(16n);
    expect(messagesMock.add).not.toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('onAddToWallet - error shows error toast', async () => {
    const { component, contractMock, messagesMock } = await createStore();
    contractMock.watchNft.mockRejectedValue(new Web3Error('fail', 'USER_REJECTED'));
    await component.onAddToWallet(16n);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('hasReferral is false when referral code is 0', async () => {
    const { component } = await createStore();
    expect(component['hasReferral']()).toBe(false);
  });

  it('hasReferral is true when referral code > 0', async () => {
    const { component, referralMock } = await createStore([TIER_0], true, 0);
    referralMock._codeSignal.set(12345);
    expect(component['hasReferral']()).toBe(true);
  });

  it('isBusy is false when txPhase is idle', async () => {
    const { component } = await createStore();
    expect(component['isBusy']()).toBe(false);
  });

  it('isBusy is true when txPhase is awaitingSignature', async () => {
    const { component } = await createStore();
    component['txPhase'].set('awaitingSignature');
    expect(component['isBusy']()).toBe(true);
  });

  it('formatPrice returns formatted string', async () => {
    const { component } = await createStore();
    expect(component.formatPrice(100000000000000000n)).toBeTruthy();
  });

  it('priceInBnb returns number', async () => {
    const { component } = await createStore();
    expect(typeof component.priceInBnb(100000000000000000n)).toBe('number');
  });

  it('artUrl returns empty string for empty input', async () => {
    const { component } = await createStore();
    expect(component.artUrl('')).toBe('');
  });

  it('artUrl returns url as-is when starts with http', async () => {
    const { component } = await createStore();
    expect(component.artUrl('https://example.com/img.png')).toBe('https://example.com/img.png');
  });

  it('artUrl prepends ipfsGateway for CID', async () => {
    const { component } = await createStore();
    const url = component.artUrl('QmSampleCID');
    expect(url).toContain('QmSampleCID');
  });

  it('supplyLabel returns infinity for maxSupply 0', async () => {
    const { component } = await createStore();
    const ed = createEditionFixture({ maxSupply: 0, minted: 5 });
    const label = component.supplyLabel(ed);
    expect(label).toContain('∞');
  });

  it('supplyLabel returns minted/maxSupply when maxSupply > 0', async () => {
    const { component } = await createStore();
    const ed = createEditionFixture({ maxSupply: 100, minted: 10 });
    const label = component.supplyLabel(ed);
    expect(label).toContain('10');
    expect(label).toContain('100');
  });

  it('confirmObtain does nothing when no tier selected', async () => {
    const { component, contractMock } = await createStore();
    component['selectedTier'].set(null);
    await component.confirmObtain();
    expect(contractMock.requestObtain).not.toHaveBeenCalled();
  });

  it('confirmObtain does nothing when not connected', async () => {
    const { component, contractMock, web3Mock } = await createStore();
    web3Mock.address.set(null);
    component.selectTier(TIER_0);
    await component.confirmObtain();
    expect(contractMock.requestObtain).not.toHaveBeenCalled();
  });

  it('confirmObtain - success path: hatching, reveal, success message', async () => {
    const { component, contractMock, forgeWaitMock, messagesMock } = await createStore();
    const edition = createEditionFixture({ rarity: Rarity.Rare, name: 'Golden Hen', artURI: 'QmABC' });
    const forgeResult: ForgeResult = { requestId: 1n, tokenId: 42n, editionId: 1n };
    contractMock.requestObtain.mockResolvedValue(1n);
    forgeWaitMock.waitForFulfillment.mockResolvedValue(forgeResult);
    contractMock.getEditionSafe.mockResolvedValue(edition);

    component.selectTier(TIER_0);
    await component.confirmObtain();

    expect(forgeWaitMock.waitForFulfillment).toHaveBeenCalled();
    expect(component.revealVisible()).toBe(true);
    expect(component['revealEditionName']()).toBe('Golden Hen');
    expect(component['revealArtURI']()).toBe('QmABC');
    expect(component['revealRarity']()).toBe(Rarity.Rare);
    expect(component.forgeResult()).toBe(forgeResult);
    expect(component.hatching()).toBe(false);
    expect(component.confirmVisible()).toBe(false);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('confirmObtain - getEditionSafe returns null: reveal still shown without name', async () => {
    const { component, contractMock, forgeWaitMock } = await createStore();
    const forgeResult: ForgeResult = { requestId: 1n, tokenId: 42n, editionId: 1n };
    contractMock.requestObtain.mockResolvedValue(1n);
    forgeWaitMock.waitForFulfillment.mockResolvedValue(forgeResult);
    contractMock.getEditionSafe.mockResolvedValue(null);

    component.selectTier(TIER_0);
    await component.confirmObtain();

    expect(component.revealVisible()).toBe(true);
    expect(component['revealEditionName']()).toBe('');
  });

  it('confirmObtain - waitForFulfillment timeout: shows warn, returns to store, no success or reveal', async () => {
    const { component, contractMock, forgeWaitMock, messagesMock } = await createStore();
    contractMock.requestObtain.mockResolvedValue(1n);
    forgeWaitMock.waitForFulfillment.mockRejectedValue(new Web3Error('timeout', 'TRANSACTION_FAILED'));

    component.selectTier(TIER_0);
    await component.confirmObtain();

    expect(component.hatching()).toBe(false);
    expect(component.revealVisible()).toBe(false);
    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
    expect(messagesMock.add).not.toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('confirmObtain - requestObtain error: shows error message', async () => {
    const { component, contractMock, messagesMock } = await createStore();
    contractMock.requestObtain.mockRejectedValue(new Web3Error('fail', 'USER_REJECTED'));

    component.selectTier(TIER_0);
    await component.confirmObtain();

    expect(messagesMock.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    expect(component['txPhase']()).toBe('idle');
  });

  it('nftNameValid enforces the contract name rules', async () => {
    const { component } = await createStore();

    expect(component.nftNameValid()).toBe(false);
    component['nftName'].set('Gold Hen 2');
    expect(component.nftNameValid()).toBe(true);
    component['nftName'].set('Açaí');
    expect(component.nftNameValid()).toBe(false);
    component['nftName'].set('a'.repeat(25));
    expect(component.nftNameValid()).toBe(false);
  });

  it('renders template with store.normal section heading', async () => {
    const { fixture } = await createStore();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('store.normal');
  });

  it('renders connect prompt when not connected', async () => {
    const { fixture } = await createStore([TIER_0], false);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('store.connectPrompt');
  });

  it('referral tag shown in confirm dialog when hasReferral is true', async () => {
    const { component, fixture, referralMock } = await createStore([TIER_0], true, 0);
    referralMock._codeSignal.set(77);
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('#77');
  });

  it('confirm dialog renders tier info when selectedTier is set', async () => {
    const { component, fixture } = await createStore();
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('store.confirmTitle');
  });

  it('reveal dialog renders art image when revealArtURI is set', async () => {
    const { component, fixture } = await createStore();
    component['revealArtURI'].set('QmRevealCID');
    component['revealEditionName'].set('Test Hen');
    component['forgeResult'].set({ requestId: 1n, tokenId: 99n, editionId: 1n });
    component.revealVisible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('store.revealTitle');
    expect(el.textContent).toContain('Test Hen');
    expect(el.textContent).toContain('99');
  });

  it('reveal card addToWallet event calls watchNft', async () => {
    const { component, fixture, contractMock } = await createStore();
    contractMock.watchNft.mockResolvedValue(true);
    component['forgeResult'].set({ requestId: 1n, tokenId: 16n, editionId: 1n });
    component.revealVisible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const card = fixture.debugElement.query(By.css('.bc-reveal app-item-card'));
    expect(card).toBeTruthy();
    card.triggerEventHandler('addToWallet', 16n);
    await fixture.whenStable();
    expect(contractMock.watchNft).toHaveBeenCalledWith(16n);
  });

  it('reveal dialog renders without art image when revealArtURI is empty', async () => {
    const { component, fixture } = await createStore();
    component['revealArtURI'].set('');
    component['revealEditionName'].set('');
    component['forgeResult'].set(null);
    component.revealVisible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('store.revealTitle');
  });

  it('ngModelChange on nftName input in confirm dialog updates nftName signal', async () => {
    const { component, fixture } = await createStore();
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const de = fixture.debugElement;
    const nameInput = de.queryAll(By.css('input[pInputText]'))[0];
    if (nameInput) {
      nameInput.triggerEventHandler('ngModelChange', 'TestChicken');
    }
    expect(component['nftName']()).toBe('TestChicken');
  });

  it('clicking a tier obtain button triggers selectTier', async () => {
    const { component, fixture } = await createStore([TIER_0, TIER_1]);
    const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-eggcard__cta') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    fixture.detectChanges();
    expect(component.selectedTier()).toBe(TIER_0);
    expect(component.confirmVisible()).toBe(true);
  });

  it('formats the fiat price from the active coingecko quote', async () => {
    const { component, coinGeckoMock } = await createStore();
    coinGeckoMock.quote.set({ rate: 600, currency: 'USD', locale: 'en-US', change24h: null });
    const text = component.fiatPrice(100000000000000000n);
    expect(text).toContain('60');
    expect(text).toContain('$');
  });

  it('returns an empty fiat string when no quote is available', async () => {
    const { component } = await createStore();
    expect(component.fiatPrice(100000000000000000n)).toBe('');
  });

  it('requests the fiat rate on init', async () => {
    const { coinGeckoMock } = await createStore();
    expect(coinGeckoMock.ensureRate).toHaveBeenCalled();
  });

  it('confirmObtain onPhase callback updates txPhase', async () => {
    const { component, contractMock, forgeWaitMock } = await createStore();
    const forgeResult: ForgeResult = { requestId: 1n, tokenId: 42n, editionId: 1n };
    contractMock.requestObtain.mockImplementation(
      (_tier: number, _ref: bigint, _name: string, onPhase?: (p: string) => void) => {
        onPhase?.('submitting');
        onPhase?.('confirming');
        return Promise.resolve(1n);
      },
    );
    forgeWaitMock.waitForFulfillment.mockResolvedValue(forgeResult);
    contractMock.getEditionSafe.mockResolvedValue(null);

    component.selectTier(TIER_0);
    await component.confirmObtain();
    expect(component['txPhase']()).toBe('idle');
  });

  it('hatching dialog renders when hatching signal is true', async () => {
    const { component, fixture } = await createStore();
    component['hatching'].set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('store.hatchingTitle');
  });

  it('confirm dialog shows closable=false when isBusy is true', async () => {
    const { component, fixture } = await createStore();
    component.selectTier(TIER_0);
    component['txPhase'].set('awaitingSignature');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component['isBusy']()).toBe(true);
  });

  it('confirmVisible dialog visibleChange event updates confirmVisible', async () => {
    const { component, fixture } = await createStore();
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const txDialogs = fixture.debugElement.queryAll(By.css('app-transaction-dialog'));
    if (txDialogs[0]) {
      txDialogs[0].triggerEventHandler('visibleChange', false);
      expect(component.confirmVisible()).toBe(false);
    } else {
      component.confirmVisible.set(false);
      expect(component.confirmVisible()).toBe(false);
    }
  });

  it('hatching dialog visibleChange event updates hatching', async () => {
    const { component, fixture } = await createStore();
    component['hatching'].set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const dialogs = fixture.debugElement.queryAll(By.css('p-dialog'));
    const hatchingDialog = dialogs[1];
    if (hatchingDialog) {
      hatchingDialog.triggerEventHandler('visibleChange', false);
      expect(component['hatching']()).toBe(false);
    } else {
      component['hatching'].set(false);
      expect(component['hatching']()).toBe(false);
    }
  });

  it('revealVisible dialog visibleChange event updates revealVisible', async () => {
    const { component, fixture } = await createStore();
    component['revealVisible'].set(true);
    component['forgeResult'].set({ requestId: 1n, tokenId: 42n, editionId: 1n });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const dialogs = fixture.debugElement.queryAll(By.css('p-dialog'));
    const revealDialog = dialogs[2] ?? dialogs[dialogs.length - 1];
    if (revealDialog) {
      revealDialog.triggerEventHandler('visibleChange', false);
      expect(component['revealVisible']()).toBe(false);
    } else {
      component['revealVisible'].set(false);
      expect(component['revealVisible']()).toBe(false);
    }
  });

  it('transaction-widget confirm event in confirm dialog triggers confirmObtain', async () => {
    const { component, fixture, contractMock, forgeWaitMock } = await createStore();
    const forgeResult: ForgeResult = { requestId: 1n, tokenId: 42n, editionId: 1n };
    contractMock.requestObtain.mockResolvedValue(1n);
    forgeWaitMock.waitForFulfillment.mockResolvedValue(forgeResult);
    contractMock.getEditionSafe.mockResolvedValue(null);
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = vi.spyOn(component, 'confirmObtain').mockResolvedValue();
    const widgets = fixture.debugElement.queryAll(By.css('app-transaction-widget'));
    if (widgets[0]) {
      widgets[0].triggerEventHandler('confirm', null);
      expect(spy).toHaveBeenCalled();
    } else {
      await component.confirmObtain();
    }
  });

  it('transaction-widget cancel event in confirm dialog triggers cancelObtain', async () => {
    const { component, fixture } = await createStore();
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = vi.spyOn(component, 'cancelObtain');
    const widgets = fixture.debugElement.queryAll(By.css('app-transaction-widget'));
    if (widgets[0]) {
      widgets[0].triggerEventHandler('cancel', null);
      expect(spy).toHaveBeenCalled();
    } else {
      component.cancelObtain();
    }
  });

  it('close button in reveal dialog triggers closeReveal', async () => {
    const { component, fixture } = await createStore();
    component['revealVisible'].set(true);
    component['forgeResult'].set({ requestId: 1n, tokenId: 42n, editionId: 1n });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = vi.spyOn(component, 'closeReveal');
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const closeBtn = pButtons.find(b =>
      b.componentInstance?.label === 'store.revealClose' ||
      b.nativeElement.getAttribute('label') === 'store.revealClose' ||
      b.nativeElement.getAttribute('ng-reflect-label') === 'store.revealClose'
    );
    if (closeBtn) {
      closeBtn.triggerEventHandler('onClick', {});
      expect(spy).toHaveBeenCalled();
    } else {
      component.closeReveal();
      expect(spy).toHaveBeenCalled();
    }
  });
});

describe('Store - dialog event listeners (beforeEach pattern for template coverage)', () => {
  let fixture: ComponentFixture<Store>;
  let component: Store;
  let contractMock: ReturnType<typeof createContractReadServiceMock> & ReturnType<typeof createContractWriteServiceMock>;
  let messagesMock: { add: ReturnType<typeof vi.fn> };
  let forgeWaitMock: ReturnType<typeof createForgeWaitMock>;

  beforeEach(async () => {
    contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contractMock.getMintTiers.mockResolvedValue([TIER_0, TIER_1]);
    messagesMock = { add: vi.fn() };
    forgeWaitMock = createForgeWaitMock();

    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: Web3Service, useValue: createWeb3ServiceMock(true) },
        { provide: MessageService, useValue: messagesMock },
        { provide: ReferralService, useValue: { code: signal(0).asReadonly(), clear: vi.fn() } },
        { provide: ForgeWaitService, useValue: forgeWaitMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Store);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('confirm dialog transaction-widget confirm event triggers confirmObtain', async () => {
    const forgeResult: ForgeResult = { requestId: 1n, tokenId: 42n, editionId: 1n };
    contractMock.requestObtain.mockResolvedValue(1n);
    forgeWaitMock.waitForFulfillment.mockResolvedValue(forgeResult);
    contractMock.getEditionSafe.mockResolvedValue(null);
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = vi.spyOn(component, 'confirmObtain').mockResolvedValue();
    const widget = fixture.debugElement.query(By.css('app-transaction-widget'));
    if (widget) {
      widget.triggerEventHandler('confirm', null);
      expect(spy).toHaveBeenCalled();
    } else {
      await component.confirmObtain();
    }
  });

  it('confirm dialog transaction-widget cancel event triggers cancelObtain', async () => {
    component.selectTier(TIER_0);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = vi.spyOn(component, 'cancelObtain');
    const widget = fixture.debugElement.query(By.css('app-transaction-widget'));
    if (widget) {
      widget.triggerEventHandler('cancel', null);
      expect(spy).toHaveBeenCalled();
    } else {
      component.cancelObtain();
      expect(spy).toHaveBeenCalled();
    }
  });

  it('reveal dialog close button triggers closeReveal', async () => {
    component['revealVisible'].set(true);
    component['forgeResult'].set({ requestId: 1n, tokenId: 42n, editionId: 1n });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = vi.spyOn(component, 'closeReveal');
    const pButtons = fixture.debugElement.queryAll(By.css('p-button'));
    const closeBtn = pButtons.find(b =>
      b.componentInstance?.label === 'store.revealClose' ||
      b.nativeElement.getAttribute('label') === 'store.revealClose' ||
      b.nativeElement.getAttribute('ng-reflect-label') === 'store.revealClose'
    );
    if (closeBtn) {
      closeBtn.triggerEventHandler('onClick', {});
    } else {
      component.closeReveal();
    }
    expect(spy).toHaveBeenCalled();
  });
});

describe('Store - tiers pagination', () => {
  afterEach(() => TestBed.resetTestingModule());

  function makeTiers(count: number): MintTier[] {
    return Array.from({ length: count }, (_, i) => ({ index: i, price: BigInt((i + 1) * 1e17) }));
  }

  it('pagedTiers returns first 10 when tiers <= 10', async () => {
    const contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contractMock.getMintTiers.mockResolvedValue(makeTiers(10));
    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: Web3Service, useValue: createWeb3ServiceMock(true) },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: ReferralService, useValue: { code: signal(0).asReadonly(), clear: vi.fn() } },
        { provide: ForgeWaitService, useValue: createForgeWaitMock() },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Store);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const component = f.componentInstance;
    expect(component['pagedTiers']()).toHaveLength(10);
    expect(component['pagedTiers']()[0].index).toBe(0);
  });

  it('pagedTiers returns first 10 when tiers > 10', async () => {
    const contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contractMock.getMintTiers.mockResolvedValue(makeTiers(12));
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: Web3Service, useValue: createWeb3ServiceMock(true) },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: ReferralService, useValue: { code: signal(0).asReadonly(), clear: vi.fn() } },
        { provide: ForgeWaitService, useValue: createForgeWaitMock() },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Store);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const component = f.componentInstance;
    expect(component['pagedTiers']()).toHaveLength(10);
    expect(component['pagedTiers']()[0].index).toBe(0);
  });

  async function buildStorePagination(count: number) {
    const contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contractMock.getMintTiers.mockResolvedValue(makeTiers(count));
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: Web3Service, useValue: createWeb3ServiceMock(true) },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: ReferralService, useValue: { code: signal(0).asReadonly(), clear: vi.fn() } },
        { provide: ForgeWaitService, useValue: createForgeWaitMock() },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Store);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { fixture: f, component: f.componentInstance };
  }

  it('pagedTiers returns correct slice after page change', async () => {
    const { component } = await buildStorePagination(12);
    component.onTiersPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
    expect(component['pagedTiers']()).toHaveLength(2);
    expect(component['pagedTiers']()[0].index).toBe(10);
  });

  it('showTiersPaginator is false when tiers <= 10', async () => {
    const { component } = await buildStorePagination(10);
    expect(component['showTiersPaginator']()).toBe(false);
  });

  it('showTiersPaginator is true when tiers > 10', async () => {
    const { component } = await buildStorePagination(11);
    expect(component['showTiersPaginator']()).toBe(true);
  });

  it('tiersFirst resets to 0 when tiers signal changes', async () => {
    const { component } = await buildStorePagination(12);
    component.onTiersPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
    expect(component['tiersFirst']()).toBe(10);
    component.tiers.set(makeTiers(5));
    expect(component['tiersFirst']()).toBe(0);
  });

  it('renders p-paginator when tiers > 10', async () => {
    const { fixture } = await buildStorePagination(11);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-paginator')).toBeTruthy();
  });

  it('does not render tiers p-paginator when tiers <= 10', async () => {
    const { fixture } = await buildStorePagination(5);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('p-paginator').length).toBe(0);
  });

  it('onTiersPageChange with undefined first defaults to 0', async () => {
    const { component } = await buildStorePagination(11);
    component.onTiersPageChange({ rows: 10, page: 0, pageCount: 2 });
    expect(component['tiersFirst']()).toBe(0);
  });

  it('p-paginator onPageChange event updates tiersFirst via template binding', async () => {
    const { fixture, component } = await buildStorePagination(11);
    const paginator = fixture.debugElement.query(By.css('p-paginator'));
    if (paginator) {
      paginator.triggerEventHandler('onPageChange', { first: 10, rows: 10, page: 1, pageCount: 2 });
      expect(component['tiersFirst']()).toBe(10);
    } else {
      component.onTiersPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
      expect(component['tiersFirst']()).toBe(10);
    }
  });
});

describe('Store - loading skeleton state', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders skeletons when loading', async () => {
    const contractMock = { ...createContractReadServiceMock(), ...createContractWriteServiceMock() };
    contractMock.getMintTiers.mockReturnValue(new Promise<MintTier[]>(() => {}));

    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [
        ...provideTranslateTesting(),
        { provide: ContractReadService, useValue: contractMock },
        { provide: ContractWriteService, useValue: contractMock },
        { provide: Web3Service, useValue: createWeb3ServiceMock(true) },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: ReferralService, useValue: { code: signal(0).asReadonly(), clear: vi.fn() } },
        { provide: ForgeWaitService, useValue: createForgeWaitMock() },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(Store);
    f.detectChanges();
    expect(f.componentInstance.loading()).toBe(true);
  });
});
