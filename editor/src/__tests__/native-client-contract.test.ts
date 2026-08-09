import { describe, expect, it } from 'vitest';
import {
  NativeClientError,
  allCapabilities,
  unsupported,
} from '../platform/native-client';

describe('NativeClient contract', () => {
  it('exposes stable capabilities and typed unsupported errors', () => {
    expect(allCapabilities).toContain('content.send');
    expect(allCapabilities).toContain('agents.list');

    const error = unsupported('file.read');
    expect(error).toBeInstanceOf(NativeClientError);
    expect(error.code).toBe('unsupported');
    expect(error.capability).toBe('file.read');
  });
});
