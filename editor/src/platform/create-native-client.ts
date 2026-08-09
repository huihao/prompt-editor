import { BrowserNativeClient } from './browser-client';
import type { NativeClient } from './native-client';

export interface NativeRuntime {
  clipboardWrite?: (content: string) => Promise<void>;
}

export function runtimeFromWindow(): NativeRuntime {
  const clipboard = navigator.clipboard;

  return {
    clipboardWrite: clipboard?.writeText?.bind(clipboard),
  };
}

export function createNativeClient(
  runtime: NativeRuntime = runtimeFromWindow(),
): NativeClient {
  return new BrowserNativeClient(runtime.clipboardWrite);
}
