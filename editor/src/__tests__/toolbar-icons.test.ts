import { describe, expect, it } from 'vitest';
import editorHTML from '../../index.html?raw';

const toolbarIcons = {
  'btn-workspace': ['folder-open', 'Set Workspace'],
  'btn-history': ['history', 'History'],
  'btn-prompt-memory': ['scan-search', 'Scan Prompt Memory'],
  'btn-snippets': ['blocks', 'Prompt Snippets'],
  'btn-templates': ['layout-template', 'Templates'],
  'btn-template-mode': ['file-pen-line', 'Template Edit Mode'],
  'btn-files': ['file-symlink', 'File References'],
  'btn-ai-enhance': ['wand-sparkles', 'AI Enhance Prompt'],
  'btn-ai-settings': ['sliders-horizontal', 'AI Settings'],
  'btn-save': ['archive', 'Save to History'],
  'btn-copy': ['copy', 'Copy to Clipboard'],
  'btn-clear': ['eraser', 'Clear Editor'],
  'btn-paste-previous': ['send', 'Paste to Last Position'],
} as const;

describe('top toolbar icons', () => {
  const page = new DOMParser().parseFromString(editorHTML, 'text/html');

  it.each(Object.entries(toolbarIcons))('maps %s to a semantic icon', (buttonId, [icon, label]) => {
    const button = page.querySelector<HTMLButtonElement>(`#${buttonId}`);
    const svg = button?.querySelector('svg');

    expect(button?.dataset.icon).toBe(icon);
    expect(button?.getAttribute('aria-label')).toBe(label);
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });

  it('uses one outline presentation contract for every toolbar icon', () => {
    const svgs = page.querySelectorAll('#toolbar .actions > button.icon-btn-toolbar > svg');

    expect(svgs).toHaveLength(Object.keys(toolbarIcons).length);
    for (const svg of svgs) {
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('stroke-width')).toBe('2');
      expect(svg.getAttribute('stroke-linecap')).toBe('round');
      expect(svg.getAttribute('stroke-linejoin')).toBe('round');
    }
  });
});
