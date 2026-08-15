import { describe, expect, it } from 'vitest';
import {
  extractCompleteWorkflowStages,
  MAX_WORKFLOW_PROMPTS,
  parseWorkflowResponse,
  stripJsonFence,
  workflowToJSON,
  workflowToMarkdown,
} from '../prompt-orchestration';

describe('prompt orchestration', () => {
  it('extracts only complete stages from a streaming response', () => {
    const response = '{"stages":[{"prompts":[{"title":"Research","content":"Find sources"}]},{"prompts":[{"title":"Write","content":"Draft copy"}]}]}';
    const firstChunk = response.slice(0, response.indexOf('},{"prompts"') + 1);

    expect(extractCompleteWorkflowStages(firstChunk)).toEqual([
      { prompts: [{ title: 'Research', content: 'Find sources' }] },
    ]);
    expect(extractCompleteWorkflowStages(response)).toEqual([
      { prompts: [{ title: 'Research', content: 'Find sources' }] },
      { prompts: [{ title: 'Write', content: 'Draft copy' }] },
    ]);
  });

  it('does not extract a stage that ends inside an escaped string', () => {
    const response = '{"stages":[{"prompts":[{"title":"Quote","content":"Use \\"quoted\\" text"}]}]}';
    const partialChunk = response.slice(0, response.indexOf(' text"') + 6);

    expect(extractCompleteWorkflowStages(partialChunk)).toEqual([]);
    expect(extractCompleteWorkflowStages(response)).toEqual([
      { prompts: [{ title: 'Quote', content: 'Use "quoted" text' }] },
    ]);
  });

  it('strips a markdown JSON fence', () => {
    expect(stripJsonFence('```json\n{"title":"Research"}\n```')).toBe('{"title":"Research"}');
  });

  it('normalizes a generated workflow and fills missing step titles', () => {
    const workflow = parseWorkflowResponse(
      '```json\n{"title":"Research","stages":[{"prompts":[{"content":"Find sources"}]}]}\n```',
      'original prompt',
    );

    expect(workflow.title).toBe('Research');
    expect(workflow.sourcePrompt).toBe('original prompt');
    expect(workflow.stages).toHaveLength(1);
    expect(workflow.stages[0].id).toEqual(expect.any(String));
    expect(workflow.stages[0].prompts[0]).toMatchObject({
      title: 'Step 1',
      content: 'Find sources',
    });
    expect(workflow.stages[0].prompts[0].id).toEqual(expect.any(String));
  });

  it('removes empty prompts and stages', () => {
    const workflow = parseWorkflowResponse(JSON.stringify({
      stages: [
        { prompts: [{ title: 'Empty', content: '   ' }] },
        { prompts: [{ title: 'Useful', content: 'Do useful work' }] },
      ],
    }), 'source');

    expect(workflow.title).toBe('Untitled workflow');
    expect(workflow.stages).toHaveLength(1);
    expect(workflow.stages[0].prompts).toHaveLength(1);
    expect(workflow.stages[0].prompts[0].title).toBe('Useful');
  });

  it('rejects a response without any usable prompts', () => {
    expect(() => parseWorkflowResponse('{"stages":[]}', 'source'))
      .toThrow('Workflow must contain at least one prompt.');
    expect(() => parseWorkflowResponse('[]', 'source'))
      .toThrow('Workflow response must be a JSON object.');
  });

  it('caps the total number of generated prompts', () => {
    const prompts = Array.from({ length: MAX_WORKFLOW_PROMPTS + 5 }, (_, index) => ({
      title: `Prompt ${index + 1}`,
      content: `Content ${index + 1}`,
    }));
    const workflow = parseWorkflowResponse(JSON.stringify({
      title: 'Large workflow',
      stages: [{ prompts }],
    }), 'source');

    expect(workflow.stages[0].prompts).toHaveLength(MAX_WORKFLOW_PROMPTS);
  });

  it('exports sequential stages and parallel prompts as Markdown', () => {
    const workflow = parseWorkflowResponse(JSON.stringify({
      title: 'Launch plan',
      stages: [
        { prompts: [{ title: 'Research', content: 'Research the market.' }] },
        { prompts: [
          { title: 'Copy', content: 'Write launch copy.' },
          { title: 'Visuals', content: 'Define launch visuals.' },
        ] },
      ],
    }), 'Plan a launch');

    expect(workflowToMarkdown(workflow)).toContain('# Launch plan');
    expect(workflowToMarkdown(workflow)).toContain('## Stage 2 (parallel)');
    expect(workflowToMarkdown(workflow)).toContain('### Copy');
    expect(workflowToMarkdown(workflow)).toContain('Write launch copy.');
  });

  it('exports a clean JSON structure without internal ids', () => {
    const workflow = parseWorkflowResponse(JSON.stringify({
      title: 'Launch plan',
      stages: [
        { prompts: [{ title: 'Research', content: 'Research the market.' }] },
        { prompts: [
          { title: 'Copy', content: 'Write launch copy.' },
          { title: 'Visuals', content: 'Define launch visuals.' },
        ] },
      ],
    }), 'Plan a launch');

    const exported = JSON.parse(workflowToJSON(workflow));

    expect(exported.title).toBe('Launch plan');
    expect(exported.sourcePrompt).toBe('Plan a launch');
    expect(Number.isNaN(Date.parse(exported.createdAt))).toBe(false);
    expect(exported.stages).toEqual([
      {
        stage: 1,
        parallel: false,
        prompts: [{ title: 'Research', content: 'Research the market.' }],
      },
      {
        stage: 2,
        parallel: true,
        prompts: [
          { title: 'Copy', content: 'Write launch copy.' },
          { title: 'Visuals', content: 'Define launch visuals.' },
        ],
      },
    ]);
  });
});
