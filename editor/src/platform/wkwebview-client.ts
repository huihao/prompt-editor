import {
  NativeClientError,
  allCapabilities,
  type DetectedAgent,
  type NativeCapability,
  type NativeClient,
  type NativeOperationResult,
  type SendRequest,
} from './native-client';

export interface WKWebViewRuntime {
  wkMessageHandler: { postMessage(message: unknown): void };
  callbackHost?: Record<string, unknown>;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}

type NativeCallback = (result: unknown, error?: string) => void;
type PasteResolver = (result: NativeOperationResult) => void;

const agentTypes = new Set<DetectedAgent['type']>([
  'claude',
  'kimi',
  'codex',
  'cursor',
  'warp',
  'unknown',
]);

function isDetectedAgent(value: unknown): value is DetectedAgent {
  if (typeof value !== 'object' || value === null) return false;
  const agent = value as Record<string, unknown>;
  const optionalStrings = ['terminalApp', 'workingDirectory', 'windowTitle'];

  return (
    typeof agent.id === 'string' &&
    typeof agent.name === 'string' &&
    typeof agent.type === 'string' &&
    agentTypes.has(agent.type as DetectedAgent['type']) &&
    typeof agent.pid === 'number' &&
    Number.isInteger(agent.pid) &&
    agent.pid >= 0 &&
    optionalStrings.every(
      (field) => agent[field] === undefined || typeof agent[field] === 'string',
    )
  );
}

export class WKWebViewNativeClient implements NativeClient {
  readonly platform = 'macos' as const;
  readonly capabilities: ReadonlySet<NativeCapability> = new Set(allCapabilities);

  private readonly callbackHost: Record<string, unknown>;
  private readonly scheduleTimeout: typeof globalThis.setTimeout;
  private readonly cancelTimeout: typeof globalThis.clearTimeout;
  private readonly pasteResolvers = new Map<string, PasteResolver>();
  private requestSequence = 0;

  constructor(private readonly runtime: WKWebViewRuntime) {
    this.callbackHost = runtime.callbackHost ?? (window as unknown as Record<string, unknown>);
    this.scheduleTimeout = runtime.setTimeout ?? globalThis.setTimeout.bind(globalThis);
    this.cancelTimeout = runtime.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
    this.callbackHost.promptEditorNativeResult = (
      requestId: string,
      success: boolean,
      message: string,
    ) => {
      const resolve = this.pasteResolvers.get(requestId);
      if (!resolve) return;
      this.pasteResolvers.delete(requestId);
      resolve({ success, message });
    };
  }

  async send(request: SendRequest): Promise<void> {
    const message: Record<string, unknown> = {
      action: 'send',
      content: request.content,
      target: request.target,
    };
    if (request.agentId !== undefined) message.agentId = request.agentId;
    if (request.pid !== undefined) message.pid = request.pid;
    if (request.terminalApp !== undefined) message.terminalApp = request.terminalApp;
    this.post(message, 'content.send');
  }

  async writeClipboard(content: string): Promise<void> {
    this.post({ action: 'copy', content }, 'clipboard.write');
  }

  pasteToPrevious(content: string): Promise<NativeOperationResult> {
    const requestId = this.nextRequestId('paste');

    return new Promise((resolve, reject) => {
      const timeout = this.scheduleTimeout(() => {
        if (!this.pasteResolvers.delete(requestId)) return;
        reject(
          new NativeClientError(
            'timeout',
            'Timed out waiting for the macOS paste service',
            'content.pastePrevious',
          ),
        );
      }, 5000);

      this.pasteResolvers.set(requestId, (result) => {
        this.cancelTimeout(timeout);
        resolve(result);
      });

      try {
        this.runtime.wkMessageHandler.postMessage({
          action: 'pasteToPrevious',
          content,
          callback: requestId,
        });
      } catch (cause) {
        this.cancelTimeout(timeout);
        this.pasteResolvers.delete(requestId);
        reject(this.nativeFailure('content.pastePrevious', cause));
      }
    });
  }

  async hideWindow(): Promise<void> {
    this.post({ action: 'hide' }, 'window.hide');
  }

  async openAccessibilitySettings(): Promise<void> {
    this.post({ action: 'openAccessibilitySettings' }, 'accessibility.openSettings');
  }

  async restartApp(): Promise<void> {
    this.post({ action: 'restartApp' }, 'app.restart');
  }

  pickDirectory(): Promise<string | null> {
    return this.requestWithGlobalCallback(
      'showFolderPicker',
      {},
      'directory.pick',
      (result) => {
        if (result === null || typeof result === 'string') return result;
        throw new NativeClientError(
          'invalid-payload',
          'The macOS directory picker returned an invalid path',
          'directory.pick',
        );
      },
      60000,
    );
  }

  readFile(path: string): Promise<string> {
    return this.requestWithGlobalCallback(
      'readFile',
      { path },
      'file.read',
      (result) => {
        if (typeof result === 'string') return result;
        throw new NativeClientError(
          'invalid-payload',
          'The macOS file reader returned invalid content',
          'file.read',
        );
      },
      5000,
    );
  }

  listRunningAgents(): Promise<DetectedAgent[]> {
    return this.requestWithGlobalCallback(
      'getRunningAgents',
      {},
      'agents.list',
      (result) => {
        if (typeof result !== 'string') {
          throw new NativeClientError(
            'invalid-payload',
            'The macOS agent service returned an invalid payload',
            'agents.list',
          );
        }

        try {
          const agents: unknown = JSON.parse(result);
          if (!Array.isArray(agents) || !agents.every(isDetectedAgent)) {
            throw new Error('Expected an array of valid agents');
          }
          return agents;
        } catch (cause) {
          throw new NativeClientError(
            'invalid-payload',
            'The macOS agent service returned invalid JSON',
            'agents.list',
            cause,
          );
        }
      },
      5000,
    );
  }

  private post(message: Record<string, unknown>, capability: NativeCapability): void {
    try {
      this.runtime.wkMessageHandler.postMessage(message);
    } catch (cause) {
      throw this.nativeFailure(capability, cause);
    }
  }

  private requestWithGlobalCallback<T>(
    action: string,
    payload: Record<string, unknown>,
    capability: NativeCapability,
    decode: (result: unknown) => T,
    timeoutMs: number,
  ): Promise<T> {
    const callbackName = this.nextRequestId(`${action}Callback`);

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.cancelTimeout(timeout);
        delete this.callbackHost[callbackName];
      };
      const timeout = this.scheduleTimeout(() => {
        delete this.callbackHost[callbackName];
        reject(
          new NativeClientError(
            'timeout',
            `Timed out waiting for native action: ${action}`,
            capability,
          ),
        );
      }, timeoutMs);

      const callback: NativeCallback = (result, error) => {
        cleanup();
        if (error) {
          reject(new NativeClientError('native-failure', error, capability));
          return;
        }

        try {
          resolve(decode(result));
        } catch (cause) {
          reject(
            cause instanceof NativeClientError
              ? cause
              : new NativeClientError(
                  'invalid-payload',
                  `Native action returned an invalid payload: ${action}`,
                  capability,
                  cause,
                ),
          );
        }
      };

      this.callbackHost[callbackName] = callback;
      try {
        this.runtime.wkMessageHandler.postMessage({
          action,
          ...payload,
          callback: callbackName,
        });
      } catch (cause) {
        cleanup();
        reject(this.nativeFailure(capability, cause));
      }
    });
  }

  private nextRequestId(prefix: string): string {
    this.requestSequence += 1;
    return `${prefix}_${Date.now()}_${this.requestSequence}`;
  }

  private nativeFailure(
    capability: NativeCapability,
    cause: unknown,
  ): NativeClientError {
    return new NativeClientError(
      'native-failure',
      `Native operation failed: ${capability}`,
      capability,
      cause,
    );
  }
}
