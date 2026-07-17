import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { MenuItem } from 'primeng/api';
import { ShareButtons } from './share-buttons';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { AnalyticsService } from '../../../core/analytics/analytics.service';

interface Target {
  name: string;
  icon: string;
}
interface Internals {
  canNativeShare: boolean;
  targets: Target[];
  link(target: Target): string;
  nativeShare(): Promise<void>;
  buildMenuItems(): MenuItem[];
}

function makeAnalyticsSpy() {
  return { track: vi.fn() };
}

describe('ShareButtons', () => {
  async function create(url: string, message?: string) {
    const analyticsSpy = makeAnalyticsSpy();
    await TestBed.configureTestingModule({
      imports: [ShareButtons],
      providers: [
        ...provideTranslateTesting(),
        { provide: AnalyticsService, useValue: analyticsSpy },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ShareButtons);
    fixture.componentRef.setInput('url', url);
    if (message !== undefined) {
      fixture.componentRef.setInput('message', message);
    }
    fixture.detectChanges();
    return { fixture, widget: fixture.componentInstance as unknown as Internals, analyticsSpy };
  }

  it('constrói URL de intent para cada rede social', async () => {
    const { widget } = await create('https://example.com/?ref=1001', 'Hello');
    const byName = (name: string) => widget.targets.find((t) => t.name === name)!;

    expect(widget.link(byName('WhatsApp'))).toContain('https://wa.me/?text=');
    expect(widget.link(byName('WhatsApp'))).toContain(encodeURIComponent('https://example.com/?ref=1001'));
    expect(widget.link(byName('Telegram'))).toContain('https://t.me/share/url?url=');
    expect(widget.link(byName('X'))).toContain('https://twitter.com/intent/tweet?text=');
    expect(widget.link(byName('Facebook'))).toContain('facebook.com/sharer/sharer.php?u=');
    expect(widget.link(byName('LinkedIn'))).toContain('linkedin.com/sharing/share-offsite/?url=');
    expect(widget.link(byName('E-mail'))).toContain('mailto:?subject=');
  });

  it('usa a mensagem traduzida quando nenhuma é fornecida', async () => {
    const { widget } = await create('https://x.test/?ref=1');
    expect(widget.link(widget.targets[0])).toContain(encodeURIComponent('share.message'));
  });

  it('renderiza o botão "Compartilhar" (p-menu toggle)', async () => {
    const { fixture } = await create('https://x.test/?ref=1');
    const btn = (fixture.nativeElement as HTMLElement).querySelector('p-button');
    expect(btn).toBeTruthy();
  });

  it('buildMenuItems retorna 6 itens sem Web Share API', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'share');
    delete (navigator as unknown as Record<string, unknown>)['share'];
    const { widget } = await create('https://x.test/?ref=1');
    expect(widget.canNativeShare).toBe(false);
    const items = widget.buildMenuItems();
    expect(items.length).toBe(6);
    if (original) Object.defineProperty(navigator, 'share', original);
  });

  it('buildMenuItems adiciona item nativo quando Web Share API está disponível', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { widget } = await create('https://x.test/?ref=1');
    expect(widget.canNativeShare).toBe(true);
    const items = widget.buildMenuItems();
    expect(items.length).toBe(7);
    expect(items[0].icon).toBe('pi pi-share-alt');
    delete (navigator as unknown as Record<string, unknown>)['share'];
  });

  it('o command do item nativo chama nativeShare', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { widget } = await create('https://x.test/?ref=1', 'Hi');
    const items = widget.buildMenuItems();
    items[0].command?.({ originalEvent: new MouseEvent('click'), item: items[0] });
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    delete (navigator as unknown as Record<string, unknown>)['share'];
  });

  it('o command de um item de rede abre a URL em nova aba', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { widget } = await create('https://x.test/?ref=1', 'Hi');
    const items = widget.buildMenuItems();
    items[0].command?.({ originalEvent: new MouseEvent('click'), item: items[0] });
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('nativeShare engole um share cancelado', async () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(new Error('cancelled')),
      configurable: true,
    });
    const { widget } = await create('https://x.test/?ref=1');
    await expect(widget.nativeShare()).resolves.toBeUndefined();
    delete (navigator as unknown as Record<string, unknown>)['share'];
  });

  it('abre o menu ao clicar no botão (toggle chamado)', async () => {
    const { fixture } = await create('https://x.test/?ref=1');
    const menuDE = fixture.debugElement.query(By.css('p-menu'));
    expect(menuDE).toBeTruthy();
    const btn = fixture.debugElement.query(By.css('p-button'));
    expect(btn).toBeTruthy();
    btn.triggerEventHandler('onClick', new MouseEvent('click'));
    fixture.detectChanges();
  });

  it('dispara evento share com method=channel ao acionar botão de rede social', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { widget, analyticsSpy } = await create('https://x.test/?ref=1', 'Hi');
    const items = widget.buildMenuItems();
    items[0].command?.({ originalEvent: new MouseEvent('click'), item: items[0] });
    expect(analyticsSpy.track).toHaveBeenCalledWith('share', {
      method: 'WhatsApp',
      content_type: 'referral',
      item_id: 'referral',
    });
    openSpy.mockRestore();
  });

  it('dispara evento share com method=native após compartilhamento nativo bem-sucedido', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { widget, analyticsSpy } = await create('https://x.test/?ref=1', 'Hi');
    await widget.nativeShare();
    expect(analyticsSpy.track).toHaveBeenCalledWith('share', {
      method: 'native',
      content_type: 'referral',
      item_id: 'referral',
    });
    delete (navigator as unknown as Record<string, unknown>)['share'];
  });

  it('NÃO dispara evento share quando compartilhamento nativo é cancelado', async () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(new Error('AbortError')),
      configurable: true,
    });
    const { widget, analyticsSpy } = await create('https://x.test/?ref=1');
    await widget.nativeShare();
    expect(analyticsSpy.track).not.toHaveBeenCalled();
    delete (navigator as unknown as Record<string, unknown>)['share'];
  });
});
