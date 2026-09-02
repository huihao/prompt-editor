import {
  NativeClientError,
  unsupported,
  type DetectedAgent,
  type NativeCapability,
  type NativeClient,
  type NativeOperationResult,
  type SendRequest,
} from './native-client';

export type ClipboardWriter = (content: string) => Promise<void>;

export class BrowserNativeClient implements NativeClient {
  readonly platform = 'browser' as const;
  readonly capabilities: ReadonlySet<NativeCapability>;

  constructor(private readonly clipboardWrite?: ClipboardWriter) {
    this.capabilities = new Set<NativeCapability>(
      clipboardWrite ? ['clipboard.write'] : [],
    );
  }

  send(_request: SendRequest): Promise<void> {
    return Promise.reject(unsupported('content.send'));
  }

  async writeClipboard(content: string): Promise<void> {
    if (!this.clipboardWrite) {
      throw new NativeClientError(
        'unavailable',
        'The browser Clipboard API is unavailable',
        'clipboard.write',
      );
    }

    try {
      await this.clipboardWrite(content);
    } catch (cause) {
      throw new NativeClientError(
        'native-failure',
        'Failed to write to the browser clipboard',
        'clipboard.write',
        cause,
      );
    }
  }

  pasteToPrevious(_content: string): Promise<NativeOperationResult> {
    return Promise.reject(unsupported('content.pastePrevious'));
  }

  hideWindow(): Promise<void> {
    return Promise.reject(unsupported('window.hide'));
  }

  openAccessibilitySettings(): Promise<void> {
    return Promise.reject(unsupported('accessibility.openSettings'));
  }

  resetAccessibilityPermission(): Promise<void> {
    return Promise.reject(unsupported('accessibility.reset'));
  }

  restartApp(): Promise<void> {
    return Promise.reject(unsupported('app.restart'));
  }

  pickDirectory(): Promise<string | null> {
    return Promise.reject(unsupported('directory.pick'));
  }

  readFile(_path: string): Promise<string> {
    return Promise.reject(unsupported('file.read'));
  }

  saveTextFile(_request: { filename: string; content: string }): Promise<boolean> {
    return Promise.reject(unsupported('file.save'));
  }

  listRunningAgents(): Promise<DetectedAgent[]> {
    return Promise.reject(unsupported('agents.list'));
  }
}
