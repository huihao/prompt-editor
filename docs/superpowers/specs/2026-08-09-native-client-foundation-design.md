# Native Client Foundation Design

## Goal

Introduce one typed frontend port for native capabilities so application code no longer needs to know whether it runs in WKWebView, Tauri, or a browser. Preserve existing macOS behavior while making unsupported behavior explicit and creating a stable boundary for later platform and storage work.

## Scope

This phase covers the native operations currently orchestrated directly by `editor/src/bridge.ts`:

- Send content to a target.
- Copy content to the clipboard.
- Paste content to the previously focused application.
- Hide the application window.
- Open macOS accessibility settings.
- Restart the application.
- Choose a directory.
- Read a file.
- List running agents.

It also introduces the shared capability and error model used by future adapters.

This phase does not migrate prompt memory, terminal capture, file scanning, storage, API keys, the native snippet wheel, or macOS `MainWindow` handlers. Those features will migrate after this foundation is stable.

## Architecture

The frontend will use the following dependency direction:

```text
bridge.ts application facade
          |
          v
NativeClient typed port
          |
          +-- WKWebViewNativeClient
          +-- TauriNativeClient
          +-- BrowserNativeClient
```

Only `createNativeClient()` may inspect platform globals such as `window.webkit` and `window.__TAURI__`. The application-facing `bridge` receives or imports the selected `NativeClient` and invokes typed methods.

The existing exported `bridge` API remains available so editor callers do not change in this phase. DOM rendering and history responsibilities remain in `bridge.ts` temporarily; extracting those responsibilities is a separate phase.

## Files And Responsibilities

- `editor/src/platform/native-client.ts`
  Defines command payloads, results, capabilities, error codes, the `NativeClient` interface, and shared helpers. It has no DOM or platform-global dependencies.
- `editor/src/platform/wkwebview-client.ts`
  Converts typed calls into the existing `window.webkit.messageHandlers.promptEditor.postMessage` action dictionaries. It owns callback registration, timeout cleanup, and native result decoding.
- `editor/src/platform/tauri-client.ts`
  Converts supported calls into Tauri `invoke` calls. Initially, send, copy, and hide use the existing `handle_editor_message` command. Operations without a Windows command return `unsupported`.
- `editor/src/platform/browser-client.ts`
  Implements clipboard writes through `navigator.clipboard` and returns `unsupported` for native-only operations. It never returns fake files, directories, agents, or successful native actions.
- `editor/src/platform/create-native-client.ts`
  Selects exactly one adapter. Selection order is WKWebView, Tauri, then browser.
- `editor/src/bridge.ts`
  Uses `NativeClient` for the operations in scope and stops directly checking WKWebView or Tauri globals for those operations.
- `editor/src/__tests__/native-client-contract.test.ts`
  Runs the same behavioral contract against adapter test harnesses.
- `editor/src/__tests__/bridge.test.ts`
  Verifies that the existing facade delegates correctly and preserves current user-facing behavior.

## Typed Contract

Capabilities are stable string identifiers:

```ts
type NativeCapability =
  | 'content.send'
  | 'clipboard.write'
  | 'content.pastePrevious'
  | 'window.hide'
  | 'accessibility.openSettings'
  | 'app.restart'
  | 'directory.pick'
  | 'file.read'
  | 'agents.list';
```

The client exposes explicit methods instead of an untyped public `postMessage` method:

```ts
interface NativeClient {
  readonly platform: 'macos' | 'windows' | 'browser';
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

`SendRequest` retains the current fields: `content`, `target`, optional `agentId`, optional `pid`, and optional `terminalApp`. Shared transport types must not import `bridge.ts`; shared agent types move to the platform contract or a neutral model module to keep dependency direction one-way.

## Error Model

Adapters reject with `NativeClientError`, containing one of these codes:

- `unsupported`: the active adapter does not provide the capability.
- `invalid-payload`: the caller supplied data that cannot be sent safely.
- `timeout`: native code did not answer before the operation deadline.
- `native-failure`: native code answered with a failure or invocation rejected.
- `unavailable`: the advertised platform transport disappeared or cannot be called.

Application code may translate these errors into user-facing messages. Adapters do not show UI, log prompt content, or silently substitute mock results.

Fire-and-forget legacy actions such as send and hide resolve once the platform transport accepts the message. This does not claim that terminal automation later succeeded. Commands with existing callbacks resolve only after the callback arrives.

## WKWebView Compatibility

The WKWebView adapter preserves existing action names and payload shapes so no Swift production change is required in this phase.

Callback-based calls use a single adapter-owned registry. Callback names remain compatible with current Swift handlers, but feature modules no longer create global callbacks themselves. Each callback is removed on success, failure, or timeout.

The existing `window.promptEditorNativeResult` entry point remains available for `pasteToPrevious`. It forwards into the WKWebView adapter registry rather than into a registry owned by `bridge.ts`.

## Tauri Compatibility

The Tauri adapter calls:

```ts
window.__TAURI__.invoke('handle_editor_message', { message })
```

for send, clipboard write, and window hide. These are the only operations currently implemented by the Windows shell. Other methods reject with `unsupported`; the UI must not wait for callbacks that Windows cannot send.

No new Windows native behavior is added in this phase. A later platform-completion phase will add directory, file, and agent commands and then expand the advertised capabilities.

## Browser Behavior

The browser adapter supports `clipboard.write` only when `navigator.clipboard.writeText` is available. All desktop-only methods reject with `unsupported`.

Development mode must not generate random directory paths or mock files. Tests that need such data inject a fake `NativeClient` explicitly.

## Capability Semantics

Capabilities are adapter-owned and truthful for the current implementation. The UI may query them to disable or hide unsupported commands. This phase uses local adapter capabilities; a native handshake can replace that implementation later without changing callers.

The initial matrix is:

| Capability | macOS | Windows | Browser |
| --- | --- | --- | --- |
| `content.send` | Yes | Yes | No |
| `clipboard.write` | Yes | Yes | Conditional |
| `content.pastePrevious` | Yes | No | No |
| `window.hide` | Yes | Yes | No |
| `accessibility.openSettings` | Yes | No | No |
| `app.restart` | Yes | No | No |
| `directory.pick` | Yes | No | No |
| `file.read` | Yes | No | No |
| `agents.list` | Yes | No | No |

## Testing

Tests must establish the following behaviors before implementation:

1. Adapter selection chooses WKWebView before Tauri and browser.
2. WKWebView sends the existing action dictionaries without changing payloads.
3. Callback operations resolve, reject on native failure, time out, and clean their registry entries.
4. Tauri invokes `handle_editor_message` for send, copy, and hide.
5. Unsupported Tauri calls fail immediately with `unsupported`.
6. Browser clipboard uses the Web Clipboard API when present.
7. Browser native-only calls fail without creating mock data.
8. The current `bridge.send`, `copyToClipboard`, `pasteToPrevious`, `hide`, folder picker, file read, and agent listing APIs delegate to the selected client.
9. Existing frontend tests and production build remain green.
10. macOS Swift tests remain green because wire payloads are unchanged.

## Migration And Rollback

Migration is call-by-call inside `bridge.ts`. Each migrated operation gets a failing delegation test before its old platform branch is removed. No localStorage schema or native action name changes, so rollback consists of restoring the previous bridge calls.

The next architecture phase may begin only after all in-scope direct platform checks have been removed from `bridge.ts` and the adapter contract suite passes.

## Success Criteria

- `bridge.ts` contains no direct WKWebView or Tauri checks for the operations in scope.
- Windows send, copy, and hide reach their existing Tauri command instead of logging to the console.
- macOS action names and payloads remain byte-for-byte compatible at the object level.
- Unsupported operations produce typed failures and never mock successful data.
- Adapter contract tests, existing frontend tests, frontend production build, and macOS Swift tests pass.
