import {
  createWorkflowId,
  type PromptStage,
  type PromptWorkflow,
  type WorkflowPrompt,
} from './prompt-orchestration';

export const WORKFLOW_STORAGE_KEY = 'promptEditor:workflows:v1';

export class PromptWorkflowStore {
  list(): PromptWorkflow[] {
    return clone(this.read()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): PromptWorkflow | undefined {
    const workflow = this.read().find(item => item.id === id);
    return workflow ? clone(workflow) : undefined;
  }

  save(workflow: PromptWorkflow): PromptWorkflow {
    const items = this.read();
    const existing = items.find(item => item.id === workflow.id);
    const now = Date.now();
    const saved: PromptWorkflow = clone({
      ...workflow,
      title: workflow.title.trim() || 'Untitled workflow',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.write([saved, ...items.filter(item => item.id !== saved.id)]);
    return clone(saved);
  }

  rename(id: string, title: string): PromptWorkflow | undefined {
    const workflow = this.get(id);
    const trimmed = title.trim();
    if (!workflow || !trimmed) return undefined;
    return this.save({ ...workflow, title: trimmed });
  }

  duplicate(id: string): PromptWorkflow | undefined {
    const workflow = this.get(id);
    if (!workflow) return undefined;
    const copy: PromptWorkflow = {
      ...workflow,
      id: createWorkflowId(),
      title: `${workflow.title} copy`,
      stages: workflow.stages.map(cloneStageWithNewIds),
      createdAt: 0,
      updatedAt: 0,
    };
    return this.save(copy);
  }

  delete(id: string): boolean {
    const items = this.read();
    if (!items.some(item => item.id === id)) return false;
    this.write(items.filter(item => item.id !== id));
    return true;
  }

  private read(): PromptWorkflow[] {
    try {
      const raw = localStorage.getItem(WORKFLOW_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isPromptWorkflow) : [];
    } catch {
      return [];
    }
  }

  private write(items: PromptWorkflow[]): void {
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(items));
  }
}

export const promptWorkflowStore = new PromptWorkflowStore();

function cloneStageWithNewIds(stage: PromptStage): PromptStage {
  return {
    id: createWorkflowId('stage'),
    prompts: stage.prompts.map((prompt): WorkflowPrompt => ({
      ...prompt,
      id: createWorkflowId('prompt'),
    })),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPromptWorkflow(value: unknown): value is PromptWorkflow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const workflow = value as Partial<PromptWorkflow>;
  return Boolean(
    typeof workflow.id === 'string' &&
    typeof workflow.title === 'string' &&
    typeof workflow.sourcePrompt === 'string' &&
    typeof workflow.createdAt === 'number' &&
    typeof workflow.updatedAt === 'number' &&
    Array.isArray(workflow.stages) &&
    workflow.stages.length > 0 &&
    workflow.stages.every(isPromptStage)
  );
}

function isPromptStage(value: unknown): value is PromptStage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const stage = value as Partial<PromptStage>;
  return Boolean(
    typeof stage.id === 'string' &&
    Array.isArray(stage.prompts) &&
    stage.prompts.length > 0 &&
    stage.prompts.every(isWorkflowPrompt)
  );
}

function isWorkflowPrompt(value: unknown): value is WorkflowPrompt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prompt = value as Partial<WorkflowPrompt>;
  return Boolean(
    typeof prompt.id === 'string' &&
    typeof prompt.title === 'string' &&
    typeof prompt.content === 'string' &&
    prompt.content.trim()
  );
}
