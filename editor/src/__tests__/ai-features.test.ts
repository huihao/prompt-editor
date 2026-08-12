import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { enhancePrompt } from '../ai-enhance';
import { aiAutocomplete } from '../ai-autocomplete';

const streamAITextMock = vi.fn();
const getAIPromptMock = vi.fn((feature: string) => `custom ${feature}`);

vi.mock('../ai-service', () => ({
  streamAIText: (...args: unknown[]) => streamAITextMock(...args),
}));

vi.mock('../ai-config', () => ({
  isAIConfigured: () => true,
}));

vi.mock('../ai-prompts', () => ({
  getAIPrompt: (...args: unknown[]) => getAIPromptMock(...args),
}));

vi.mock('../settings-ui', () => ({
  showSettings: vi.fn(),
}));

function createView(doc: string, selectionFrom = doc.length, selectionTo = doc.length): EditorView {
  const state = EditorState.create({
    doc,
    selection: { anchor: selectionFrom, head: selectionTo },
    extensions: [...aiAutocomplete()],
  });
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({ state, parent });
}

describe('AI features', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    streamAITextMock.mockReset();
    getAIPromptMock.mockClear();
    streamAITextMock.mockImplementation((messages, onChunk, onDone) => {
      onChunk('better prompt');
      onDone();
      return new AbortController();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('replaces only the selected range when enhancing a prompt', () => {
    const view = createView('alpha beta gamma', 6, 10);

    enhancePrompt(view);
    expect(streamAITextMock).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>('#ai-enhance-generate')?.textContent).toBe('Enhance');
    document.querySelector<HTMLButtonElement>('#ai-enhance-generate')?.click();
    expect(streamAITextMock).toHaveBeenCalledOnce();
    expect(streamAITextMock.mock.calls[0][0][0]).toEqual({
      role: 'system',
      content: 'custom enhance',
    });
    document.querySelector<HTMLButtonElement>('#ai-enhance-apply')?.click();

    expect(view.state.doc.toString()).toBe('alpha better prompt gamma');
  });

  it('shows provider-reported usage after enhancing', () => {
    streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
      onChunk('better prompt');
      onDone({ inputTokens: 24, outputTokens: 18, cacheReadTokens: 12 });
      return new AbortController();
    });

    enhancePrompt(createView('draft'));
    document.querySelector<HTMLButtonElement>('#ai-enhance-generate')?.click();

    expect(document.querySelector('#ai-enhance-usage')?.textContent).toContain('24 input');
    expect(document.querySelector('#ai-enhance-usage')?.textContent).toContain('18 output');
    expect(streamAITextMock.mock.calls[0][5]).toEqual({ feature: 'enhance' });
  });

  it('renders streamed enhance chunks on the next animation frame', () => {
    let onChunk: ((chunk: string) => void) | undefined;
    streamAITextMock.mockImplementation((_messages, chunkCallback) => {
      onChunk = chunkCallback;
      return new AbortController();
    });
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });

    enhancePrompt(createView('draft'));
    document.querySelector<HTMLButtonElement>('#ai-enhance-generate')?.click();
    onChunk?.('partial');

    expect(document.querySelector('#ai-diff-enhanced')?.textContent).toBe('');
    frameCallbacks.pop()?.(0);
    frameCallbacks.pop()?.(0);
    expect(document.querySelector('#ai-diff-enhanced')?.textContent).toBe('partial');
  });

  it('shows autocomplete at the cursor instead of only at the end of the document', async () => {
    vi.useFakeTimers();
    const view = createView('alpha beta gamma', 16, 16);

    view.dispatch({ selection: { anchor: 6 } });
    await vi.advanceTimersByTimeAsync(1500);
    await Promise.resolve();

    expect(document.querySelector('.cm-ai-suggestion')?.textContent).toBe('better prompt');
    expect(streamAITextMock.mock.calls[0][0][0]).toEqual({
      role: 'system',
      content: 'custom autocomplete',
    });
    view.destroy();
  });
});
