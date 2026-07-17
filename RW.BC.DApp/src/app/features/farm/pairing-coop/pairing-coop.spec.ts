import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Button } from 'primeng/button';
import { Paginator } from 'primeng/paginator';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { PairingCoop } from './pairing-coop';
import { Gender, NftItem, Rarity } from '../../../core/web3/web3.models';
import { ItemCard } from '../../../shared/components/item-card/item-card';
import { TransactionWidget } from '../../../shared/components/transaction-widget/transaction-widget';

function makeNft(overrides: Partial<NftItem> = {}, attrs: Partial<NftItem['attributes']> = {}): NftItem {
  return {
    tokenId: 1n,
    attributes: { health: 30, skill: 30, morale: 30, gender: Gender.Male, ...attrs },
    editionId: 1n,
    editionName: 'Common Hen',
    artURI: '',
    rarity: Rarity.Common,
    nftName: '',
    staked: false,
    ...overrides,
  };
}

const MALE = makeNft({ tokenId: 1n }, { gender: Gender.Male });
const FEMALE = makeNft({ tokenId: 2n }, { gender: Gender.Female });

async function setup(inputs: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({
    imports: [PairingCoop],
    providers: [...provideTranslateTesting()],
  }).compileComponents();

  const fixture = TestBed.createComponent(PairingCoop);
  const component = fixture.componentInstance;
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return { fixture, component };
}

describe('PairingCoop', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('cardName uses nftName when present and falls back to the token id', async () => {
    const { component } = await setup();
    expect(component['cardName'](makeNft({ nftName: 'Lola' }))).toBe('Lola');
    expect(component['cardName'](makeNft({ tokenId: 9n, nftName: '' }))).toBe('#9');
  });

  it('placeFromCard routes males to placeMale and females to placeFemale', async () => {
    const { component } = await setup();
    const males: NftItem[] = [];
    const females: NftItem[] = [];
    component.placeMale.subscribe((n) => males.push(n));
    component.placeFemale.subscribe((n) => females.push(n));

    component['placeFromCard'](MALE);
    component['placeFromCard'](FEMALE);

    expect(males).toEqual([MALE]);
    expect(females).toEqual([FEMALE]);
    expect(component['liveMessage']()).toBe('farm.announcePlacedFemale');
  });

  it('does not place a male when the male nest is already filled', async () => {
    const { component } = await setup({ male: MALE });
    let emitted = false;
    component.placeMale.subscribe(() => (emitted = true));

    component['placeFromCard'](makeNft({ tokenId: 7n }, { gender: Gender.Male }));

    expect(emitted).toBe(false);
    expect(component['liveMessage']()).toBe('farm.slotFull');
  });

  it('does not place a female when the female nest is already filled', async () => {
    const { component } = await setup({ female: FEMALE });
    let emitted = false;
    component.placeFemale.subscribe(() => (emitted = true));

    component['placeFromCard'](makeNft({ tokenId: 8n }, { gender: Gender.Female }));

    expect(emitted).toBe(false);
    expect(component['liveMessage']()).toBe('farm.slotFull');
  });

  it('onClearMale / onClearFemale emit and announce', async () => {
    const { component } = await setup();
    let clearedMale = false;
    let clearedFemale = false;
    component.clearMaleSlot.subscribe(() => (clearedMale = true));
    component.clearFemaleSlot.subscribe(() => (clearedFemale = true));

    component['onClearMale']();
    expect(clearedMale).toBe(true);
    expect(component['liveMessage']()).toBe('farm.announceClearedMale');

    component['onClearFemale']();
    expect(clearedFemale).toBe(true);
    expect(component['liveMessage']()).toBe('farm.announceClearedFemale');
  });

  it('enter predicates gate by gender and empty slot', async () => {
    const { fixture, component } = await setup();
    const maleDrag = { data: MALE } as unknown as CdkDrag;
    const femaleDrag = { data: FEMALE } as unknown as CdkDrag;

    expect(component['maleEnterPredicate'](maleDrag)).toBe(true);
    expect(component['maleEnterPredicate'](femaleDrag)).toBe(false);
    expect(component['femaleEnterPredicate'](femaleDrag)).toBe(true);
    expect(component['femaleEnterPredicate'](maleDrag)).toBe(false);

    fixture.componentRef.setInput('male', MALE);
    fixture.componentRef.setInput('female', FEMALE);
    fixture.detectChanges();
    expect(component['maleEnterPredicate'](maleDrag)).toBe(false);
    expect(component['femaleEnterPredicate'](femaleDrag)).toBe(false);
  });

  it('guidanceKey reflects which genders are available', async () => {
    const { fixture, component } = await setup({ hasMales: true, hasFemales: true });
    expect(component['guidanceKey']()).toBe('farm.needBoth');

    fixture.componentRef.setInput('hasMales', true);
    fixture.componentRef.setInput('hasFemales', false);
    fixture.detectChanges();
    expect(component['guidanceKey']()).toBe('farm.onlyMales');

    fixture.componentRef.setInput('hasMales', false);
    fixture.componentRef.setInput('hasFemales', true);
    fixture.detectChanges();
    expect(component['guidanceKey']()).toBe('farm.onlyFemales');
  });

  it('estimateText is empty when estimate is null and formatted otherwise', async () => {
    const { fixture, component } = await setup();
    expect(component['estimateText']()).toBe('');
    fixture.componentRef.setInput('estimate', 1_000_000_000_000_000_000n);
    fixture.detectChanges();
    expect(component['estimateText']()).not.toBe('');
  });

  it('renders empty nests with hints when nothing is placed', async () => {
    const { fixture } = await setup({ inventory: [MALE, FEMALE], hasMales: true, hasFemales: true });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.bc-nest__empty').length).toBe(2);
    expect(el.querySelector('.bc-nest--filled')).toBeNull();
  });

  it('renders the placed cards and clear buttons when both slots are filled', async () => {
    const { fixture } = await setup({ male: MALE, female: FEMALE, ideal: true, estimate: 5n, multiplierText: '2' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.bc-nest--filled').length).toBe(2);
    expect(el.querySelectorAll('.bc-nest__remove').length).toBe(2);
    expect(el.querySelector('.bc-coop__estimate--ideal')).not.toBeNull();
  });

  it('clears slots from the nest clear buttons', async () => {
    const { fixture, component } = await setup({ male: MALE, female: FEMALE });
    let clearedMale = false;
    let clearedFemale = false;
    component.clearMaleSlot.subscribe(() => (clearedMale = true));
    component.clearFemaleSlot.subscribe(() => (clearedFemale = true));

    const buttons = fixture.debugElement.queryAll(By.directive(Button));
    buttons[0].componentInstance.onClick.emit(new MouseEvent('click'));
    buttons[1].componentInstance.onClick.emit(new MouseEvent('click'));

    expect(clearedMale).toBe(true);
    expect(clearedFemale).toBe(true);
  });

  it('shows the standard chip for a non-ideal full pair', async () => {
    const { fixture } = await setup({ male: MALE, female: FEMALE, ideal: false, estimate: 5n });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bc-coop__estimate')).not.toBeNull();
    expect(el.querySelector('.bc-coop__estimate--ideal')).toBeNull();
  });

  it('shows a skeleton while the estimate is loading for a full pair', async () => {
    const { fixture } = await setup({ male: MALE, female: FEMALE, estimate: null });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-skeleton')).not.toBeNull();
  });

  it('fires drop handlers from the nest drop lists', async () => {
    const { fixture, component } = await setup({ inventory: [MALE, FEMALE] });
    const males: NftItem[] = [];
    const females: NftItem[] = [];
    component.placeMale.subscribe((n) => males.push(n));
    component.placeFemale.subscribe((n) => females.push(n));

    const dropLists = fixture.debugElement.queryAll(By.directive(CdkDropList));
    dropLists[0].triggerEventHandler('cdkDropListDropped', { item: { data: MALE } });
    dropLists[1].triggerEventHandler('cdkDropListDropped', { item: { data: FEMALE } });

    expect(males).toEqual([MALE]);
    expect(females).toEqual([FEMALE]);
  });

  it('wires inventory card outputs to place and addToWallet', async () => {
    const { fixture, component } = await setup({ inventory: [MALE] });
    let placed: NftItem | null = null;
    let watched: bigint | null = null;
    component.placeMale.subscribe((n) => (placed = n));
    component.addToWallet.subscribe((t) => (watched = t));

    const card = fixture.debugElement.query(By.directive(ItemCard)).componentInstance as ItemCard;
    card.cta.emit();
    card.addToWallet.emit(1n);

    expect(placed).toEqual(MALE);
    expect(watched).toBe(1n);
  });

  it('emits lodge when the transaction widget confirms', async () => {
    const { fixture, component } = await setup({ inventory: [MALE], canStake: false });
    let lodged = false;
    component.lodge.subscribe(() => (lodged = true));

    const widget = fixture.debugElement.query(By.directive(TransactionWidget)).componentInstance as TransactionWidget;
    widget.confirm.emit();

    expect(lodged).toBe(true);
  });

  it('paginates the inventory when it exceeds the page size', async () => {
    const inventory = Array.from({ length: 12 }, (_, i) => makeNft({ tokenId: BigInt(i + 1) }));
    const { fixture, component } = await setup({ inventory });
    expect(component['showPaginator']()).toBe(true);

    const paginator = fixture.debugElement.query(By.directive(Paginator)).componentInstance as Paginator;
    paginator.onPageChange.emit({ first: 10, rows: 10, page: 1, pageCount: 2 });
    fixture.detectChanges();

    expect(component['inventoryFirst']()).toBe(10);
  });
});
