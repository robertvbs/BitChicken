import { clampLevel, getLevelConfig, hexToRgb } from './egg-levels';

describe('egg-levels', () => {
  describe('clampLevel', () => {
    it('keeps an in-range level', () => {
      expect(clampLevel(5)).toBe(5);
    });

    it('rounds fractional levels', () => {
      expect(clampLevel(5.4)).toBe(5);
      expect(clampLevel(5.6)).toBe(6);
    });

    it('floors below 1', () => {
      expect(clampLevel(-3)).toBe(1);
    });

    it('caps above 10', () => {
      expect(clampLevel(15)).toBe(10);
    });

    it('defaults falsy input to 1', () => {
      expect(clampLevel(0)).toBe(1);
      expect(clampLevel(Number.NaN)).toBe(1);
    });
  });

  describe('getLevelConfig', () => {
    it('configures level 1 with no extra features', () => {
      const c = getLevelConfig(1);
      expect(c.level).toBe(1);
      expect(c.shellTop).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.bosses).toBe(false);
      expect(c.antenna).toBe(false);
      expect(c.screen).toBe(false);
      expect(c.rings).toBe(0);
      expect(c.glowCss).toBe(c.glowColor);
      expect(c.accentCss).toBe(c.accent);
    });

    it('unlocks bosses at level 3', () => {
      expect(getLevelConfig(2).bosses).toBe(false);
      expect(getLevelConfig(3).bosses).toBe(true);
    });

    it('unlocks the antenna at level 4', () => {
      expect(getLevelConfig(3).antenna).toBe(false);
      expect(getLevelConfig(4).antenna).toBe(true);
    });

    it('unlocks the screen at level 5', () => {
      expect(getLevelConfig(4).screen).toBe(false);
      expect(getLevelConfig(5).screen).toBe(true);
    });

    it('configures the top level with three rings', () => {
      const c = getLevelConfig(10);
      expect(c.level).toBe(10);
      expect(c.rings).toBe(3);
      expect(c.particles).toBe(22);
    });

    it('clamps an out-of-range level before building', () => {
      expect(getLevelConfig(99).level).toBe(10);
    });
  });

  describe('hexToRgb', () => {
    it('parses a 6-digit hex', () => {
      expect(hexToRgb('#7c8696')).toBe('124,134,150');
    });

    it('parses a hex without the hash', () => {
      expect(hexToRgb('7c8696')).toBe('124,134,150');
    });

    it('expands a 3-digit shorthand hex', () => {
      expect(hexToRgb('#abc')).toBe('170,187,204');
    });
  });
});
