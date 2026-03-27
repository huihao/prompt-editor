import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';

const lightColors = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#1d1d1f',
  },
  '.cm-cursor': { borderLeftColor: '#1d1d1f' },
  '.cm-activeLine': { backgroundColor: '#f5f5f7' },
  '.cm-selectionMatch': { backgroundColor: '#e8e8ed' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#b4d5fe',
  },
  '.cm-gutters': {
    backgroundColor: '#f5f5f7',
    color: '#8e8e93',
    border: 'none',
  },
});

const darkColors = EditorView.theme(
  {
    '&': {
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
    },
    '.cm-cursor': { borderLeftColor: '#d4d4d4' },
    '.cm-activeLine': { backgroundColor: '#2a2a2a' },
    '.cm-selectionMatch': { backgroundColor: '#3a3a3a' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#264f78',
    },
    '.cm-gutters': {
      backgroundColor: '#1e1e1e',
      color: '#858585',
      border: 'none',
    },
  },
  { dark: true }
);

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: 'bold', fontSize: '1.4em' },
  { tag: tags.heading2, fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading3, fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#0066ff', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'SF Mono, Menlo, monospace', fontSize: '0.9em' },
  { tag: tags.quote, color: '#6e6e73', fontStyle: 'italic' },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: 'bold', fontSize: '1.4em', color: '#569cd6' },
  { tag: tags.heading2, fontWeight: 'bold', fontSize: '1.2em', color: '#569cd6' },
  { tag: tags.heading3, fontWeight: 'bold', fontSize: '1.1em', color: '#569cd6' },
  { tag: tags.strong, fontWeight: 'bold', color: '#d19a66' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#c678dd' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#4fc1ff', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'SF Mono, Menlo, monospace', fontSize: '0.9em', color: '#ce9178' },
  { tag: tags.quote, color: '#858585', fontStyle: 'italic' },
]);

export const lightTheme = [lightColors, syntaxHighlighting(lightHighlight)];
export const darkTheme = [darkColors, syntaxHighlighting(darkHighlight)];
