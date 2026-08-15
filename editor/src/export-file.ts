import { createNativeClient } from './platform/create-native-client';
import { NativeClientError } from './platform/native-client';

export type ExportResult = 'saved' | 'cancelled' | 'downloaded';

export async function exportTextFile(
  filename: string,
  content: string,
  mimeType: string,
): Promise<ExportResult> {
  try {
    const saved = await createNativeClient().saveTextFile({ filename, content });
    return saved ? 'saved' : 'cancelled';
  } catch (error) {
    if (!(error instanceof NativeClientError && error.code === 'unsupported')) {
      throw error;
    }
  }

  downloadViaAnchor(filename, content, mimeType);
  return 'downloaded';
}

function downloadViaAnchor(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
