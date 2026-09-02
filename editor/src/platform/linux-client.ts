import {
  NativeClientError,
  unsupported,
  type DetectedAgent,
  type NativeCapability,
  type NativeClient,
  type NativeOperationResult,
  type SendRequest,
} from './native-client';

export class LinuxNativeClient implements NativeClient {
  readonly platform = 'linux' as const;
  readonly capabilities: ReadonlySet<NativeCapability> = new Set([
    'content.send',
    'clipboard.write',
    'window.hide',
  ]);

  constructor(
    private readonly messageHandler: { postMessage(message: unknown): void },
  ) {}

  async send(request: SendRequest): Promise<void> {
    this.post({ action: 'send', content: request.content }, 'content.send');
  }

  async writeClipboard(content: string): Promise<void> {
    this.post({ action: 'copy', content }, 'clipboard.write');
  }

  pasteToPrevious(_content: string): Promise<NativeOperationResult> {
    return Promise.reject(unsupported('content.pastePrevious'));
  }

  async hideWindow(): Promise<void> {
    this.post({ action: 'hide' }, 'window.hide');
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

  private post(
    message: Record<string, unknown>,
    capability: NativeCapability,
  ): void {
    try {
      this.messageHandler.postMessage(message);
    } catch (cause) {
      throw new NativeClientError(
        'native-failure',
        `Native operation failed: ${capability}`,
        capability,
        cause,
      );
    }
  }
}
