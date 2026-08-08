import { describe, expect, it } from 'vitest';
import { escapeHTML } from '../snippet-rendering';

describe('escapeHTML', () => {
  it('encodes text and quoted attribute delimiters', () => {
    expect(escapeHTML(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
    );
  });

  it('keeps ordinary prompt text unchanged', () => {
    expect(escapeHTML('Explain this function\nStep 1')).toBe('Explain this function\nStep 1');
  });
});
