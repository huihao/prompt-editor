import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { enhancePrompt } from '../ai-enhance';
import { aiAutocomplete } from '../ai-autocomplete';

const streamAITextMock = vi.fn();

vi.mock('../ai-service', () => ({
  streamAIText: (...args: unknown[]) => streamAITextMock(...args),
}));

vi.mock('../ai-config', () => ({
  isAIConfigured: () => true,
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
    document.querySelector<HTMLButtonElement>('#ai-enhance-apply')?.click();

    expect(view.state.doc.toString()).toBe('alpha better prompt gamma');
  });

  it('shows autocomplete at the cursor instead of only at the end of the document', async () => {
    vi.useFakeTimers();
    const view = createView('alpha beta gamma', 16, 16);

    view.dispatch({ selection: { anchor: 6 } });
    await vi.advanceTimersByTimeAsync(1500);
    await Promise.resolve();

    expect(document.querySelector('.cm-ai-suggestion')?.textContent).toBe('better prompt');
    view.destroy();
  });
});
