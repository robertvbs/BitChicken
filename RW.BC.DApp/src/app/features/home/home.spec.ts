import { TestBed } from '@angular/core/testing';
import { Home } from './home';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { createContractReadServiceMock } from '../../../testing/web3-fakes';
import { ContractReadService } from '../../core/web3/contract-read.service';
import { provideRouter } from '@angular/router';
import { MintTier } from '../../core/web3/web3.models';

async function createHome(tiersResult: 'empty' | MintTier[] | 'reject') {
  const contractMock = createContractReadServiceMock();

  if (tiersResult === 'empty') {
    contractMock.getMintTiers.mockResolvedValue([]);
  } else if (tiersResult === 'reject') {
    contractMock.getMintTiers.mockRejectedValue(new Error('rpc error'));
  } else {
    contractMock.getMintTiers.mockResolvedValue(tiersResult);
  }

  await TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      ...provideTranslateTesting(),
      provideRouter([]),
      { provide: ContractReadService, useValue: contractMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Home);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, contractMock };
}

describe('Home', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    const { component } = await createHome('empty');
    expect(component).toBeTruthy();
  });

  it('tiersLoading is false after init with empty tiers', async () => {
    const { component } = await createHome('empty');
    expect(component.tiersLoading()).toBe(false);
  });

  it('tiers is empty when getMintTiers returns empty', async () => {
    const { component } = await createHome('empty');
    expect(component.tiers()).toHaveLength(0);
  });

  it('loads and slices to 3 tiers max from 10', async () => {
    const tiers: MintTier[] = Array.from({ length: 10 }, (_, i) => ({ index: i, price: BigInt(i + 1) * 100000000000000000n }));
    const { component } = await createHome(tiers);
    expect(component.tiers()).toHaveLength(3);
    expect(component.tiersLoading()).toBe(false);
  });

  it('handles getMintTiers rejection gracefully', async () => {
    const { component } = await createHome('reject');
    expect(component.tiersLoading()).toBe(false);
    expect(component.tiers()).toHaveLength(0);
  });

  it('renders an egg card for each featured tier', async () => {
    const tiers: MintTier[] = [
      { index: 0, price: 100000000000000000n },
      { index: 1, price: 200000000000000000n },
    ];
    const { fixture } = await createHome(tiers);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-egg-card').length).toBe(2);
  });

  it('formatPrice returns string', async () => {
    const { component } = await createHome('empty');
    expect(component.formatPrice(1000000000000000000n)).toBeTruthy();
  });

  it('skeletons array has 3 items', async () => {
    const { component } = await createHome('empty');
    expect(component.skeletons).toHaveLength(3);
  });

  it('renders loading skeleton when getMintTiers is pending', async () => {
    const contractMock = createContractReadServiceMock();
    contractMock.getMintTiers.mockReturnValue(new Promise<never>(() => {}));

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        ...provideTranslateTesting(),
        provideRouter([]),
        { provide: ContractReadService, useValue: contractMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(fixture.componentInstance.tiersLoading()).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('p-skeleton').length).toBeGreaterThan(0);
  });
});
