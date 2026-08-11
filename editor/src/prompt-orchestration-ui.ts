import type { EditorView } from '@codemirror/view';
import { isAIConfigured } from './ai-config';
import { streamAIText } from './ai-service';
import {
  createWorkflowId,
  parseWorkflowResponse,
  workflowToMarkdown,
  type PromptWorkflow,
  type WorkflowPrompt,
} from './prompt-orchestration';
import { promptWorkflowStore } from './prompt-workflow-store';
import { showSettings } from './settings-ui';

const ORCHESTRATION_SYSTEM_PROMPT = `You are an expert prompt workflow architect. Expand and split the user's prompt into an actionable workflow.

Return ONLY valid JSON with this shape:
{"title":"Workflow title","stages":[{"prompts":[{"title":"Step title","content":"Complete standalone prompt"}]}]}

Rules:
- Stages execute sequentially in array order.
- Prompts within the same stage must be independent and safe to run in parallel.
- Put dependent prompts in later stages.
- Each prompt must be complete, specific, and executable on its own.
- Preserve the user's intent and add useful detail without inventing requirements.
- Use no more than 24 prompts.
- Do not include markdown fences, explanations, or extra keys.`;

let activeOverlay: HTMLElement | null = null;
let activeOverlayCleanup: (() => void) | null = null;

export function showPromptOrchestration(view: EditorView): void {
  const selection = view.state.selection.main;
  const sourcePrompt = (selection.empty
    ? view.state.doc.toString()
    : view.state.doc.sliceString(selection.from, selection.to)).trim();

  if (!sourcePrompt) {
    showToast('Write something first before orchestrating.');
    return;
  }
  if (!isAIConfigured()) {
    showSettings('ai');
    return;
  }

  openWorkflowEditor(view, sourcePrompt);
}

export function showWorkflowManager(view: EditorView): void {
  closeActiveOverlay();
  const overlay = createOverlay('prompt-workflow-manager-overlay');
  overlay.innerHTML = `
    <section class="prompt-workflow-modal prompt-workflow-manager" role="dialog" aria-modal="true" aria-labelledby="prompt-workflow-manager-title">
      <header class="prompt-workflow-header">
        <div>
          <h2 id="prompt-workflow-manager-title">Prompt workflows</h2>
          <p>Saved orchestration plans</p>
        </div>
        <button class="prompt-workflow-icon-button" data-action="close" title="Close" aria-label="Close">×</button>
      </header>
      <div class="prompt-workflow-manager-list"></div>
    </section>`;
  document.body.appendChild(overlay);
  activeOverlay = overlay;
  activeOverlayCleanup = null;

  const list = overlay.querySelector('.prompt-workflow-manager-list') as HTMLElement;
  const render = () => {
    const workflows = promptWorkflowStore.list();
    list.innerHTML = workflows.length === 0
      ? '<div class="prompt-workflow-empty">No saved workflows yet.</div>'
      : workflows.map(workflow => `
        <article class="prompt-workflow-manager-item" data-workflow-id="${escapeHtml(workflow.id)}">
          <div class="prompt-workflow-manager-summary">
            <strong>${escapeHtml(workflow.title)}</strong>
            <span>${workflow.stages.length} stages · ${countPrompts(workflow)} prompts</span>
          </div>
          <div class="prompt-workflow-manager-actions">
            <button class="ai-btn-secondary" data-action="open">Open</button>
            <button class="prompt-workflow-icon-button" data-action="rename" title="Rename" aria-label="Rename">✎</button>
            <button class="prompt-workflow-icon-button" data-action="duplicate" title="Duplicate" aria-label="Duplicate">⧉</button>
            <button class="prompt-workflow-icon-button" data-action="copy" title="Copy as Markdown" aria-label="Copy as Markdown">⎘</button>
            <button class="prompt-workflow-icon-button danger" data-action="delete" title="Delete" aria-label="Delete">×</button>
          </div>
        </article>`).join('');
  };
  render();

  overlay.addEventListener('click', event => {
    if (event.target === overlay) return closeOverlay(overlay, view);
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'close') return closeOverlay(overlay, view);
    const item = button.closest<HTMLElement>('[data-workflow-id]');
    const id = item?.dataset.workflowId;
    if (!id) return;

    if (action === 'open') {
      const workflow = promptWorkflowStore.get(id);
      if (workflow) openWorkflowEditor(view, workflow.sourcePrompt, workflow);
    } else if (action === 'rename') {
      const workflow = promptWorkflowStore.get(id);
      const title = workflow ? window.prompt('Workflow title', workflow.title) : null;
      if (title?.trim()) {
        promptWorkflowStore.rename(id, title);
        render();
      }
    } else if (action === 'duplicate') {
      promptWorkflowStore.duplicate(id);
      render();
    } else if (action === 'copy') {
      const workflow = promptWorkflowStore.get(id);
      if (workflow) void copyText(workflowToMarkdown(workflow));
    } else if (action === 'delete' && window.confirm('Delete this workflow?')) {
      promptWorkflowStore.delete(id);
      render();
    }
  });
  bindOverlayKeyboard(overlay, () => closeOverlay(overlay, view));
}

function openWorkflowEditor(view: EditorView, sourcePrompt: string, initial?: PromptWorkflow): void {
  closeActiveOverlay();
  const overlay = createOverlay('prompt-workflow-editor-overlay');
  overlay.innerHTML = `
    <section class="prompt-workflow-modal" role="dialog" aria-modal="true" aria-labelledby="prompt-workflow-title-label">
      <header class="prompt-workflow-header">
        <div>
          <h2 id="prompt-workflow-title-label">Prompt orchestration</h2>
          <p>Sequential stages with parallel prompts</p>
        </div>
        <button class="prompt-workflow-icon-button" data-action="close" title="Close" aria-label="Close">×</button>
      </header>
      <div class="prompt-workflow-source"><span>Source prompt</span><p>${escapeHtml(sourcePrompt)}</p></div>
      <div class="prompt-workflow-status" aria-live="polite"></div>
      <div class="prompt-workflow-editor-body" hidden>
        <label class="prompt-workflow-title-field">Workflow title
          <input id="prompt-workflow-title" type="text" autocomplete="off">
        </label>
        <div class="prompt-workflow-stages"></div>
        <button class="ai-btn-secondary prompt-workflow-add-stage" data-action="add-stage">+ Add stage</button>
      </div>
      <footer class="prompt-workflow-footer">
        <button id="prompt-workflow-regenerate" class="ai-btn-secondary" data-action="regenerate">Regenerate</button>
        <span class="prompt-workflow-footer-spacer"></span>
        <button id="prompt-workflow-cancel" class="ai-btn-secondary" data-action="close">Cancel</button>
        <button id="prompt-workflow-save" class="ai-btn-primary" data-action="save" disabled>Save workflow</button>
      </footer>
    </section>`;
  document.body.appendChild(overlay);
  activeOverlay = overlay;

  let workflow: PromptWorkflow | null = initial ? clone(initial) : null;
  let abortController: AbortController | null = null;
  activeOverlayCleanup = () => abortController?.abort();
  let accumulated = '';
  const status = overlay.querySelector('.prompt-workflow-status') as HTMLElement;
  const editorBody = overlay.querySelector('.prompt-workflow-editor-body') as HTMLElement;
  const stagesEl = overlay.querySelector('.prompt-workflow-stages') as HTMLElement;
  const titleInput = overlay.querySelector('#prompt-workflow-title') as HTMLInputElement;
  const saveButton = overlay.querySelector('#prompt-workflow-save') as HTMLButtonElement;
  const regenerateButton = overlay.querySelector('#prompt-workflow-regenerate') as HTMLButtonElement;

  const render = () => {
    if (!workflow) return;
    editorBody.hidden = false;
    status.hidden = true;
    titleInput.value = workflow.title;
    stagesEl.innerHTML = workflow.stages.map((stage, stageIndex) => `
      <section class="prompt-workflow-stage" data-stage-id="${escapeHtml(stage.id)}" data-parallel="${stage.prompts.length > 1}" draggable="true">
        <header class="prompt-workflow-stage-header">
          <div><span class="prompt-workflow-stage-number">Stage ${stageIndex + 1}</span>${stage.prompts.length > 1 ? '<span class="prompt-workflow-parallel-badge">Parallel</span>' : ''}</div>
          <div class="prompt-workflow-stage-actions">
            <button class="prompt-workflow-icon-button" data-action="move-stage-up" title="Move stage up" aria-label="Move stage up" ${stageIndex === 0 ? 'disabled' : ''}>↑</button>
            <button class="prompt-workflow-icon-button" data-action="move-stage-down" title="Move stage down" aria-label="Move stage down" ${stageIndex === workflow!.stages.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="prompt-workflow-icon-button danger" data-action="delete-stage" title="Delete stage" aria-label="Delete stage">×</button>
          </div>
        </header>
        <div class="prompt-workflow-prompt-grid">
          ${stage.prompts.map((prompt, promptIndex) => renderPromptCard(prompt, stageIndex, promptIndex, workflow!.stages.length)).join('')}
        </div>
        <button class="prompt-workflow-add-prompt" data-action="add-prompt">+ Add parallel prompt</button>
      </section>`).join('<div class="prompt-workflow-sequence-arrow" aria-hidden="true">↓</div>');
    saveButton.disabled = countPrompts(workflow) === 0;
  };

  const startGeneration = () => {
    abortController?.abort();
    accumulated = '';
    workflow = null;
    editorBody.hidden = true;
    status.hidden = false;
    status.className = 'prompt-workflow-status is-loading';
    status.textContent = 'Generating workflow...';
    saveButton.disabled = true;
    regenerateButton.disabled = true;

    const controller = streamAIText(
      [
        { role: 'system', content: ORCHESTRATION_SYSTEM_PROMPT },
        { role: 'user', content: sourcePrompt },
      ],
      chunk => { accumulated += chunk; },
      () => {
        try {
          workflow = parseWorkflowResponse(accumulated, sourcePrompt);
          render();
        } catch (error) {
          status.hidden = false;
          status.className = 'prompt-workflow-status is-error';
          status.textContent = error instanceof Error ? error.message : String(error);
        }
        regenerateButton.disabled = false;
        abortController = null;
      },
      error => {
        status.hidden = false;
        status.className = 'prompt-workflow-status is-error';
        status.textContent = error.message;
        regenerateButton.disabled = false;
        abortController = null;
      },
    );
    abortController = controller;
  };

  if (initial) render();
  else startGeneration();

  titleInput.addEventListener('input', () => {
    if (workflow) workflow.title = titleInput.value;
  });
  stagesEl.addEventListener('input', event => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const card = target.closest<HTMLElement>('[data-prompt-id]');
    const prompt = card && workflow ? findPrompt(workflow, card.dataset.promptId || '') : undefined;
    if (!prompt) return;
    if (target.matches('[data-field="title"]')) prompt.title = target.value;
    if (target.matches('[data-field="content"]')) prompt.content = target.value;
    saveButton.disabled = !hasValidPrompts(workflow!);
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) return closeOverlay(overlay, view, abortController);
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'close') return closeOverlay(overlay, view, abortController);
    if (action === 'regenerate') return startGeneration();
    if (action === 'save' && workflow && hasValidPrompts(workflow)) {
      workflow.title = titleInput.value.trim() || 'Untitled workflow';
      trimWorkflow(workflow);
      promptWorkflowStore.save(workflow);
      showToast('Workflow saved.');
      return closeOverlay(overlay, view, abortController);
    }
    if (!workflow) return;
    mutateWorkflow(workflow, button, action || '');
    render();
  });
  bindDragAndDrop(stagesEl, () => workflow, render);
  bindOverlayKeyboard(overlay, () => closeOverlay(overlay, view, abortController));
}

function mutateWorkflow(workflow: PromptWorkflow, button: HTMLButtonElement, action: string): void {
  const stageElement = button.closest<HTMLElement>('[data-stage-id]');
  const promptElement = button.closest<HTMLElement>('[data-prompt-id]');
  const stageIndex = workflow.stages.findIndex(stage => stage.id === stageElement?.dataset.stageId);
  const promptIndex = stageIndex >= 0
    ? workflow.stages[stageIndex].prompts.findIndex(prompt => prompt.id === promptElement?.dataset.promptId)
    : -1;

  if (action === 'add-stage') {
    workflow.stages.push({ id: createWorkflowId('stage'), prompts: [newPrompt()] });
  } else if (action === 'add-prompt' && stageIndex >= 0) {
    workflow.stages[stageIndex].prompts.push(newPrompt());
  } else if (action === 'delete-stage' && stageIndex >= 0) {
    workflow.stages.splice(stageIndex, 1);
  } else if (action === 'move-stage-up' && stageIndex > 0) {
    moveItem(workflow.stages, stageIndex, stageIndex - 1);
  } else if (action === 'move-stage-down' && stageIndex >= 0 && stageIndex < workflow.stages.length - 1) {
    moveItem(workflow.stages, stageIndex, stageIndex + 1);
  } else if (action === 'duplicate-prompt' && promptIndex >= 0) {
    const prompt = workflow.stages[stageIndex].prompts[promptIndex];
    workflow.stages[stageIndex].prompts.splice(promptIndex + 1, 0, { ...prompt, id: createWorkflowId('prompt'), title: `${prompt.title} copy` });
  } else if (action === 'delete-prompt' && promptIndex >= 0) {
    workflow.stages[stageIndex].prompts.splice(promptIndex, 1);
    if (workflow.stages[stageIndex].prompts.length === 0) workflow.stages.splice(stageIndex, 1);
  } else if (action === 'move-prompt-previous' && promptIndex >= 0 && stageIndex > 0) {
    movePrompt(workflow, stageIndex, promptIndex, stageIndex - 1);
  } else if (action === 'move-prompt-next' && promptIndex >= 0 && stageIndex < workflow.stages.length - 1) {
    movePrompt(workflow, stageIndex, promptIndex, stageIndex + 1);
  }
}

function renderPromptCard(prompt: WorkflowPrompt, stageIndex: number, promptIndex: number, stageCount: number): string {
  return `<article class="prompt-workflow-card" data-prompt-id="${escapeHtml(prompt.id)}" draggable="true">
    <div class="prompt-workflow-card-toolbar">
      <span>Prompt ${promptIndex + 1}</span>
      <div>
        <button class="prompt-workflow-icon-button" data-action="move-prompt-previous" title="Move to previous stage" aria-label="Move to previous stage" ${stageIndex === 0 ? 'disabled' : ''}>←</button>
        <button class="prompt-workflow-icon-button" data-action="move-prompt-next" title="Move to next stage" aria-label="Move to next stage" ${stageIndex === stageCount - 1 ? 'disabled' : ''}>→</button>
        <button class="prompt-workflow-icon-button" data-action="duplicate-prompt" title="Duplicate prompt" aria-label="Duplicate prompt">⧉</button>
        <button class="prompt-workflow-icon-button danger" data-action="delete-prompt" title="Delete prompt" aria-label="Delete prompt">×</button>
      </div>
    </div>
    <input data-field="title" value="${escapeHtml(prompt.title)}" aria-label="Prompt title">
    <textarea data-field="content" aria-label="Prompt content">${escapeHtml(prompt.content)}</textarea>
  </article>`;
}

function bindDragAndDrop(
  container: HTMLElement,
  getWorkflow: () => PromptWorkflow | null,
  render: () => void,
): void {
  let draggedStageId = '';
  let draggedPromptId = '';
  container.addEventListener('dragstart', event => {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('[data-prompt-id]');
    if (card) draggedPromptId = card.dataset.promptId || '';
    else draggedStageId = target.closest<HTMLElement>('[data-stage-id]')?.dataset.stageId || '';
  });
  container.addEventListener('dragover', event => event.preventDefault());
  container.addEventListener('drop', event => {
    event.preventDefault();
    const workflow = getWorkflow();
    const target = event.target as HTMLElement;
    if (!workflow) return;
    const targetStageId = target.closest<HTMLElement>('[data-stage-id]')?.dataset.stageId;
    if (draggedPromptId && targetStageId) {
      const source = locatePrompt(workflow, draggedPromptId);
      const targetStage = workflow.stages.findIndex(stage => stage.id === targetStageId);
      if (source && targetStage >= 0 && source.stageIndex !== targetStage) {
        movePrompt(workflow, source.stageIndex, source.promptIndex, targetStage);
      }
    } else if (draggedStageId && targetStageId && draggedStageId !== targetStageId) {
      const from = workflow.stages.findIndex(stage => stage.id === draggedStageId);
      const to = workflow.stages.findIndex(stage => stage.id === targetStageId);
      if (from >= 0 && to >= 0) moveItem(workflow.stages, from, to);
    }
    draggedPromptId = '';
    draggedStageId = '';
    render();
  });
}

function movePrompt(workflow: PromptWorkflow, fromStage: number, promptIndex: number, toStage: number): void {
  const [prompt] = workflow.stages[fromStage].prompts.splice(promptIndex, 1);
  workflow.stages[toStage].prompts.push(prompt);
  if (workflow.stages[fromStage].prompts.length === 0) workflow.stages.splice(fromStage, 1);
}

function locatePrompt(workflow: PromptWorkflow, id: string): { stageIndex: number; promptIndex: number } | undefined {
  for (let stageIndex = 0; stageIndex < workflow.stages.length; stageIndex += 1) {
    const promptIndex = workflow.stages[stageIndex].prompts.findIndex(prompt => prompt.id === id);
    if (promptIndex >= 0) return { stageIndex, promptIndex };
  }
  return undefined;
}

function findPrompt(workflow: PromptWorkflow, id: string): WorkflowPrompt | undefined {
  const location = locatePrompt(workflow, id);
  return location ? workflow.stages[location.stageIndex].prompts[location.promptIndex] : undefined;
}

function newPrompt(): WorkflowPrompt {
  return { id: createWorkflowId('prompt'), title: 'New prompt', content: '' };
}

function moveItem<T>(items: T[], from: number, to: number): void {
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
}

function trimWorkflow(workflow: PromptWorkflow): void {
  workflow.stages = workflow.stages.map(stage => ({
    ...stage,
    prompts: stage.prompts
      .map(prompt => ({ ...prompt, title: prompt.title.trim() || 'Untitled step', content: prompt.content.trim() }))
      .filter(prompt => prompt.content),
  })).filter(stage => stage.prompts.length > 0);
}

function hasValidPrompts(workflow: PromptWorkflow): boolean {
  return workflow.stages.some(stage => stage.prompts.some(prompt => prompt.content.trim()));
}

function countPrompts(workflow: PromptWorkflow): number {
  return workflow.stages.reduce((total, stage) => total + stage.prompts.length, 0);
}

function createOverlay(extraClass: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = `prompt-workflow-overlay ${extraClass}`;
  return overlay;
}

function closeActiveOverlay(): void {
  activeOverlayCleanup?.();
  activeOverlay?.remove();
  activeOverlay = null;
  activeOverlayCleanup = null;
}

function closeOverlay(overlay: HTMLElement, view: EditorView, abortController?: AbortController | null): void {
  abortController?.abort();
  overlay.remove();
  if (activeOverlay === overlay) {
    activeOverlay = null;
    activeOverlayCleanup = null;
  }
  view.focus();
}

function bindOverlayKeyboard(overlay: HTMLElement, close: () => void): void {
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}

function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2000);
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Workflow copied as Markdown.');
  } catch {
    showToast('Failed to copy workflow.');
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
