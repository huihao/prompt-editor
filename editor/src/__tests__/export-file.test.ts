import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeClientError } from '../platform/native-client';

const saveTextFileMock = vi.fn();

vi.mock('../platform/create-native-client', () => ({
  createNativeClient: () => ({ saveTextFile: saveTextFileMock }),
}));

import { exportTextFile } from '../export-file';

describe('exportTextFile', () => {
  beforeEach(() => {
    saveTextFileMock.mockReset();
  });

  it('reports saved when the native save panel completes', async () => {
    saveTextFileMock.mockResolvedValue(true);

    await expect(exportTextFile('plan.md', '# Plan', 'text/markdown')).resolves.toBe('saved');
    expect(saveTextFileMock).toHaveBeenCalledWith({ filename: 'plan.md', content: '# Plan' });
  });

  it('reports cancelled when the user dismisses the save panel', async () => {
    saveTextFileMock.mockResolvedValue(false);

    await expect(exportTextFile('plan.md', '# Plan', 'text/markdown')).resolves.toBe('cancelled');
  });

  it('rethrows native failures other than unsupported', async () => {
    saveTextFileMock.mockRejectedValue(
      new NativeClientError('native-failure', 'Disk full', 'file.save'),
    );

    await expect(exportTextFile('plan.md', '# Plan', 'text/markdown'))
      .rejects.toMatchObject({ code: 'native-failure' });
  });

  it('falls back to an anchor download when native save is unsupported', async () => {
    saveTextFileMock.mockRejectedValue(
      new NativeClientError('unsupported', 'Native capability is not supported: file.save', 'file.save'),
    );
    const createObjectURL = vi.fn((_obj: Blob) => 'blob:mock');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      await expect(exportTextFile('plan.json', '{"a":1}', 'application/json')).resolves.toBe('downloaded');

      expect(createObjectURL).toHaveBeenCalledOnce();
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe('application/json');
      expect(blob.size).toBe('{"a":1}'.length);
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    } finally {
      click.mockRestore();
      Reflect.deleteProperty(URL, 'createObjectURL');
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });
});
