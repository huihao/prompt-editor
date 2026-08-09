# Native Client Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the frontend's first group of native operations through a typed `NativeClient` with WKWebView, Tauri, and browser adapters while preserving the existing macOS wire contract.

**Architecture:** Add a platform port that owns capabilities, typed errors, platform detection, callback lifecycles, and transport details. Keep the existing `bridge` export as the application facade, but make its in-scope methods delegate to a lazily selected `NativeClient` instead of reading platform globals.

**Tech Stack:** TypeScript, Vitest, WKWebView message handlers, Tauri v1 global API, pnpm, Swift XCTest

---

## File Map

- Create `editor/src/platform/native-client.ts`: platform-neutral models, capabilities, error type, and client interface.
- Create `editor/src/platform/browser-client.ts`: Web Clipboard implementation and explicit unsupported failures.
- Create `editor/src/platform/wkwebview-client.ts`: current macOS action protocol and callback registry.
- Create `editor/src/platform/tauri-client.ts`: current Windows `handle_editor_message` integration.
- Create `editor/src/platform/create-native-client.ts`: the only runtime platform detector.
- Create `editor/src/__tests__/native-client-contract.test.ts`: adapter selection and adapter behavior tests.
- Modify `editor/src/bridge.ts`: delegate in-scope native operations and remove their platform checks and callback registries.
- Modify `editor/src/__tests__/bridge.test.ts`: assert facade delegation and user-facing fallback behavior.

### Task 1: Define The Platform-Neutral Contract

**Files:**
- Create: `editor/src/platform/native-client.ts`
- Create: `editor/src/__tests__/native-client-contract.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create the first section of `native-client-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  NativeClientError,
  allCapabilities,
  unsupported,
} from '../platform/native-client';

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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd editor && pnpm test -- src/__tests__/native-client-contract.test.ts
```

Expected: FAIL because `../platform/native-client` does not exist.

- [ ] **Step 3: Implement the contract**

Create `native-client.ts` with these public definitions:

```ts
export type NativePlatform = 'macos' | 'windows' | 'browser';

export const allCapabilities = [
  'content.send',
  'clipboard.write',
  'content.pastePrevious',
  'window.hide',
  'accessibility.openSettings',
  'app.restart',
  'directory.pick',
  'file.read',
  'agents.list',
] as const;

export type NativeCapability = typeof allCapabilities[number];
export type NativeClientErrorCode =
  | 'unsupported'
  | 'invalid-payload'
  | 'timeout'
  | 'native-failure'
  | 'unavailable';

export interface DetectedAgent {
  id: string;
  name: string;
  type: 'claude' | 'kimi' | 'codex' | 'cursor' | 'warp' | 'unknown';
  pid: number;
  terminalApp?: string;
  workingDirectory?: string;
  windowTitle?: string;
}

export interface SendRequest {
  content: string;
  target: string;
  agentId?: string;
  pid?: number;
  terminalApp?: string;
}

export interface NativeOperationResult {
  success: boolean;
  message: string;
}

export class NativeClientError extends Error {
  constructor(
    public readonly code: NativeClientErrorCode,
    message: string,
    public readonly capability?: NativeCapability,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'NativeClientError';
  }
}

export function unsupported(capability: NativeCapability): NativeClientError {
  return new NativeClientError(
    'unsupported',
    `Native capability is not supported: ${capability}`,
    capability,
  );
}

export interface NativeClient {
  readonly platform: NativePlatform;
  readonly capabilities: ReadonlySet<NativeCapability>;
  send(request: SendRequest): Promise<void>;
  writeClipboard(content: string): Promise<void>;
  pasteToPrevious(content: string): Promise<NativeOperationResult>;
  hideWindow(): Promise<void>;
  openAccessibilitySettings(): Promise<void>;
  restartApp(): Promise<void>;
  pickDirectory(): Promise<string | null>;
  readFile(path: string): Promise<string>;
  listRunningAgents(): Promise<DetectedAgent[]>;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: the contract test passes.

- [ ] **Step 5: Commit the contract**

```bash
git add editor/src/platform/native-client.ts editor/src/__tests__/native-client-contract.test.ts
git commit -m "feat: define native client contract"
```

### Task 2: Implement Browser Behavior And Adapter Selection

**Files:**
- Create: `editor/src/platform/browser-client.ts`
- Create: `editor/src/platform/create-native-client.ts`
- Modify: `editor/src/__tests__/native-client-contract.test.ts`

- [ ] **Step 1: Add failing browser and selection tests**

Add tests that construct a browser adapter with an injected clipboard, assert that clipboard writes succeed, and assert that `pickDirectory()` rejects with `code: 'unsupported'`. Add three factory tests using injected runtime objects:

```ts
it('selects WKWebView before Tauri and browser', () => {
  const client = createNativeClient({
    wkMessageHandler: { postMessage: vi.fn() },
    tauriInvoke: vi.fn(),
    clipboardWrite: vi.fn(),
  });
  expect(client.platform).toBe('macos');
});

it('selects Tauri when WKWebView is absent', () => {
  const client = createNativeClient({ tauriInvoke: vi.fn(), clipboardWrite: vi.fn() });
  expect(client.platform).toBe('windows');
});

it('uses browser without fabricating native results', async () => {
  const clipboardWrite = vi.fn().mockResolvedValue(undefined);
  const client = createNativeClient({ clipboardWrite });
  await client.writeClipboard('hello');
  expect(clipboardWrite).toHaveBeenCalledWith('hello');
  await expect(client.pickDirectory()).rejects.toMatchObject({ code: 'unsupported' });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run the Task 1 test command. Expected: FAIL because browser and factory modules do not exist.

- [ ] **Step 3: Implement `BrowserNativeClient`**

Implement `BrowserNativeClient` with an optional injected clipboard writer. Advertise `clipboard.write` only when that writer exists. `writeClipboard` calls the writer or rejects with `unavailable`; every native-only method rejects using `unsupported`. Do not log payloads or return mock paths.

- [ ] **Step 4: Implement the factory runtime boundary**

Define this injectable runtime shape in `create-native-client.ts`:

```ts
export interface NativeRuntime {
  wkMessageHandler?: { postMessage(message: unknown): void };
  tauriInvoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  clipboardWrite?: (content: string) => Promise<void>;
  callbackHost?: Record<string, unknown>;
  setTimeout?: typeof window.setTimeout;
  clearTimeout?: typeof window.clearTimeout;
}
```

`runtimeFromWindow()` is the only function that reads `window.webkit`, `window.__TAURI__`, `navigator.clipboard`, and timer globals. `createNativeClient(runtime = runtimeFromWindow())` selects WKWebView, then Tauri, then browser.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 1 command. Expected: all contract tests written so far pass.

- [ ] **Step 6: Commit browser and selection support**

```bash
git add editor/src/platform/browser-client.ts editor/src/platform/create-native-client.ts editor/src/__tests__/native-client-contract.test.ts
git commit -m "feat: add browser native adapter selection"
```

### Task 3: Implement The WKWebView Compatibility Adapter

**Files:**
- Create: `editor/src/platform/wkwebview-client.ts`
- Modify: `editor/src/platform/create-native-client.ts`
- Modify: `editor/src/__tests__/native-client-contract.test.ts`

- [ ] **Step 1: Add failing WKWebView payload tests**

Test exact existing action dictionaries for `send`, `writeClipboard`, `hideWindow`, `openAccessibilitySettings`, and `restartApp`. For example:

```ts
await client.send({
  content: 'prompt',
  target: 'codex',
  agentId: 'codex-42',
  pid: 42,
  terminalApp: 'Terminal',
});
expect(postMessage).toHaveBeenCalledWith({
  action: 'send',
  content: 'prompt',
  target: 'codex',
  agentId: 'codex-42',
  pid: 42,
  terminalApp: 'Terminal',
});
```

Add callback tests for directory selection, file reading, agent JSON decoding, native errors, timeout, and callback deletion. Use fake timers so timeout tests complete immediately.

Add a `pasteToPrevious` test that captures the generated request ID and invokes `callbackHost.promptEditorNativeResult(requestId, true, 'Pasted')`.

- [ ] **Step 2: Run focused tests and verify RED**

Run the Task 1 command. Expected: FAIL because WKWebView methods and callback ownership are missing.

- [ ] **Step 3: Implement the WKWebView adapter**

Use a monotonically increasing request sequence and adapter-owned registries. Implement one helper for Swift callback-name operations:

```ts
private requestWithGlobalCallback<T>(
  action: string,
  payload: Record<string, unknown>,
  decode: (result: unknown) => T,
  timeoutMs: number,
): Promise<T>
```

The helper must:

1. Create a collision-resistant callback name.
2. Install it on the injected callback host.
3. Delete it on success, native error, synchronous `postMessage` failure, or timeout.
4. Convert errors into `NativeClientError`.

Keep the legacy callback timeouts: 60 seconds for directory selection and 5 seconds for file read, agent listing, and paste-to-previous.

Install `promptEditorNativeResult` on the callback host and route it through the paste registry. Preserve all current action names and object fields.

- [ ] **Step 4: Wire the factory to the WKWebView adapter**

Replace the temporary WK selection branch with `new WKWebViewNativeClient(runtime)`. The WK adapter advertises every capability in the first-phase matrix.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 1 command. Expected: all WKWebView and earlier tests pass.

- [ ] **Step 6: Commit the macOS adapter**

```bash
git add editor/src/platform/wkwebview-client.ts editor/src/platform/create-native-client.ts editor/src/__tests__/native-client-contract.test.ts
git commit -m "feat: add WKWebView native adapter"
```

### Task 4: Implement The Tauri Adapter

**Files:**
- Create: `editor/src/platform/tauri-client.ts`
- Modify: `editor/src/platform/create-native-client.ts`
- Modify: `editor/src/__tests__/native-client-contract.test.ts`

- [ ] **Step 1: Add failing Tauri contract tests**

Assert that send, copy, and hide invoke the existing command and payload shape:

```ts
await client.send({ content: 'prompt', target: 'default' });
expect(invoke).toHaveBeenCalledWith('handle_editor_message', {
  message: { action: 'send', content: 'prompt', target: 'default' },
});

await client.writeClipboard('copy me');
expect(invoke).toHaveBeenCalledWith('handle_editor_message', {
  message: { action: 'copy', content: 'copy me' },
});

await client.hideWindow();
expect(invoke).toHaveBeenCalledWith('handle_editor_message', {
  message: { action: 'hide' },
});
```

Assert that directory, file, agents, paste-to-previous, accessibility settings, and restart reject immediately with `unsupported`. Assert invocation rejection becomes `native-failure` without logging message content.

- [ ] **Step 2: Run focused tests and verify RED**

Run the Task 1 command. Expected: FAIL because the Tauri adapter is incomplete.

- [ ] **Step 3: Implement `TauriNativeClient`**

Advertise only `content.send`, `clipboard.write`, and `window.hide`. Use one private helper that calls `handle_editor_message` and wraps rejected invocations in `NativeClientError('native-failure', ...)`. Unsupported methods reject using the shared helper.

- [ ] **Step 4: Wire the factory to the Tauri adapter**

Replace the temporary Tauri branch with `new TauriNativeClient(runtime.tauriInvoke)`. Do not change Windows Rust code in this phase.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 1 command. Expected: all adapter and factory tests pass.

- [ ] **Step 6: Commit the Windows adapter**

```bash
git add editor/src/platform/tauri-client.ts editor/src/platform/create-native-client.ts editor/src/__tests__/native-client-contract.test.ts
git commit -m "feat: add Tauri native adapter"
```

### Task 5: Migrate The Existing Bridge Facade

**Files:**
- Modify: `editor/src/bridge.ts`
- Modify: `editor/src/__tests__/bridge.test.ts`

- [ ] **Step 1: Add failing facade delegation tests**

Update bridge tests so platform globals are installed before dynamically importing `bridge.ts`. Cover these outcomes:

- WK send and copy retain exact payloads.
- Tauri send, copy, and hide invoke `handle_editor_message`.
- Browser clipboard calls `navigator.clipboard.writeText`.
- Browser folder picker returns `null`, file read returns `null`, and agent listing returns `[]` after receiving typed `unsupported` errors.
- Browser folder selection never returns one of the old random mock paths.
- Paste-to-previous retains the existing `{ success, message }` facade result for success, unsupported, timeout, and native failure.

- [ ] **Step 2: Run bridge tests and verify RED**

Run:

```bash
cd editor && pnpm test -- src/__tests__/bridge.test.ts
```

Expected: Tauri delegation and removal of mock folder data fail against the current bridge.

- [ ] **Step 3: Add lazy client selection to `bridge.ts`**

Import the contract and factory:

```ts
import { createNativeClient } from './platform/create-native-client';
import {
  DetectedAgent,
  NativeClient,
  NativeClientError,
} from './platform/native-client';

let selectedNativeClient: NativeClient | null = null;
function nativeClient(): NativeClient {
  selectedNativeClient ??= createNativeClient();
  return selectedNativeClient;
}
```

Remove the local `DetectedAgent` declaration, `postToNative`, native request sequence, and result-handler map. Do not expose a production test setter.

- [ ] **Step 4: Migrate fire-and-forget and send operations**

Replace native sends with awaited client calls. Preserve content conversion and history behavior. For methods whose public signature is synchronous (`hide`, `openAccessibilitySettings`, `restartApp`), call the Promise with `void` and log only the error code/message, never prompt content.

The send branch becomes:

```ts
if (effectiveTarget === 'copy') {
  await bridge.copyToClipboard(resolvedContent);
} else {
  await nativeClient().send({
    content: resolvedContent,
    target: agentType,
    agentId: agentInfo?.id,
    pid: agentInfo?.pid,
    terminalApp: agentInfo?.terminalApp,
  });
}
```

- [ ] **Step 5: Migrate callback operations and fallback translations**

Delegate folder selection, file reading, agent listing, and paste-to-previous. Preserve current facade return types:

```ts
async showFolderPicker(): Promise<string | null> {
  try {
    return await nativeClient().pickDirectory();
  } catch (error) {
    if (error instanceof NativeClientError && error.code === 'unsupported') return null;
    console.error('Folder picker failed:', error);
    return null;
  }
}
```

Apply the same translation pattern to `readFile` (`null`) and `getRunningAgents` (`[]`). Translate paste `unsupported` to the current macOS-only message and `timeout` to the current no-response message.

- [ ] **Step 6: Run bridge and adapter tests and verify GREEN**

Run:

```bash
cd editor && pnpm test -- src/__tests__/native-client-contract.test.ts src/__tests__/bridge.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 7: Verify direct platform checks are removed from the scoped facade**

Run:

```bash
rg -n 'window\.webkit|__TAURI__|postToNative|folderCallback_|readFileCallback_|agentsCallback_|nativeResultHandlers' editor/src/bridge.ts
```

Expected: no matches.

- [ ] **Step 8: Commit the facade migration**

```bash
git add editor/src/bridge.ts editor/src/__tests__/bridge.test.ts
git commit -m "refactor: route bridge through native client"
```

### Task 6: Full Verification And Architecture Gate

**Files:**
- Verify: `editor/src/platform/*.ts`
- Verify: `editor/src/bridge.ts`
- Verify: `editor/src/__tests__/*.test.ts`
- Verify: `macos/Tests/PromptEditorTests.swift`

- [ ] **Step 1: Run all frontend tests**

```bash
cd editor && pnpm test
```

Expected: all test files pass with zero failed tests.

- [ ] **Step 2: Run TypeScript production build**

```bash
cd editor && pnpm build
```

Expected: Vite exits 0 and emits `editor/dist/index.html`.

- [ ] **Step 3: Run macOS tests**

```bash
cd macos && swift test
```

Expected: all Swift tests pass, confirming the unchanged message payloads still parse.

- [ ] **Step 4: Run static architecture checks**

```bash
rg -n 'window\.webkit|__TAURI__' editor/src/bridge.ts
rg -n 'mockPaths|Math\.random' editor/src/bridge.ts
git diff --check
```

Expected: both searches have no matches and `git diff --check` exits 0.

- [ ] **Step 5: Review scope against the design**

Confirm that prompt memory, terminal context, file scanning, persistence, API-key storage, native snippet wheel, and Swift command routing did not change. Record any newly discovered work as a later design phase rather than expanding this implementation.
