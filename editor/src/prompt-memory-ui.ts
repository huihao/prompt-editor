import { bridge } from './bridge';
import {
  PromptMemoryAgent,
  PromptMemoryController,
  PromptMemoryDirectory,
  PromptMemoryItem,
} from './prompt-memory';

const AGENT_LABELS: Record<PromptMemoryAgent, string> = {
  claudeCode: 'Claude Code',
  codex: 'Codex',
  openCode: 'OpenCode',
  pi: 'Pi',
  kimi: 'Kimi',
};

export function initPromptMemoryUI(controller = new PromptMemoryController()): void {
  const button = document.getElementById('btn-prompt-memory');
  const open = () => void openModal(controller);

  button?.addEventListener('click', open);
  window.addEventListener('prompt-memory:open', open);
  window.addEventListener('prompt-memory:update', () => renderResults(controller));

  (window as any).__promptMemoryRenderResults = () => renderResults(controller);
}

async function openModal(controller: PromptMemoryController): Promise<void> {
  const root = getRoot();
  root.innerHTML = `
    <div class="prompt-memory-backdrop"></div>
    <section class="prompt-memory-modal" role="dialog" aria-modal="true">
      <div class="prompt-memory-header">
        <h3>Prompt Memory</h3>
        <button class="prompt-memory-close" data-action="close" title="Close">×</button>
      </div>
      <div class="prompt-memory-body">
        <div class="prompt-memory-controls">
          <select data-role="agent-select">
            ${agentOptions()}
          </select>
          <button data-action="add-directory">Add Directory</button>
        </div>
        <div data-role="directories" class="prompt-memory-directories">
          <div class="prompt-memory-empty">Scanning directories...</div>
        </div>
        <div data-role="results" class="prompt-memory-results"></div>
      </div>
      <div class="prompt-memory-footer">
        <span data-role="status">0 selected</span>
        <div class="prompt-memory-footer-actions">
          <button data-action="start-scan">Confirm Scan</button>
          <button data-action="save-selected" disabled>Save to Favorites</button>
        </div>
      </div>
    </section>
  `;

  bindEvents(controller);
  renderDirectories(await controller.detectDirectories());
  renderResults(controller);
}

function bindEvents(controller: PromptMemoryController): void {
  const root = getRoot();
  root.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    root.innerHTML = '';
  });
  root.querySelector('.prompt-memory-backdrop')?.addEventListener('click', () => {
    root.innerHTML = '';
  });
  root.querySelector('[data-action="add-directory"]')?.addEventListener('click', async () => {
    const select = root.querySelector<HTMLSelectElement>('[data-role="agent-select"]')!;
    await controller.chooseDirectory(select.value as PromptMemoryAgent);
    renderDirectories(controller.directories);
  });
  root.querySelector('[data-action="start-scan"]')?.addEventListener('click', () => {
    controller.startScan(controller.directories);
    renderResults(controller);
  });
  root.querySelector('[data-action="save-selected"]')?.addEventListener('click', async () => {
    await controller.saveSelectedToFavorites();
    bridge.renderHistory();
    renderResults(controller);
  });
}

function renderDirectories(directories: PromptMemoryDirectory[]): void {
  const container = getRoot().querySelector<HTMLElement>('[data-role="directories"]');
  if (!container) return;

  if (directories.length === 0) {
    container.innerHTML = '<div class="prompt-memory-empty">No directories found</div>';
    return;
  }

  container.innerHTML = directories.map(directory => `
    <label class="prompt-memory-directory">
      <input type="checkbox" data-directory-id="${escapeHtml(directory.id)}" ${directory.selected ? 'checked' : ''} ${!directory.exists ? 'disabled' : ''}>
      <span>${escapeHtml(AGENT_LABELS[directory.agent])}</span>
      <span class="prompt-memory-path" title="${escapeHtml(directory.path)}">${escapeHtml(directory.path)}</span>
      <span class="prompt-memory-badge">${directory.isDetected ? 'Detected' : 'Custom'} · ${directory.exists ? 'Found' : 'Missing'}</span>
    </label>
  `).join('');

  container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', () => {
      const directory = directories.find(item => item.id === input.dataset.directoryId);
      if (directory) directory.selected = input.checked;
    });
  });
}

function renderResults(controller: PromptMemoryController): void {
  const root = getRoot();
  const container = root.querySelector<HTMLElement>('[data-role="results"]');
  if (!container) return;

  const items = controller.items ?? [];
  if (items.length === 0) {
    container.innerHTML = '<div class="prompt-memory-empty">No prompt entries yet</div>';
    updateFooter(controller);
    return;
  }

  container.innerHTML = `
    <div class="prompt-memory-result-tools">
      <input data-role="result-search" type="search" placeholder="Search prompts">
      <select data-role="result-agent">
        <option value="all">All agents</option>
        ${agentOptions()}
      </select>
    </div>
    <div data-role="result-list"></div>
  `;

  const search = container.querySelector<HTMLInputElement>('[data-role="result-search"]')!;
  const agent = container.querySelector<HTMLSelectElement>('[data-role="result-agent"]')!;
  const renderList = () => {
    const filtered = filterItems(items, search.value, agent.value);
    container.querySelector<HTMLElement>('[data-role="result-list"]')!.innerHTML = filtered.map(item => resultRow(item)).join('');
    container.querySelectorAll<HTMLInputElement>('.prompt-memory-result input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        const item = items.find(candidate => candidate.id === input.dataset.itemId);
        if (item) item.selected = input.checked;
        updateFooter(controller);
      });
    });
    container.querySelectorAll<HTMLElement>('.prompt-memory-result-content').forEach(content => {
      content.addEventListener('click', () => {
        content.closest('.prompt-memory-result')?.classList.toggle('expanded');
      });
    });
    updateFooter(controller);
  };

  search.addEventListener('input', renderList);
  agent.addEventListener('change', renderList);
  renderList();
}

function filterItems(items: PromptMemoryItem[], query: string, agent: string): PromptMemoryItem[] {
  const normalized = query.trim().toLowerCase();
  return items.filter(item => {
    const matchesQuery = !normalized || item.content.toLowerCase().includes(normalized);
    const matchesAgent = agent === 'all' || item.agents.includes(agent as PromptMemoryAgent);
    return matchesQuery && matchesAgent;
  });
}

function resultRow(item: PromptMemoryItem): string {
  const disabled = item.existsInHistory || item.saved;
  const status = item.saved ? 'Saved' : item.existsInHistory ? 'Exists' : item.agents.map(agent => AGENT_LABELS[agent]).join(', ');
  return `
    <label class="prompt-memory-result ${item.expanded ? 'expanded' : ''}">
      <input type="checkbox" data-item-id="${escapeHtml(item.id)}" ${item.selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span class="prompt-memory-result-content">${escapeHtml(item.content)}</span>
      <span class="prompt-memory-badge">${escapeHtml(status)}</span>
    </label>
  `;
}

function updateFooter(controller: PromptMemoryController): void {
  const selected = (controller.items ?? []).filter(item => item.selected && !item.existsInHistory && !item.saved).length;
  const status = getRoot().querySelector<HTMLElement>('[data-role="status"]');
  const save = getRoot().querySelector<HTMLButtonElement>('[data-action="save-selected"]');
  if (status) status.textContent = `${selected} selected`;
  if (save) save.disabled = selected === 0;
}

function agentOptions(): string {
  return (Object.keys(AGENT_LABELS) as PromptMemoryAgent[])
    .map(agent => `<option value="${agent}">${AGENT_LABELS[agent]}</option>`)
    .join('');
}

function getRoot(): HTMLElement {
  let root = document.getElementById('prompt-memory-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'prompt-memory-root';
    document.body.appendChild(root);
  }
  return root;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
