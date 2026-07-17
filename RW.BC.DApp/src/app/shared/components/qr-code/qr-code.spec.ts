import { vi } from 'vitest';

const { qrState } = vi.hoisted(() => ({
  qrState: { impl: (value: string) => Promise.resolve(`<svg data-qr="${value}"></svg>`) },
}));

vi.mock('qrcode', () => ({ toString: (value: string) => qrState.impl(value) }));

import { TestBed } from '@angular/core/testing';
import { QrCode } from './qr-code';

describe('QrCode', () => {
  beforeEach(() => {
    qrState.impl = (value: string) => Promise.resolve(`<svg data-qr="${value}"></svg>`);
  });

  async function render(value: string) {
    await TestBed.configureTestingModule({ imports: [QrCode] }).compileComponents();
    const fixture = TestBed.createComponent(QrCode);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders an SVG QR code for the value', async () => {
    const fixture = await render('https://example.com/?ref=1001');
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('data-qr')).toBe('https://example.com/?ref=1001');
  });

  it('renders nothing when QR generation fails', async () => {
    qrState.impl = () => Promise.reject(new Error('bad'));
    const fixture = await render('whatever');
    expect((fixture.nativeElement as HTMLElement).querySelector('svg')).toBeNull();
  });
});
