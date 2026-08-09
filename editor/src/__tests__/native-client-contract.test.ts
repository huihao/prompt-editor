import { describe, expect, it, vi } from 'vitest';
import {
  NativeClientError,
  allCapabilities,
  unsupported,
} from '../platform/native-client';
import { BrowserNativeClient } from '../platform/browser-client';
import { createNativeClient } from '../platform/create-native-client';

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

describe('BrowserNativeClient', () => {
  it('writes through an available browser clipboard', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    const client = new BrowserNativeClient(clipboardWrite);

    expect(client.capabilities.has('clipboard.write')).toBe(true);
    await client.writeClipboard('hello');

    expect(clipboardWrite).toHaveBeenCalledWith('hello');
  });

  it('does not fabricate native-only results', async () => {
    const client = createNativeClient({ clipboardWrite: vi.fn() });

    expect(client.platform).toBe('browser');
    await expect(client.pickDirectory()).rejects.toMatchObject({
      code: 'unsupported',
      capability: 'directory.pick',
    });
  });

  it('reports an unavailable clipboard when the API is absent', async () => {
    const client = new BrowserNativeClient();

    expect(client.capabilities.has('clipboard.write')).toBe(false);
    await expect(client.writeClipboard('hello')).rejects.toMatchObject({
      code: 'unavailable',
      capability: 'clipboard.write',
    });
  });
});
