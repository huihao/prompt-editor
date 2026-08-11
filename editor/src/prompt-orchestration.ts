export interface WorkflowPrompt {
  id: string;
  title: string;
  content: string;
}

export interface PromptStage {
  id: string;
  prompts: WorkflowPrompt[];
}

export interface PromptWorkflow {
  id: string;
  title: string;
  sourcePrompt: string;
  stages: PromptStage[];
  createdAt: number;
  updatedAt: number;
}

export const MAX_WORKFLOW_PROMPTS = 24;

let idSequence = 0;

export function createWorkflowId(prefix = 'workflow'): string {
  idSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseWorkflowResponse(raw: string, sourcePrompt: string): PromptWorkflow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    throw new Error('Workflow response is not valid JSON.');
  }
  return normalizeWorkflow(parsed, sourcePrompt);
}

export function normalizeWorkflow(input: unknown, sourcePrompt: string): PromptWorkflow {
  if (!isRecord(input)) {
    throw new Error('Workflow response must be a JSON object.');
  }

  let promptNumber = 0;
  const stages: PromptStage[] = [];
  const rawStages = Array.isArray(input.stages) ? input.stages : [];

  for (const rawStage of rawStages) {
    if (!isRecord(rawStage) || !Array.isArray(rawStage.prompts)) continue;
    const prompts: WorkflowPrompt[] = [];

    for (const rawPrompt of rawStage.prompts) {
      if (promptNumber >= MAX_WORKFLOW_PROMPTS) break;
      if (!isRecord(rawPrompt) || typeof rawPrompt.content !== 'string') continue;
      const content = rawPrompt.content.trim();
      if (!content) continue;

      promptNumber += 1;
      const suppliedTitle = typeof rawPrompt.title === 'string' ? rawPrompt.title.trim() : '';
      prompts.push({
        id: createWorkflowId('prompt'),
        title: suppliedTitle || `Step ${promptNumber}`,
        content,
      });
    }

    if (prompts.length > 0) {
      stages.push({ id: createWorkflowId('stage'), prompts });
    }
    if (promptNumber >= MAX_WORKFLOW_PROMPTS) break;
  }

  if (stages.length === 0) {
    throw new Error('Workflow must contain at least one prompt.');
  }

  const now = Date.now();
  const suppliedTitle = typeof input.title === 'string' ? input.title.trim() : '';
  return {
    id: createWorkflowId(),
    title: suppliedTitle || 'Untitled workflow',
    sourcePrompt,
    stages,
    createdAt: now,
    updatedAt: now,
  };
}

export function workflowToMarkdown(workflow: PromptWorkflow): string {
  const sections = workflow.stages.map((stage, stageIndex) => {
    const parallelLabel = stage.prompts.length > 1 ? ' (parallel)' : '';
    const prompts = stage.prompts.map(prompt => (
      `### ${prompt.title}\n\n${prompt.content}`
    )).join('\n\n');
    return `## Stage ${stageIndex + 1}${parallelLabel}\n\n${prompts}`;
  });
  return `# ${workflow.title}\n\n${sections.join('\n\n')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
