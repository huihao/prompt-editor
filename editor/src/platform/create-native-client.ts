import { BrowserNativeClient } from './browser-client';
import { LinuxNativeClient } from './linux-client';
import type { NativeClient } from './native-client';
import { TauriNativeClient } from './tauri-client';
import { WKWebViewNativeClient } from './wkwebview-client';

export interface NativeRuntime {
  wkMessageHandler?: { postMessage(message: unknown): void };
  tauriInvoke?: <T>(
    command: string,
    args?: Record<string, unknown>,
  ) => Promise<T>;
  clipboardWrite?: (content: string) => Promise<void>;
  callbackHost?: Record<string, unknown>;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  nativePlatform?: 'linux';
  userAgent?: string;
}

export function runtimeFromWindow(): NativeRuntime {
  const nativeWindow = window as typeof window & {
    webkit?: {
      messageHandlers?: {
        promptEditor?: { postMessage(message: unknown): void };
      };
    };
    __TAURI__?: {
      tauri?: {
        invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
      };
      invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    };
    __PROMPT_EDITOR_PLATFORM__?: 'linux';
  };
  const clipboard = navigator.clipboard;

  return {
    wkMessageHandler: nativeWindow.webkit?.messageHandlers?.promptEditor,
    tauriInvoke:
      nativeWindow.__TAURI__?.tauri?.invoke?.bind(nativeWindow.__TAURI__.tauri) ??
      nativeWindow.__TAURI__?.invoke?.bind(nativeWindow.__TAURI__),
    clipboardWrite: clipboard?.writeText?.bind(clipboard),
    callbackHost: window as unknown as Record<string, unknown>,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    nativePlatform: nativeWindow.__PROMPT_EDITOR_PLATFORM__,
    userAgent: navigator.userAgent,
  };
}

export function createNativeClient(
  runtime: NativeRuntime = runtimeFromWindow(),
): NativeClient {
  if (runtime.wkMessageHandler) {
    const isLinux =
      runtime.nativePlatform === 'linux' ||
      runtime.userAgent?.toLowerCase().includes('linux');
    if (isLinux) {
      return new LinuxNativeClient(runtime.wkMessageHandler);
    }

    return new WKWebViewNativeClient({
      wkMessageHandler: runtime.wkMessageHandler,
      callbackHost: runtime.callbackHost,
      setTimeout: runtime.setTimeout,
      clearTimeout: runtime.clearTimeout,
    });
  }

  if (runtime.tauriInvoke) {
    return new TauriNativeClient(runtime.tauriInvoke);
  }

  return new BrowserNativeClient(runtime.clipboardWrite);
}
