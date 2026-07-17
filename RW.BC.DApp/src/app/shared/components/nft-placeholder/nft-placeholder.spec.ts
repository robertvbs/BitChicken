import { TestBed } from '@angular/core/testing';
import { NftPlaceholder } from './nft-placeholder';
import { Rarity } from '../../../core/web3/web3.models';

describe('NftPlaceholder', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NftPlaceholder],
    }).compileComponents();
  });

  it('defaults to the common rarity class', () => {
    const fixture = TestBed.createComponent(NftPlaceholder);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain('bc-placeholder');
    expect(host.classList).toContain('bc-rarity--common');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the pixel chicken svg', () => {
    const fixture = TestBed.createComponent(NftPlaceholder);
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg.bc-placeholder__art');
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('reflects the rarity into the host class', () => {
    const fixture = TestBed.createComponent(NftPlaceholder);
    fixture.componentRef.setInput('rarity', Rarity.Legendary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList).toContain('bc-rarity--legendary');
  });
});
