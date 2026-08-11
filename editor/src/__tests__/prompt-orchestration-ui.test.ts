import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKFLOW_STORAGE_KEY } from '../prompt-workflow-store';

const streamAITextMock = vi.fn();
const showSettingsMock = vi.fn();
let aiConfigured = true;

vi.mock('../ai-service', () => ({
  streamAIText: (...args: unknown[]) => streamAITextMock(...args),
}));

vi.mock('../ai-config', () => ({
  isAIConfigured: () => aiConfigured,
}));

vi.mock('../settings-ui', () => ({
  showSettings: (...args: unknown[]) => showSettingsMock(...args),
}));

import { showPromptOrchestration, showWorkflowManager } from '../prompt-orchestration-ui';

function createView(content: string, from = 0, to = 0) {
  const dispatch = vi.fn();
  const focus = vi.fn();
  return {
    state: {
      selection: { main: { empty: from === to, from, to } },
      doc: {
        length: content.length,
        toString: () => content,
        sliceString: (start: number, end: number) => content.slice(start, end),
      },
    },
    dispatch,
    focus,
  } as any;
}

describe('prompt orchestration UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast"></div>';
    localStorage.clear();
    streamAITextMock.mockReset();
    showSettingsMock.mockReset();
    aiConfigured = true;
  });

  it('requires prompt content before opening the generator', () => {
    showPromptOrchestration(createView('   '));

    expect(document.querySelector('.prompt-workflow-overlay')).toBeNull();
    expect(document.getElementById('toast')?.textContent).toBe('Write something first before orchestrating.');
  });

  it('opens AI settings when AI is not configured', () => {
    aiConfigured = false;
    showPromptOrchestration(createView('Build a launch plan'));

    expect(showSettingsMock).toHaveBeenCalledWith('ai');
    expect(streamAITextMock).not.toHaveBeenCalled();
  });

  it('renders generated stages and saves without changing the editor', () => {
    streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
      onChunk(JSON.stringify({
        title: 'Launch workflow',
        stages: [
          { prompts: [{ title: 'Research', content: 'Research the market.' }] },
          { prompts: [
            { title: 'Copy', content: 'Write launch copy.' },
            { title: 'Visuals', content: 'Define launch visuals.' },
          ] },
        ],
      }));
      onDone();
      return new AbortController();
    });
    const view = createView('Build a launch plan');

    showPromptOrchestration(view);

    expect(document.querySelectorAll('.prompt-workflow-stage')).toHaveLength(2);
    expect(document.querySelectorAll('.prompt-workflow-card')).toHaveLength(3);
    expect(document.querySelector('.prompt-workflow-stage[data-parallel="true"]')).not.toBeNull();
    (document.getElementById('prompt-workflow-save') as HTMLButtonElement).click();

    expect(JSON.parse(localStorage.getItem(WORKFLOW_STORAGE_KEY) || '[]')).toHaveLength(1);
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(document.querySelector('.prompt-workflow-overlay')).toBeNull();
  });

  it('aborts generation when the modal is cancelled', () => {
    const abort = vi.fn();
    streamAITextMock.mockReturnValue({ abort });

    showPromptOrchestration(createView('Build a launch plan'));
    (document.getElementById('prompt-workflow-cancel') as HTMLButtonElement).click();

    expect(abort).toHaveBeenCalled();
    expect(document.querySelector('.prompt-workflow-overlay')).toBeNull();
  });

  it('aborts active generation when another workflow modal opens', () => {
    const abort = vi.fn();
    streamAITextMock.mockReturnValue({ abort });

    const view = createView('Build a launch plan');
    showPromptOrchestration(view);
    showWorkflowManager(view);

    expect(abort).toHaveBeenCalled();
    expect(document.querySelector('.prompt-workflow-manager-overlay')).not.toBeNull();
  });

  it('opens the saved workflow manager', () => {
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify([{
      id: 'workflow-1',
      title: 'Saved workflow',
      sourcePrompt: 'source',
      stages: [{ id: 'stage-1', prompts: [{ id: 'prompt-1', title: 'Step', content: 'Do it' }] }],
      createdAt: 1,
      updatedAt: 1,
    }]));

    showWorkflowManager(createView('draft'));

    expect(document.querySelector('.prompt-workflow-manager-item')?.textContent).toContain('Saved workflow');
  });

  it('uses the current selection as the source prompt', () => {
    streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
      onChunk('{"title":"Selected","stages":[{"prompts":[{"title":"Step","content":"Do it"}]}]}');
      onDone();
      return new AbortController();
    });

    showPromptOrchestration(createView('Ignore this; orchestrate this part.', 13, 34));

    expect(streamAITextMock.mock.calls[0][0][1]).toEqual({
      role: 'user',
      content: 'orchestrate this part',
    });
  });

  it('shows invalid model output and allows regeneration', () => {
    streamAITextMock
      .mockImplementationOnce((_messages, onChunk, onDone) => {
        onChunk('not json');
        onDone();
        return new AbortController();
      })
      .mockImplementationOnce((_messages, onChunk, onDone) => {
        onChunk('{"title":"Recovered","stages":[{"prompts":[{"title":"Step","content":"Do it"}]}]}');
        onDone();
        return new AbortController();
      });

    showPromptOrchestration(createView('Build a workflow'));
    expect(document.querySelector('.prompt-workflow-status')?.textContent).toContain('not valid JSON');
    expect(localStorage.getItem(WORKFLOW_STORAGE_KEY)).toBeNull();

    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();
    expect(document.querySelector<HTMLInputElement>('#prompt-workflow-title')?.value).toBe('Recovered');
  });

  it('preserves the draft and does not save after a stream error', () => {
    streamAITextMock.mockImplementation((_messages, _onChunk, _onDone, onError) => {
      onError(new Error('Network unavailable'));
      return new AbortController();
    });
    const view = createView('Keep this draft');

    showPromptOrchestration(view);

    expect(document.querySelector('.prompt-workflow-status')?.textContent).toBe('Network unavailable');
    expect(localStorage.getItem(WORKFLOW_STORAGE_KEY)).toBeNull();
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('duplicates and deletes workflows from the manager', () => {
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify([{
      id: 'workflow-1',
      title: 'Saved workflow',
      sourcePrompt: 'source',
      stages: [{ id: 'stage-1', prompts: [{ id: 'prompt-1', title: 'Step', content: 'Do it' }] }],
      createdAt: 1,
      updatedAt: 1,
    }]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    showWorkflowManager(createView('draft'));

    document.querySelector<HTMLButtonElement>('[data-action="duplicate"]')?.click();
    expect(document.querySelectorAll('.prompt-workflow-manager-item')).toHaveLength(2);

    document.querySelector<HTMLButtonElement>('[data-action="delete"]')?.click();
    expect(document.querySelectorAll('.prompt-workflow-manager-item')).toHaveLength(1);
  });

  it('adds, duplicates, and moves prompts between stages', () => {
    streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
      onChunk('{"title":"Editable","stages":[{"prompts":[{"title":"Step","content":"Do it"}]}]}');
      onDone();
      return new AbortController();
    });
    showPromptOrchestration(createView('Build a workflow'));

    document.querySelector<HTMLButtonElement>('[data-action="add-prompt"]')?.click();
    expect(document.querySelectorAll('.prompt-workflow-card')).toHaveLength(2);
    expect(document.querySelector('.prompt-workflow-stage')?.getAttribute('data-parallel')).toBe('true');

    document.querySelector<HTMLButtonElement>('[data-action="duplicate-prompt"]')?.click();
    expect(document.querySelectorAll('.prompt-workflow-card')).toHaveLength(3);

    document.querySelector<HTMLButtonElement>('[data-action="add-stage"]')?.click();
    expect(document.querySelectorAll('.prompt-workflow-stage')).toHaveLength(2);

    document.querySelector<HTMLButtonElement>('[data-action="move-prompt-next"]:not([disabled])')?.click();
    expect(document.querySelectorAll('.prompt-workflow-stage')).toHaveLength(2);
    expect(document.querySelectorAll('.prompt-workflow-card')).toHaveLength(4);
  });
});
