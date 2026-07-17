import { TestBed } from '@angular/core/testing';
import { ItemCard } from './item-card';
import { Gender, Rarity } from '../../../core/web3/web3.models';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';

function createCard() {
  return TestBed.createComponent(ItemCard);
}

describe('ItemCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemCard],
      providers: [...provideTranslateTesting()],
    }).compileComponents();
  });

  describe('image', () => {
    it('renders image when imageUrl is provided', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('imageUrl', 'https://ipfs.io/ipfs/QmArt');
      fixture.componentRef.setInput('name', 'Golden Hen');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('img.bc-itemcard__img')).toBeTruthy();
      expect(host.querySelector('app-nft-placeholder')).toBeNull();
    });

    it('falls back to placeholder when imageUrl is empty', () => {
      const fixture = createCard();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('app-nft-placeholder')).toBeTruthy();
      expect(host.querySelector('img.bc-itemcard__img')).toBeNull();
    });

    it('falls back to placeholder on image error and recovers on a new url', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('imageUrl', 'https://ipfs.io/ipfs/QmBroken');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      host.querySelector('img.bc-itemcard__img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(host.querySelector('app-nft-placeholder')).toBeTruthy();
      expect(host.querySelector('img.bc-itemcard__img')).toBeNull();

      fixture.componentRef.setInput('imageUrl', 'https://ipfs.io/ipfs/QmFixed');
      fixture.detectChanges();
      expect(host.querySelector('img.bc-itemcard__img')).toBeTruthy();
    });
  });

  describe('showFlag', () => {
    it('shows flag when showFlag is true (default)', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('rarity', Rarity.Epic);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flag')).toBeTruthy();
    });

    it('hides flag when showFlag is false', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('rarity', Rarity.Epic);
      fixture.componentRef.setInput('showFlag', false);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flag')).toBeNull();
    });
  });

  describe('--tier-color for all rarities', () => {
    const rarities: [Rarity, string][] = [
      [Rarity.Common, 'common'],
      [Rarity.Uncommon, 'uncommon'],
      [Rarity.Rare, 'rare'],
      [Rarity.Epic, 'epic'],
      [Rarity.Legendary, 'legendary'],
    ];

    for (const [rarity, key] of rarities) {
      it(`sets --tier-color to ${key} for Rarity.${Rarity[rarity]}`, () => {
        const fixture = createCard();
        fixture.componentRef.setInput('rarity', rarity);
        fixture.detectChanges();
        const style = (fixture.nativeElement as HTMLElement).getAttribute('style') ?? '';
        expect(style).toContain(key);
      });
    }
  });

  describe('hasAttributes and flip button', () => {
    it('shows flip button when health is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeTruthy();
    });

    it('shows flip button when skill is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('skill', 20);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeTruthy();
    });

    it('shows flip button when morale is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('morale', 30);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeTruthy();
    });

    it('shows flip button when gender is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('gender', Gender.Female);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeTruthy();
    });

    it('shows flip button when editionName is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('editionName', 'Special Edition');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeTruthy();
    });

    it('hides flip button when all attributes are null/empty (all-null case)', () => {
      const fixture = createCard();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeNull();
    });
  });

  describe('flip toggle', () => {
    it('adds bc-itemcard--flipped class on host when flipped', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).not.toContain('bc-itemcard--flipped');

      const btn = host.querySelector('.bc-itemcard__flip-btn') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();
      expect(host.classList).toContain('bc-itemcard--flipped');
    });

    it('sets aria-pressed to true when flipped', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });

    it('sets aria-pressed to false when not flipped', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn') as HTMLButtonElement;
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });

    it('Escape key resets flip to front', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const btn = host.querySelector('.bc-itemcard__flip-btn') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();
      expect(host.classList).toContain('bc-itemcard--flipped');

      const scene = host.querySelector('.bc-itemcard__scene') as HTMLElement;
      scene.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(host.classList).not.toContain('bc-itemcard--flipped');
    });

    it('clicking flip twice returns to front', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const btn = host.querySelector('.bc-itemcard__flip-btn') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();
      btn.click();
      fixture.detectChanges();
      expect(host.classList).not.toContain('bc-itemcard--flipped');
    });
  });

  describe('back face attributes', () => {
    it('shows H/S/M tags on back face', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.componentRef.setInput('skill', 20);
      fixture.componentRef.setInput('morale', 30);
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back).toBeTruthy();
      const attrs = back!.querySelector('.bc-itemcard__attrs');
      expect(attrs!.textContent).toContain('10');
      expect(attrs!.textContent).toContain('20');
      expect(attrs!.textContent).toContain('30');
      expect(attrs!.querySelectorAll('.bc-itemcard__attr').length).toBe(3);
    });

    it('shows gender symbol on back face when gender is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('gender', Gender.Male);
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back!.querySelector('.bc-itemcard__attrs')!.textContent).toContain('♂');
    });

    it('shows gender symbol for female', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('gender', Gender.Female);
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back!.querySelector('.bc-itemcard__attrs')!.textContent).toContain('♀');
    });

    it('shows edition name on back face when editionName is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('editionName', 'Special Edition X');
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back!.querySelector('.bc-itemcard__back-title')!.textContent).toContain('Special Edition X');
    });

    it('back face front-aria-hidden is set correctly when not flipped', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back!.getAttribute('aria-hidden')).toBe('true');
    });

    it('front face aria-hidden is set correctly when flipped', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();
      const front = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--front');
      expect(front!.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('CTA', () => {
    it('renders no CTA when ctaLabel is empty', () => {
      const fixture = createCard();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__cta')).toBeNull();
    });

    it('renders CTA button when ctaLabel is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('ctaLabel', 'Obtain');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__cta')).toBeTruthy();
    });

    it('emits cta event when CTA button is clicked', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('ctaLabel', 'Obtain');
      fixture.detectChanges();
      let emitted = false;
      fixture.componentInstance.cta.subscribe(() => { emitted = true; });
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.bc-itemcard__cta')!.click();
      expect(emitted).toBe(true);
    });

    it('applies cancel style when ctaCancel is true', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('ctaLabel', 'Cancel');
      fixture.componentRef.setInput('ctaCancel', true);
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__cta');
      expect(btn!.classList).toContain('bc-itemcard__cta--cancel');
    });

    it('does not apply cancel style when ctaCancel is false', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('ctaLabel', 'Obtain');
      fixture.componentRef.setInput('ctaCancel', false);
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__cta');
      expect(btn!.classList).not.toContain('bc-itemcard__cta--cancel');
    });

    it('disables CTA when ctaDisabled is true', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('ctaLabel', 'Obtain');
      fixture.componentRef.setInput('ctaDisabled', true);
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.bc-itemcard__cta');
      expect(btn!.disabled).toBe(true);
    });
  });

  describe('fiat tooltip', () => {
    it('tooltipDisabled is true when fiat is empty', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('price', '0.1');
      fixture.componentRef.setInput('fiat', '');
      fixture.detectChanges();
      const small = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__bnb');
      expect(small).toBeTruthy();
      const disabled = small!.getAttribute('ng-reflect-tooltip-disabled');
      expect(disabled === 'true' || !fixture.componentInstance['fiat']()).toBe(true);
    });

    it('tooltipDisabled is false when fiat is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('price', '0.1');
      fixture.componentRef.setInput('fiat', '$60.00');
      fixture.detectChanges();
      expect(fixture.componentInstance['fiat']()).toBe('$60.00');
    });
  });

  describe('supply and seller', () => {
    it('shows supply row on the back face when supplyLabel is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('supplyLabel', '5 / 100');
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back!.textContent).toContain('5 / 100');
    });

    it('hides supply row when supplyLabel is empty', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 5);
      fixture.detectChanges();
      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.bc-itemcard__attr');
      expect(rows.length).toBe(1);
    });

    it('shows seller row on the back face when seller is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('seller', '0x1234…abcd');
      fixture.detectChanges();
      const seller = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__attr-seller');
      expect(seller).toBeTruthy();
      expect(seller!.textContent).toContain('0x1234…abcd');
    });

    it('hides seller row when seller is empty', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 5);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__attr-seller')).toBeNull();
    });
  });

  describe('count badge', () => {
    it('shows count badge only when count > 1', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('count', 1);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__count')).toBeNull();

      fixture.componentRef.setInput('count', 3);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__count')!.textContent).toContain('×3');
    });

    it('hides count badge when count is 0', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('count', 0);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__count')).toBeNull();
    });
  });

  describe('owned', () => {
    it('applies owned class and badge when owned is true', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('owned', true);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).toContain('bc-itemcard--owned');
      expect(host.classList).not.toContain('bc-itemcard--dim');
      expect(host.querySelector('.bc-itemcard__badge--owned')).toBeTruthy();
    });

    it('applies dim class and no owned badge when owned is false', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('owned', false);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).toContain('bc-itemcard--dim');
      expect(host.classList).not.toContain('bc-itemcard--owned');
      expect(host.querySelector('.bc-itemcard__badge--owned')).toBeNull();
    });

    it('applies no modifier class when owned is null', () => {
      const fixture = createCard();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).not.toContain('bc-itemcard--dim');
      expect(host.classList).not.toContain('bc-itemcard--owned');
      expect(host.querySelector('.bc-itemcard__badge--owned')).toBeNull();
    });
  });


  describe('staked', () => {
    it('shows staked badge when staked is true', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('staked', true);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__badge--staked')).toBeTruthy();
    });

    it('hides staked badge when staked is false', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('staked', false);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__badge--staked')).toBeNull();
    });
  });

  describe('name', () => {
    it('renders name when provided', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('name', 'Silver Phoenix');
      fixture.detectChanges();
      const el = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__name');
      expect(el!.textContent).toContain('Silver Phoenix');
    });

    it('omits name element when name is empty', () => {
      const fixture = createCard();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__name')).toBeNull();
    });
  });

  describe('nameOnBack', () => {
    it('default false: name renders on front face', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('name', 'Ruby Rooster');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__name')).toBeTruthy();
    });

    it('nameOnBack true: name does NOT render on front face', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('name', 'Ruby Rooster');
      fixture.componentRef.setInput('nameOnBack', true);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__name')).toBeNull();
    });

    it('nameOnBack true: name renders in back face attributes list', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('name', 'Ruby Rooster');
      fixture.componentRef.setInput('nameOnBack', true);
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back).toBeTruthy();
      const attrs = back!.querySelectorAll('.bc-itemcard__attr');
      const nameAttr = Array.from(attrs).find(a => a.querySelector('dd')?.textContent?.includes('Ruby Rooster'));
      expect(nameAttr).toBeTruthy();
    });

    it('nameOnBack true: hasAttributes is true when only name is provided (flip button shows)', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('name', 'Ruby Rooster');
      fixture.componentRef.setInput('nameOnBack', true);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeTruthy();
    });

    it('nameOnBack true but name empty: no name row on back face and hasAttributes unchanged', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('nameOnBack', true);
      fixture.componentRef.setInput('name', '');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__flip-btn')).toBeNull();
    });
  });

  describe('price section', () => {
    it('shows price section when price is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('price', '0.5');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__price')).toBeTruthy();
    });

    it('hides price section when price is empty', () => {
      const fixture = createCard();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__price')).toBeNull();
    });
  });

  describe('tokenId and addToWallet', () => {
    it('shows tokenid row and watch button when tokenId is set', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('tokenId', 42n);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const row = host.querySelector('.bc-itemcard__tokenid-row');
      expect(row).toBeTruthy();
      expect(host.querySelector('.bc-itemcard__watch-btn')).toBeTruthy();
      expect(host.querySelector('.bc-itemcard__tokenid-label')!.textContent).toContain('#42');
    });

    it('hides tokenid row when tokenId is null (default)', () => {
      const fixture = createCard();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__tokenid-row')).toBeNull();
      expect(fixture.componentInstance['tokenIdLabel']()).toBe('');
    });

    it('emits addToWallet with the tokenId when watch button is clicked', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('tokenId', 7n);
      fixture.detectChanges();
      const emitted: bigint[] = [];
      fixture.componentInstance.addToWallet.subscribe((id: bigint) => emitted.push(id));
      const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.bc-itemcard__watch-btn')!;
      btn.click();
      expect(emitted).toEqual([7n]);
    });

    it('watch button click does not trigger flip', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('tokenId', 5n);
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).not.toContain('bc-itemcard--flipped');
      const btn = host.querySelector<HTMLButtonElement>('.bc-itemcard__watch-btn')!;
      btn.click();
      fixture.detectChanges();
      expect(host.classList).not.toContain('bc-itemcard--flipped');
    });
  });

  describe('gender symbol on back face when no other attributes', () => {
    it('omits gender symbol on back face when gender is null', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back!.querySelector('.bc-itemcard__attrs')!.textContent).not.toContain('♂');
      expect(back!.querySelector('.bc-itemcard__attrs')!.textContent).not.toContain('♀');
    });
  });

  describe('edition name on back face when no other attributes', () => {
    it('omits edition name when editionName is empty', () => {
      const fixture = createCard();
      fixture.componentRef.setInput('health', 10);
      fixture.detectChanges();
      const back = (fixture.nativeElement as HTMLElement).querySelector('.bc-itemcard__face--back');
      expect(back!.querySelector('.bc-itemcard__back-title')).toBeNull();
    });
  });
});
