import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// Mock the bridge module's native communication
function createMockView(initialDoc = ''): EditorView {
  const state = EditorState.create({ doc: initialDoc });
  const container = document.createElement('div');
  return new EditorView({ state, parent: container });
}

describe('Bridge', () => {
  let bridge: typeof import('../bridge').bridge;

  beforeEach(async () => {
    delete (window as any).webkit;
    delete (window as any).__TAURI__;
    delete (window as any).promptEditorNativeResult;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    vi.resetModules();
    const mod = await import('../bridge');
    bridge = mod.bridge;
  });

  describe('before init', () => {
    it('getContent returns empty string when no editor', () => {
      expect(bridge.getContent()).toBe('');
    });

    it('setContent does nothing when no editor', () => {
      // Should not throw
      bridge.setContent('test');
    });

    it('send does nothing when no editor (empty content)', () => {
      // Should not throw
      bridge.send();
    });
  });

  describe('after init', () => {
    let view: EditorView;

    beforeEach(() => {
      view = createMockView('');
      bridge.init(view);
    });

    it('getContent returns empty for new editor', () => {
      expect(bridge.getContent()).toBe('');
    });

    it('setContent updates editor content', () => {
      bridge.setContent('Hello World');
      expect(bridge.getContent()).toBe('Hello World');
    });

    it('setContent replaces existing content', () => {
      bridge.setContent('first');
      bridge.setContent('second');
      expect(bridge.getContent()).toBe('second');
    });

    it('setContent handles empty string', () => {
      bridge.setContent('something');
      bridge.setContent('');
      expect(bridge.getContent()).toBe('');
    });

    it('setContent handles multiline content', () => {
      const content = '# Title\n\nParagraph\n\n- item 1\n- item 2';
      bridge.setContent(content);
      expect(bridge.getContent()).toBe(content);
    });

    it('setContent handles unicode', () => {
      bridge.setContent('你好世界 🌍');
      expect(bridge.getContent()).toBe('你好世界 🌍');
    });

    it('setContent handles special characters', () => {
      const content = "quotes: \" ' \\ \n tabs: \t end";
      bridge.setContent(content);
      expect(bridge.getContent()).toBe(content);
    });

    it('clear empties the editor', () => {
      bridge.setContent('content');
      bridge.clear();
      expect(bridge.getContent()).toBe('');
    });

    it('exposes API on window.promptEditor', () => {
      const pe = (window as any).promptEditor;
      expect(pe).toBeDefined();
      expect(typeof pe.getContent).toBe('function');
      expect(typeof pe.setContent).toBe('function');
      expect(typeof pe.focus).toBe('function');
    });

    it('window.promptEditor.getContent returns same as bridge', () => {
      bridge.setContent('test content');
      expect((window as any).promptEditor.getContent()).toBe('test content');
    });

    it('window.promptEditor.setContent updates bridge content', () => {
      (window as any).promptEditor.setContent('from window');
      expect(bridge.getContent()).toBe('from window');
    });
  });

  describe('native messaging', () => {
    let view: EditorView;

    beforeEach(() => {
      view = createMockView('');
      bridge.init(view);
    });

    it('reports unsupported send when no native bridge is available', async () => {
      bridge.setContent('test prompt');
      await expect(bridge.send()).rejects.toMatchObject({
        code: 'unsupported',
        capability: 'content.send',
      });
    });

    it('send does nothing for empty content', async () => {
      bridge.setContent('');
      await bridge.send();
    });

    it('send does nothing for whitespace-only content', async () => {
      bridge.setContent('   \n\t  ');
      await bridge.send();
    });

    it('showHistory shows history panel', () => {
      // Create history panel in DOM for testing
      const panel = document.createElement('div');
      panel.id = 'history-panel';
      const list = document.createElement('div');
      list.id = 'history-list';
      panel.appendChild(list);
      document.body.appendChild(panel);

      bridge.showHistory();
      expect(panel.classList.contains('open')).toBe(true);

      // Cleanup
      document.body.removeChild(panel);
    });

    it('send uses WKWebView bridge when available', async () => {
      const mockPostMessage = vi.fn();
      (window as any).webkit = {
        messageHandlers: {
          promptEditor: { postMessage: mockPostMessage },
        },
      };

      bridge.setContent('native test');
      await bridge.send();

      expect(mockPostMessage).toHaveBeenCalledWith({
        action: 'send',
        content: 'native test',
        target: 'default',
      });

      await expect(bridge.copyToClipboard('copy me')).resolves.toBe(true);
      expect(mockPostMessage).toHaveBeenLastCalledWith({
        action: 'copy',
        content: 'copy me',
      });

      delete (window as any).webkit;
    });

    it('routes supported operations through the Tauri command', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      (window as any).__TAURI__ = { invoke };

      bridge.setContent('windows prompt');
      await bridge.send();
      await bridge.copyToClipboard('copy me');
      bridge.hide();
      await Promise.resolve();

      expect(invoke.mock.calls).toEqual([
        [
          'handle_editor_message',
          {
            message: {
              action: 'send',
              content: 'windows prompt',
              target: 'default',
            },
          },
        ],
        [
          'handle_editor_message',
          { message: { action: 'copy', content: 'copy me' } },
        ],
        ['handle_editor_message', { message: { action: 'hide' } }],
      ]);
    });

    it('uses the browser clipboard without fabricating native results', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      await expect(bridge.copyToClipboard('browser copy')).resolves.toBe(true);
      expect(writeText).toHaveBeenCalledWith('browser copy');
      await expect(bridge.showFolderPicker()).resolves.toBeNull();
      await expect(bridge.readFile('/file')).resolves.toBeNull();
      await expect(bridge.getRunningAgents()).resolves.toEqual([]);
    });

    it('pastes content to the previous native target when available', async () => {
      const mockPostMessage = vi.fn();
      (window as any).webkit = {
        messageHandlers: {
          promptEditor: { postMessage: mockPostMessage },
        },
      };

      bridge.setContent('paste to previous target');
      const resultPromise = bridge.pasteToPrevious();
      const request = mockPostMessage.mock.calls[0][0];

      expect(request).toEqual({
        action: 'pasteToPrevious',
        content: 'paste to previous target',
        callback: expect.any(String),
      });

      (window as any).promptEditorNativeResult(request.callback, true, 'Pasted to previous app');
      await expect(resultPromise).resolves.toEqual({
        success: true,
        message: 'Pasted to previous app',
      });

      delete (window as any).webkit;
    });

    it('translates unsupported paste to the existing facade result', async () => {
      bridge.setContent('paste in browser');

      await expect(bridge.pasteToPrevious()).resolves.toEqual({
        success: false,
        message: 'Paste to last position is only available on macOS',
      });
    });

    it('translates paste timeout to the existing no-response result', async () => {
      vi.useFakeTimers();
      try {
        (window as any).webkit = {
          messageHandlers: { promptEditor: { postMessage: vi.fn() } },
        };
        bridge.setContent('slow paste');

        const result = bridge.pasteToPrevious();
        const expectation = expect(result).resolves.toEqual({
          success: false,
          message: 'No response from macOS paste service',
        });
        await vi.advanceTimersByTimeAsync(5000);
        await expectation;
      } finally {
        vi.useRealTimers();
      }
    });

    it('translates paste transport failures to a stable facade result', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (window as any).webkit = {
        messageHandlers: {
          promptEditor: {
            postMessage: vi.fn(() => {
              throw new Error('Bridge unavailable');
            }),
          },
        },
      };
      bridge.setContent('failed paste');

      await expect(bridge.pasteToPrevious()).resolves.toEqual({
        success: false,
        message: 'Paste to last position failed',
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('failed paste'),
      );
      consoleSpy.mockRestore();
    });
  });
});

describe('EditorView integration', () => {
  it('creates editor with empty document', () => {
    const view = createMockView();
    expect(view.state.doc.toString()).toBe('');
  });

  it('creates editor with initial content', () => {
    const view = createMockView('initial');
    expect(view.state.doc.toString()).toBe('initial');
  });

  it('supports dispatching changes', () => {
    const view = createMockView('hello');
    view.dispatch({
      changes: { from: 0, to: 5, insert: 'world' },
    });
    expect(view.state.doc.toString()).toBe('world');
  });

  it('supports large documents', () => {
    const largeContent = 'line\n'.repeat(10000);
    const view = createMockView(largeContent);
    expect(view.state.doc.lines).toBe(10001); // 10000 lines + trailing empty
  });
});
