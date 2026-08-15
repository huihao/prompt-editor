import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKFLOW_STORAGE_KEY } from '../prompt-workflow-store';

const streamAITextMock = vi.fn();
const showSettingsMock = vi.fn();
const getAIPromptMock = vi.fn((feature: string) => `custom ${feature}`);
let aiConfigured = true;

vi.mock('../ai-service', () => ({
  streamAIText: (...args: unknown[]) => streamAITextMock(...args),
}));

vi.mock('../ai-config', () => ({
  isAIConfigured: () => aiConfigured,
}));

vi.mock('../ai-prompts', () => ({
  getAIPrompt: (feature: string) => getAIPromptMock(feature),
}));

vi.mock('../settings-ui', () => ({
  showSettings: (...args: unknown[]) => showSettingsMock(...args),
}));

const exportTextFileMock = vi.fn();

vi.mock('../export-file', () => ({
  exportTextFile: (...args: unknown[]) => exportTextFileMock(...args),
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
  it('uses an expanded desktop panel while preserving the mobile viewport constraint', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('width: min(1360px, 96vw); height: min(900px, 92vh);');
    expect(html).toContain('.prompt-workflow-modal { width: 100%; height: 94vh; }');
  });

  it('keeps a hidden workflow status out of the layout', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('.prompt-workflow-status[hidden] { display: none; }');
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="toast"></div>';
    localStorage.clear();
    streamAITextMock.mockReset();
    showSettingsMock.mockReset();
    getAIPromptMock.mockClear();
    exportTextFileMock.mockReset();
    exportTextFileMock.mockResolvedValue('saved');
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

  it('waits for an explicit action before generating a workflow', () => {
    showPromptOrchestration(createView('Build a launch plan'));

    expect(streamAITextMock).not.toHaveBeenCalled();
    expect(document.querySelector('.prompt-workflow-status')?.textContent).toBe('Ready to generate workflow.');
    expect(document.getElementById('prompt-workflow-regenerate')?.textContent).toBe('Generate workflow');

    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();
    expect(streamAITextMock).toHaveBeenCalledOnce();
    expect(streamAITextMock.mock.calls[0][0][0]).toEqual({
      role: 'system',
      content: 'custom orchestration',
    });
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
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();

    expect(document.querySelectorAll('.prompt-workflow-stage')).toHaveLength(2);
    expect(document.querySelectorAll('.prompt-workflow-card')).toHaveLength(3);
    expect(document.querySelector('.prompt-workflow-stage[data-parallel="true"]')).not.toBeNull();
    (document.getElementById('prompt-workflow-save') as HTMLButtonElement).click();

    expect(JSON.parse(localStorage.getItem(WORKFLOW_STORAGE_KEY) || '[]')).toHaveLength(1);
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(document.querySelector('.prompt-workflow-overlay')).toBeNull();
  });

  it('shows provider-reported usage after generating a workflow', () => {
    streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
      onChunk(JSON.stringify({
        title: 'Launch workflow',
        stages: [{ prompts: [{ title: 'Research', content: 'Research the market.' }] }],
      }));
      onDone({ inputTokens: 36, outputTokens: 20, cacheReadTokens: 18 });
      return new AbortController();
    });

    showPromptOrchestration(createView('Build a launch plan'));
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();

    expect(document.querySelector('#prompt-workflow-usage')?.textContent).toContain('36 input');
    expect(document.querySelector('#prompt-workflow-usage')?.textContent).toContain('20 output');
    expect(streamAITextMock.mock.calls[0][5]).toEqual({ feature: 'orchestration' });
  });

  it('hides the generation status after a valid workflow finishes', () => {
    streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
      onChunk(JSON.stringify({
        title: 'Launch workflow',
        stages: [{ prompts: [{ title: 'Research', content: 'Research the market.' }] }],
      }));
      onDone();
      return new AbortController();
    });

    showPromptOrchestration(createView('Build a launch plan'));
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();

    expect(document.querySelector<HTMLElement>('.prompt-workflow-status')?.hidden).toBe(true);
  });

  it('renders complete streamed stages but waits for final validation before saving', () => {
    let onChunk: ((chunk: string) => void) | undefined;
    let onDone: (() => void) | undefined;
    streamAITextMock.mockImplementation((_messages, chunkCallback, doneCallback) => {
      onChunk = chunkCallback;
      onDone = doneCallback;
      return new AbortController();
    });

    showPromptOrchestration(createView('Build a launch plan'));
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();

    onChunk?.('{"title":"Launch workflow","stages":[{"prompts":[{"title":"Research","content":"Research the market."}]},');

    expect(document.querySelectorAll('.prompt-workflow-stage')).toHaveLength(1);
    expect((document.getElementById('prompt-workflow-save') as HTMLButtonElement).disabled).toBe(true);

    onChunk?.('{"prompts":[{"title":"Copy","content":"Write launch copy."}]}]}');
    onDone?.();

    expect(document.querySelectorAll('.prompt-workflow-stage')).toHaveLength(2);
    expect((document.getElementById('prompt-workflow-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps export disabled until the workflow is fully generated', () => {
    let onChunk: ((chunk: string) => void) | undefined;
    let onDone: (() => void) | undefined;
    streamAITextMock.mockImplementation((_messages, chunkCallback, doneCallback) => {
      onChunk = chunkCallback;
      onDone = doneCallback;
      return new AbortController();
    });

    showPromptOrchestration(createView('Build a launch plan'));

    expect((document.getElementById('prompt-workflow-export-md') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('prompt-workflow-export-json') as HTMLButtonElement).disabled).toBe(true);

    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();
    onChunk?.('{"title":"Launch workflow","stages":[{"prompts":[{"title":"Research","content":"Research the market."}]}]}');

    expect((document.getElementById('prompt-workflow-export-md') as HTMLButtonElement).disabled).toBe(true);

    onDone?.();

    expect((document.getElementById('prompt-workflow-export-md') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('prompt-workflow-export-json') as HTMLButtonElement).disabled).toBe(false);
  });

  it('exports the generated workflow as Markdown and JSON', async () => {
    streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
      onChunk(JSON.stringify({
        title: 'Launch workflow',
        stages: [{ prompts: [{ title: 'Research', content: 'Research the market.' }] }],
      }));
      onDone();
      return new AbortController();
    });

    showPromptOrchestration(createView('Build a launch plan'));
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();
    (document.getElementById('prompt-workflow-export-md') as HTMLButtonElement).click();

    expect(exportTextFileMock).toHaveBeenCalledWith(
      'launch-workflow.md',
      expect.stringContaining('# Launch workflow'),
      'text/markdown',
    );

    (document.getElementById('prompt-workflow-export-json') as HTMLButtonElement).click();

    expect(exportTextFileMock).toHaveBeenLastCalledWith(
      'launch-workflow.json',
      expect.stringContaining('"title": "Launch workflow"'),
      'application/json',
    );
    await vi.waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toBe('Workflow exported.');
    });
  });

  it('aborts generation when the modal is cancelled', () => {
    const abort = vi.fn();
    streamAITextMock.mockReturnValue({ abort });

    showPromptOrchestration(createView('Build a launch plan'));
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();
    (document.getElementById('prompt-workflow-cancel') as HTMLButtonElement).click();

    expect(abort).toHaveBeenCalled();
    expect(document.querySelector('.prompt-workflow-overlay')).toBeNull();
  });

  it('aborts active generation when another workflow modal opens', () => {
    const abort = vi.fn();
    streamAITextMock.mockReturnValue({ abort });

    const view = createView('Build a launch plan');
    showPromptOrchestration(view);
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();
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
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();

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
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();
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
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();

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
    (document.getElementById('prompt-workflow-regenerate') as HTMLButtonElement).click();

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
