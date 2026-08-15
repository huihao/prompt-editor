import { describe, expect, it, vi } from 'vitest';
import {
  NativeClientError,
  allCapabilities,
  unsupported,
} from '../platform/native-client';
import { BrowserNativeClient } from '../platform/browser-client';
import {
  createNativeClient,
  runtimeFromWindow,
  type NativeRuntime,
} from '../platform/create-native-client';
import { WKWebViewNativeClient } from '../platform/wkwebview-client';
import { TauriNativeClient } from '../platform/tauri-client';

const invokeMock = (): NonNullable<NativeRuntime['tauriInvoke']> => vi.fn(
  async (_command: string, _args?: Record<string, unknown>) => undefined,
) as unknown as NonNullable<NativeRuntime['tauriInvoke']>;

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

describe('WKWebViewNativeClient', () => {
  function createWKClient(postMessage = vi.fn()) {
    const callbackHost: Record<string, unknown> = {};
    const client = new WKWebViewNativeClient({
      wkMessageHandler: { postMessage },
      callbackHost,
    });
    return { callbackHost, client, postMessage };
  }

  it('is selected before other native runtimes', () => {
    const client = createNativeClient({
      wkMessageHandler: { postMessage: vi.fn() },
      tauriInvoke: invokeMock(),
      clipboardWrite: vi.fn(),
      callbackHost: {},
    });

    expect(client.platform).toBe('macos');
  });

  it('preserves the existing fire-and-forget action payloads', async () => {
    const { client, postMessage } = createWKClient();

    await client.send({
      content: 'prompt',
      target: 'codex',
      agentId: 'codex-42',
      pid: 42,
      terminalApp: 'Terminal',
    });
    await client.writeClipboard('copy me');
    await client.hideWindow();
    await client.openAccessibilitySettings();
    await client.restartApp();

    expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
      {
        action: 'send',
        content: 'prompt',
        target: 'codex',
        agentId: 'codex-42',
        pid: 42,
        terminalApp: 'Terminal',
      },
      { action: 'copy', content: 'copy me' },
      { action: 'hide' },
      { action: 'openAccessibilitySettings' },
      { action: 'restartApp' },
    ]);
  });

  it('routes paste results through the shared native result callback', async () => {
    const { callbackHost, client, postMessage } = createWKClient();

    const resultPromise = client.pasteToPrevious('paste me');
    const message = postMessage.mock.calls[0][0];
    expect(message).toEqual({
      action: 'pasteToPrevious',
      content: 'paste me',
      callback: expect.any(String),
    });

    const resolveResult = callbackHost.promptEditorNativeResult as (
      requestId: string,
      success: boolean,
      resultMessage: string,
    ) => void;
    resolveResult(message.callback, true, 'Pasted');

    await expect(resultPromise).resolves.toEqual({ success: true, message: 'Pasted' });
  });

  it('decodes callback operations and deletes callback globals', async () => {
    const { callbackHost, client, postMessage } = createWKClient();

    const directoryPromise = client.pickDirectory();
    const directoryMessage = postMessage.mock.calls[0][0];
    const directoryCallback = callbackHost[directoryMessage.callback] as (
      result: string,
    ) => void;
    directoryCallback('/Users/example/project');
    await expect(directoryPromise).resolves.toBe('/Users/example/project');
    expect(callbackHost).not.toHaveProperty(directoryMessage.callback);

    const agentsPromise = client.listRunningAgents();
    const agentsMessage = postMessage.mock.calls[1][0];
    const agentsCallback = callbackHost[agentsMessage.callback] as (
      result: string,
    ) => void;
    agentsCallback('[{"id":"codex-42","name":"Codex","type":"codex","pid":42}]');
    await expect(agentsPromise).resolves.toEqual([
      { id: 'codex-42', name: 'Codex', type: 'codex', pid: 42 },
    ]);
    expect(callbackHost).not.toHaveProperty(agentsMessage.callback);
  });

  it('rejects malformed agent records inside valid JSON arrays', async () => {
    const { callbackHost, client, postMessage } = createWKClient();

    const agentsPromise = client.listRunningAgents();
    const message = postMessage.mock.calls[0][0];
    const callback = callbackHost[message.callback] as (result: string) => void;
    callback('[null,{"id":"bad","name":"Bad","type":"other","pid":"42"}]');

    await expect(agentsPromise).rejects.toMatchObject({
      code: 'invalid-payload',
      capability: 'agents.list',
    });
    expect(callbackHost).not.toHaveProperty(message.callback);
  });

  it('turns native callback errors into typed failures and cleans up', async () => {
    const { callbackHost, client, postMessage } = createWKClient();

    const resultPromise = client.readFile('/missing');
    const message = postMessage.mock.calls[0][0];
    const callback = callbackHost[message.callback] as (
      result: null,
      error: string,
    ) => void;
    callback(null, 'File not found');

    await expect(resultPromise).rejects.toMatchObject({
      code: 'native-failure',
      capability: 'file.read',
    });
    expect(callbackHost).not.toHaveProperty(message.callback);
  });

  it('cleans up callbacks when posting to WKWebView throws', async () => {
    const postMessage = vi.fn((_message: unknown): void => {
      throw new Error('Bridge unavailable');
    });
    const { callbackHost, client } = createWKClient(postMessage);

    await expect(client.readFile('/file')).rejects.toMatchObject({
      code: 'native-failure',
      capability: 'file.read',
    });
    expect(Object.keys(callbackHost)).toEqual(['promptEditorNativeResult']);
  });

  it('saves text files through the native save panel', async () => {
    const { callbackHost, client, postMessage } = createWKClient();

    const savePromise = client.saveTextFile({ filename: 'plan.md', content: '# Plan' });
    const message = postMessage.mock.calls[0][0];
    expect(message).toEqual({
      action: 'saveFile',
      filename: 'plan.md',
      content: '# Plan',
      callback: expect.any(String),
    });

    const callback = callbackHost[message.callback] as (result: unknown) => void;
    callback('true');
    await expect(savePromise).resolves.toBe(true);

    const cancelPromise = client.saveTextFile({ filename: 'plan.md', content: '# Plan' });
    const cancelMessage = postMessage.mock.calls[1][0];
    (callbackHost[cancelMessage.callback] as (result: unknown) => void)(null);
    await expect(cancelPromise).resolves.toBe(false);
  });

  it('times out callback operations and deletes stale callbacks', async () => {
    vi.useFakeTimers();
    try {
      const { callbackHost, client, postMessage } = createWKClient();
      const resultPromise = client.readFile('/slow');
      const rejection = expect(resultPromise).rejects.toMatchObject({ code: 'timeout' });
      const message = postMessage.mock.calls[0][0];

      await vi.advanceTimersByTimeAsync(5000);

      await rejection;
      expect(callbackHost).not.toHaveProperty(message.callback);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('LinuxNativeClient', () => {
  it('reads the platform marker injected by the Linux shell', () => {
    (window as any).webkit = {
      messageHandlers: { promptEditor: { postMessage: vi.fn() } },
    };
    (window as any).__PROMPT_EDITOR_PLATFORM__ = 'linux';
    try {
      expect(createNativeClient(runtimeFromWindow()).platform).toBe('linux');
    } finally {
      delete (window as any).webkit;
      delete (window as any).__PROMPT_EDITOR_PLATFORM__;
    }
  });

  it('does not classify the Linux WebKit bridge as fully capable macOS', async () => {
    const postMessage = vi.fn();
    const client = createNativeClient({
      wkMessageHandler: { postMessage },
      callbackHost: {},
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15',
    });

    expect(client.platform).toBe('linux');
    expect([...client.capabilities]).toEqual([
      'content.send',
      'clipboard.write',
      'window.hide',
    ]);

    await client.send({ content: 'prompt', target: 'default' });
    await client.writeClipboard('copy me');
    await client.hideWindow();
    expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
      { action: 'send', content: 'prompt' },
      { action: 'copy', content: 'copy me' },
      { action: 'hide' },
    ]);
    await expect(client.pickDirectory()).rejects.toMatchObject({
      code: 'unsupported',
      capability: 'directory.pick',
    });
  });
});

describe('TauriNativeClient', () => {
  it('reads invoke from the Tauri v1 global runtime', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    (window as any).__TAURI__ = { tauri: { invoke } };
    try {
      const runtime = runtimeFromWindow();
      expect(runtime.tauriInvoke).toBeTypeOf('function');

      const client = createNativeClient(runtime);
      expect(client.platform).toBe('windows');
      await client.hideWindow();
      expect(invoke).toHaveBeenCalledWith('handle_editor_message', {
        message: { action: 'hide' },
      });
    } finally {
      delete (window as any).__TAURI__;
    }
  });

  it('is selected when WKWebView is absent', () => {
    const client = createNativeClient({
      tauriInvoke: invokeMock(),
      clipboardWrite: vi.fn(),
    });

    expect(client.platform).toBe('windows');
  });

  it('preserves the existing Tauri command payloads', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const client = new TauriNativeClient(invoke);

    await client.send({ content: 'prompt', target: 'default' });
    await client.writeClipboard('copy me');
    await client.hideWindow();

    expect(invoke.mock.calls).toEqual([
      [
        'handle_editor_message',
        { message: { action: 'send', content: 'prompt', target: 'default' } },
      ],
      [
        'handle_editor_message',
        { message: { action: 'copy', content: 'copy me' } },
      ],
      ['handle_editor_message', { message: { action: 'hide' } }],
    ]);
  });

  it('rejects capabilities that the Windows backend does not implement', async () => {
    const client = new TauriNativeClient(vi.fn());

    await expect(client.pickDirectory()).rejects.toMatchObject({ code: 'unsupported' });
    await expect(client.readFile('/file')).rejects.toMatchObject({ code: 'unsupported' });
    await expect(client.listRunningAgents()).rejects.toMatchObject({ code: 'unsupported' });
    await expect(client.pasteToPrevious('text')).rejects.toMatchObject({ code: 'unsupported' });
    await expect(client.openAccessibilitySettings()).rejects.toMatchObject({ code: 'unsupported' });
    await expect(client.restartApp()).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('wraps invocation failures without logging message content', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('IPC unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = new TauriNativeClient(invoke);

    await expect(
      client.send({ content: 'private prompt', target: 'default' }),
    ).rejects.toMatchObject({
      code: 'native-failure',
      capability: 'content.send',
    });
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
