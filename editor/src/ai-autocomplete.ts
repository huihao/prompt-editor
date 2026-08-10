// AI Ghost Text Autocomplete — CodeMirror 6 extension
// Shows inline AI suggestions after 1.5s of inactivity; Tab/→ to accept, Escape to dismiss.

import {
  EditorView,
  WidgetType,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  keymap,
} from '@codemirror/view';
import { StateField, StateEffect, type Extension } from '@codemirror/state';
import { completionStatus } from '@codemirror/autocomplete';
import { streamAIText } from './ai-service';
import { isAIConfigured } from './ai-config';

// ─── System prompt ────────────────────────────────────────────────────────────

const AUTOCOMPLETE_SYSTEM_PROMPT = `You are an expert prompt engineer assistant. The user is writing a prompt. Based on what they've written, suggest a concise and useful continuation or follow-up prompt (1-3 sentences maximum).

Rules:
- Return ONLY the suggested continuation text, nothing else
- Make it directly useful as the next part of the prompt
- Match the style and context of what the user has already written
- Keep it brief and actionable`;

const AUTOCOMPLETE_CONTEXT_LIMIT = 1200;
const AUTOCOMPLETE_MIN_CHARS = 10;

export function buildAutocompleteContext(doc: string, cursorPos: number): string {
  const safePos = Math.max(0, Math.min(cursorPos, doc.length));
  const before = doc.slice(Math.max(0, safePos - AUTOCOMPLETE_CONTEXT_LIMIT), safePos);
  const after = doc.slice(safePos, Math.min(doc.length, safePos + 300));

  return `Before cursor:
${before}

Cursor position:
<cursor>

After cursor:
${after}`;
}

// ─── Ghost text widget ────────────────────────────────────────────────────────

class GhostTextWidget extends WidgetType {
  constructor(private text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-ai-suggestion';
    span.textContent = this.text;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text;
  }
}

// Loading indicator widget
class GhostLoadingWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-ai-suggestion cm-ai-suggestion-loading';
    span.textContent = ' ⋯';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

interface SuggestionState {
  text: string | null;  // null = no suggestion
  loading: boolean;
  pos: number;          // doc position where the widget is inserted
}

const setSuggestion = StateEffect.define<SuggestionState | null>();

const suggestionField = StateField.define<SuggestionState | null>({
  create: () => null,

  update(val, tr) {
    // Apply explicit effect first
    for (const effect of tr.effects) {
      if (effect.is(setSuggestion)) return effect.value;
    }
    // Clear on any document change
    if (tr.docChanged) return null;
    // Clear if cursor moved away from the position
    if (tr.selection && val) {
      const head = tr.newSelection.main.head;
      if (head !== val.pos) return null;
    }
    return val;
  },

  provide: (field) =>
    EditorView.decorations.from(field, (state): DecorationSet => {
      if (!state) return Decoration.none;

      const { text, loading, pos } = state;
      if (pos < 0) return Decoration.none;

      if (loading) {
        return Decoration.set([
          Decoration.widget({ widget: new GhostLoadingWidget(), side: 1 }).range(pos),
        ]);
      }

      if (text) {
        return Decoration.set([
          Decoration.widget({ widget: new GhostTextWidget(text), side: 1 }).range(pos),
        ]);
      }

      return Decoration.none;
    }),
});

// ─── View plugin (debounce + streaming) ───────────────────────────────────────

const ghostTextPlugin = ViewPlugin.fromClass(
  class {
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private abortCtrl: AbortController | null = null;
    private requestId = 0;

    update(update: ViewUpdate): void {
      if (!update.docChanged && !update.selectionSet) return;

      this.cancelPending(update.view);

      // Debounce: wait 1.5s after last change
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.triggerSuggestion(update.view);
      }, 1500);
    }

    private cancelPending(view: EditorView): void {
      if (this.abortCtrl) {
        this.abortCtrl.abort();
        this.abortCtrl = null;
      }
    }

    private triggerSuggestion(view: EditorView): void {
      if (!isAIConfigured()) return;

      const state = view.state;
      const doc = state.doc.toString();
      if (doc.trim().length < AUTOCOMPLETE_MIN_CHARS) return;

      const selection = state.selection.main;
      if (!selection.empty) return;
      const cursorPos = selection.head;

      // Don't show if autocomplete dropdown is active
      const compStatus = completionStatus(state);
      if (compStatus === 'active' || compStatus === 'pending') return;

      const requestId = ++this.requestId;

      // Show loading indicator
      view.dispatch({
        effects: setSuggestion.of({ text: null, loading: true, pos: cursorPos }),
      });

      let accumulated = '';

      this.abortCtrl = streamAIText(
        [
          { role: 'system', content: AUTOCOMPLETE_SYSTEM_PROMPT },
          { role: 'user', content: buildAutocompleteContext(doc, cursorPos) },
        ],
        (chunk) => {
          if (this.requestId !== requestId) return;
          accumulated += chunk;
          view.dispatch({
            effects: setSuggestion.of({
              text: accumulated,
              loading: false,
              pos: cursorPos,
            }),
          });
        },
        () => {
          if (this.requestId !== requestId) return;
          this.abortCtrl = null;
          if (!accumulated.trim()) {
            view.dispatch({ effects: setSuggestion.of(null) });
          }
        },
        (err) => {
          if (this.requestId !== requestId) return;
          this.abortCtrl = null;
          console.debug('[ai-autocomplete] suggestion error:', err.message);
          view.dispatch({ effects: setSuggestion.of(null) });
        },
      );
    }

    destroy(): void {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      if (this.abortCtrl) this.abortCtrl.abort();
    }
  },
);

// ─── Keymap ───────────────────────────────────────────────────────────────────

const ghostTextKeymap = keymap.of([
  {
    key: 'Tab',
    run: (view) => {
      const suggestion = view.state.field(suggestionField, false);
      if (!suggestion?.text) return false;

      // Don't intercept Tab if completion dropdown is showing
      const compStatus = completionStatus(view.state);
      if (compStatus === 'active' || compStatus === 'pending') return false;

      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, insert: suggestion.text },
        effects: setSuggestion.of(null),
        selection: { anchor: pos + suggestion.text.length },
      });
      return true;
    },
  },
  {
    key: 'ArrowRight',
    run: (view) => {
      const suggestion = view.state.field(suggestionField, false);
      if (!suggestion?.text) return false;

      const state = view.state;
      const pos = state.selection.main.head;
      // Only accept on ArrowRight if cursor is at end of doc
      if (pos !== state.doc.length) return false;

      view.dispatch({
        changes: { from: pos, insert: suggestion.text },
        effects: setSuggestion.of(null),
        selection: { anchor: pos + suggestion.text.length },
      });
      return true;
    },
  },
  {
    key: 'Escape',
    run: (view) => {
      const suggestion = view.state.field(suggestionField, false);
      if (!suggestion) return false;
      view.dispatch({ effects: setSuggestion.of(null) });
      return true;
    },
  },
]);

// ─── Public export ─────────────────────────────────────────────────────────────

export function aiAutocomplete(): Extension[] {
  return [suggestionField, ghostTextPlugin, ghostTextKeymap];
}
