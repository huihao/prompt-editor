import {
  NativeClientError,
  unsupported,
  type DetectedAgent,
  type NativeCapability,
  type NativeClient,
  type NativeOperationResult,
  type SendRequest,
} from './native-client';

export type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export class TauriNativeClient implements NativeClient {
  readonly platform = 'windows' as const;
  readonly capabilities: ReadonlySet<NativeCapability> = new Set([
    'content.send',
    'clipboard.write',
    'window.hide',
  ]);

  constructor(private readonly invoke: TauriInvoke) {}

  async send(request: SendRequest): Promise<void> {
    await this.invokeMessage(
      {
        action: 'send',
        content: request.content,
        target: request.target,
      },
      'content.send',
    );
  }

  async writeClipboard(content: string): Promise<void> {
    await this.invokeMessage({ action: 'copy', content }, 'clipboard.write');
  }

  pasteToPrevious(_content: string): Promise<NativeOperationResult> {
    return Promise.reject(unsupported('content.pastePrevious'));
  }

  async hideWindow(): Promise<void> {
    await this.invokeMessage({ action: 'hide' }, 'window.hide');
  }

  openAccessibilitySettings(): Promise<void> {
    return Promise.reject(unsupported('accessibility.openSettings'));
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

  listRunningAgents(): Promise<DetectedAgent[]> {
    return Promise.reject(unsupported('agents.list'));
  }

  private async invokeMessage(
    message: Record<string, unknown>,
    capability: NativeCapability,
  ): Promise<void> {
    try {
      await this.invoke('handle_editor_message', { message });
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
