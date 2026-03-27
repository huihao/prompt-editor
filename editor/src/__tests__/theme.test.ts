import { describe, it, expect } from 'vitest';

describe('Theme', () => {
  it('exports lightTheme', async () => {
    const { lightTheme } = await import('../theme');
    expect(lightTheme).toBeDefined();
    expect(Array.isArray(lightTheme)).toBe(true);
    expect(lightTheme.length).toBeGreaterThan(0);
  });

  it('exports darkTheme', async () => {
    const { darkTheme } = await import('../theme');
    expect(darkTheme).toBeDefined();
    expect(Array.isArray(darkTheme)).toBe(true);
    expect(darkTheme.length).toBeGreaterThan(0);
  });

  it('light and dark themes are different objects', async () => {
    const { lightTheme, darkTheme } = await import('../theme');
    expect(lightTheme).not.toBe(darkTheme);
  });
});
