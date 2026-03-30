import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTemplateFormDialog } from '../template/template-form-dialog';
import type { PromptTemplate } from '../template/template-types';

describe('Template Form Dialog', () => {
  beforeEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create a form dialog with text input', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Hello {{name}}!',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit });
    
    dialog.open();
    
    // Check if dialog is created
    const dialogElement = document.querySelector('.template-form-dialog');
    expect(dialogElement).not.toBeNull();
    expect(dialogElement?.classList.contains('show')).toBe(true);
    
    // Check if form field is created (variable is parsed from content)
    const input = document.querySelector('input[name="name"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('type')).toBe('text');
    
    dialog.destroy();
  });

  it('should create a form dialog with select input', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Select: {{option:select=A,B,C}}',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit });
    
    dialog.open();
    
    // Check if select is created (variable is parsed from content)
    const select = document.querySelector('select[name="option"]');
    expect(select).not.toBeNull();
    
    // Check if options are created
    const options = select?.querySelectorAll('option');
    expect(options?.length).toBe(3);
    
    dialog.destroy();
  });

  it('should create a form dialog with checkbox', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Enabled: {{enabled:checkbox=true}}',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit });
    
    dialog.open();
    
    // Check if checkbox is created (variable is parsed from content)
    const checkbox = document.querySelector('input[type="checkbox"][name="enabled"]');
    expect(checkbox).not.toBeNull();
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    
    dialog.destroy();
  });

  it('should create a form dialog with radio buttons', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Mode: {{mode:radio=Simple,Advanced}}',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit });
    
    dialog.open();
    
    // Check if radio buttons are created (variable is parsed from content)
    // Radio buttons are in a container with class form-radio-group
    const radioContainer = document.querySelector('.form-radio-group');
    expect(radioContainer).not.toBeNull();
    
    const radios = radioContainer?.querySelectorAll('input[type="radio"]');
    expect(radios?.length).toBe(2);
    
    dialog.destroy();
  });

  it('should create a form dialog with textarea', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Description: {{desc:textarea}}',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit });
    
    dialog.open();
    
    // Check if textarea is created
    const textarea = document.querySelector('textarea[name="desc"]');
    expect(textarea).not.toBeNull();
    
    dialog.destroy();
  });

  it('should create a form dialog with number input', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Count: {{count:number=5}}',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit });
    
    dialog.open();
    
    // Check if number input is created
    const input = document.querySelector('input[name="count"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('type')).toBe('number');
    
    dialog.destroy();
  });

  it('should close dialog when close is called', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Hello {{name}}!',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit, onCancel });
    
    dialog.open();
    expect(document.querySelector('.template-form-dialog')).not.toBeNull();
    
    dialog.close();
    expect(onCancel).toHaveBeenCalled();
  });

  it('should render preview correctly', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      content: 'Hello {{name}}!',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const onSubmit = vi.fn();
    const dialog = createTemplateFormDialog({ template, onSubmit });
    
    dialog.open();
    
    // Check if preview section is rendered
    const preview = document.querySelector('.template-form-preview-content');
    expect(preview).not.toBeNull();
    expect(preview?.textContent).toContain('Hello');
    
    dialog.destroy();
  });
});
