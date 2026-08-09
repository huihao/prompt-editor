import { BrowserNativeClient } from './browser-client';
import type { NativeClient } from './native-client';
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
}

export function runtimeFromWindow(): NativeRuntime {
  const nativeWindow = window as typeof window & {
    webkit?: {
      messageHandlers?: {
        promptEditor?: { postMessage(message: unknown): void };
      };
    };
    __TAURI__?: {
      invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    };
  };
  const clipboard = navigator.clipboard;

  return {
    wkMessageHandler: nativeWindow.webkit?.messageHandlers?.promptEditor,
    tauriInvoke: nativeWindow.__TAURI__?.invoke?.bind(nativeWindow.__TAURI__),
    clipboardWrite: clipboard?.writeText?.bind(clipboard),
    callbackHost: window as unknown as Record<string, unknown>,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  };
}

export function createNativeClient(
  runtime: NativeRuntime = runtimeFromWindow(),
): NativeClient {
  if (runtime.wkMessageHandler) {
    return new WKWebViewNativeClient({
      wkMessageHandler: runtime.wkMessageHandler,
      callbackHost: runtime.callbackHost,
      setTimeout: runtime.setTimeout,
      clearTimeout: runtime.clearTimeout,
    });
  }

  return new BrowserNativeClient(runtime.clipboardWrite);
}
