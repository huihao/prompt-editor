import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReferencedImages,
  resolveImageUrls,
  prepareContentForSend,
} from '../image-paste';

describe('Image Paste', () => {
  describe('getReferencedImages', () => {
    it('finds all image references in content', () => {
      const content = `
Some text
![image1](image://img_123_abc)
More text
![image2](image://img_456_def)
`;
      const ids = getReferencedImages(content);
      expect(ids).toEqual(['img_123_abc', 'img_456_def']);
    });

    it('returns empty array for no images', () => {
      const content = 'Just plain text';
      expect(getReferencedImages(content)).toEqual([]);
    });

    it('handles multiple images on same line', () => {
      const content = '![a](image://id1) ![b](image://id2)';
      expect(getReferencedImages(content)).toEqual(['id1', 'id2']);
    });
  });

  describe('resolveImageUrls', () => {
    it('keeps original if image not found', () => {
      const content = '![test](image://nonexistent)';
      const resolved = resolveImageUrls(content);
      expect(resolved).toBe(content);
    });

    it('handles content with no images', () => {
      const content = 'Plain text without images';
      expect(resolveImageUrls(content)).toBe(content);
    });
  });

  describe('prepareContentForSend', () => {
    it('handles content with no images', () => {
      const content = 'Just text';
      expect(prepareContentForSend(content)).toBe(content);
    });

    it('preserves other markdown syntax', () => {
      const content = '# Heading\n\n**bold** and [link](http://example.com)';
      expect(prepareContentForSend(content)).toBe(content);
    });
  });
});
