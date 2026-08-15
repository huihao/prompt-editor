export type NativePlatform = 'macos' | 'windows' | 'linux' | 'browser';

export const allCapabilities = [
  'content.send',
  'clipboard.write',
  'content.pastePrevious',
  'window.hide',
  'accessibility.openSettings',
  'app.restart',
  'directory.pick',
  'file.read',
  'file.save',
  'agents.list',
] as const;

export type NativeCapability = (typeof allCapabilities)[number];

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
  saveTextFile(request: { filename: string; content: string }): Promise<boolean>;
  listRunningAgents(): Promise<DetectedAgent[]>;
}
