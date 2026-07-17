import { addressUrl, sourceUrl, tokenUrl, txUrl } from './explorer';

describe('explorer', () => {
  it('builds a transaction URL', () => {
    expect(txUrl('0xhash')).toBe('https://testnet.bscscan.com/tx/0xhash');
  });

  it('builds an address URL', () => {
    expect(addressUrl('0xabc')).toBe('https://testnet.bscscan.com/address/0xabc');
  });

  it('builds a token URL', () => {
    expect(tokenUrl('0xtoken')).toBe('https://testnet.bscscan.com/token/0xtoken');
  });

  it('builds a verified-source URL', () => {
    expect(sourceUrl('0xabc')).toBe('https://testnet.bscscan.com/address/0xabc#code');
  });
});
