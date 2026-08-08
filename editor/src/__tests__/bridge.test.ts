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
    // Re-import to reset module state
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
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      view = createMockView('');
      bridge.init(view);
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('send logs to console when no native bridge', async () => {
      bridge.setContent('test prompt');
      await bridge.send();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[bridge]',
        expect.objectContaining({ action: 'send', content: 'test prompt' })
      );
    });

    it('send does nothing for empty content', async () => {
      bridge.setContent('');
      await bridge.send();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('send does nothing for whitespace-only content', async () => {
      bridge.setContent('   \n\t  ');
      await bridge.send();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('hide posts hide action', () => {
      bridge.hide();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[bridge]',
        expect.objectContaining({ action: 'hide' })
      );
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

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'send', content: 'native test' })
      );
      expect(consoleSpy).not.toHaveBeenCalled();

      delete (window as any).webkit;
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
