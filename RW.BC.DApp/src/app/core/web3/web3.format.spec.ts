import { parseEther } from 'ethers';
import { formatAmount, formatFiat, parseAmount, shortAddress, shortHash, weiToBnb } from './web3.format';

describe('web3.format', () => {
  it('formats wei to a readable amount', () => {
    expect(formatAmount(parseEther('1.5'))).toBe('1.5');
  });

  it('limits the number of fraction digits', () => {
    expect(formatAmount(parseEther('1.123456'), 2)).toBe('1.12');
  });

  it('parses a decimal value to wei', () => {
    expect(parseAmount('2')).toBe(parseEther('2'));
  });

  it('shortens a transaction hash', () => {
    const hash = `0x${'a'.repeat(64)}`;
    expect(shortHash(hash)).toBe('0xaaaaaaaa…aaaaaa');
  });

  it('converts wei to a BNB number', () => {
    expect(weiToBnb(parseEther('2.5'))).toBe(2.5);
  });

  it('formats a value as USD currency for en-US', () => {
    expect(formatFiat(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
  });

  it('formats a value as BRL currency for pt-BR', () => {
    expect(formatFiat(1234.5, 'BRL', 'pt-BR')).toMatch(/^R\$\s?1\.234,50$/);
  });

  it('shortAddress truncates long addresses', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    const result = shortAddress(addr);
    expect(result).toContain('…');
    expect(result.startsWith('0x1234')).toBe(true);
    expect(result.endsWith('5678')).toBe(true);
  });

  it('shortAddress returns short strings unchanged', () => {
    expect(shortAddress('0xABC')).toBe('0xABC');
  });

  it('shortAddress handles exactly 12 characters unchanged', () => {
    expect(shortAddress('0xABCDEF1234')).toBe('0xABCDEF1234');
  });
});
