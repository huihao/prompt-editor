import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Transaction } from '@codemirror/state';

// Storage for images
const IMAGES_STORAGE_KEY = 'promptEditor:images';

interface StoredImage {
  id: string;
  dataUrl: string;
  name: string;
  size: number;
  timestamp: number;
}

// Get all stored images
export function getStoredImages(): Record<string, StoredImage> {
  try {
    const data = localStorage.getItem(IMAGES_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save images to storage
function saveStoredImages(images: Record<string, StoredImage>) {
  localStorage.setItem(IMAGES_STORAGE_KEY, JSON.stringify(images));
}

// Store image and return ID
export function storeImage(dataUrl: string, name: string = 'image'): string {
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const images = getStoredImages();
  images[id] = {
    id,
    dataUrl,
    name,
    size: dataUrl.length,
    timestamp: Date.now(),
  };
  saveStoredImages(images);
  return id;
}

// Get image by ID
export function getImage(id: string): StoredImage | null {
  return getStoredImages()[id] || null;
}

// Delete image
export function deleteImage(id: string) {
  const images = getStoredImages();
  delete images[id];
  saveStoredImages(images);
}

// Clean up unused images (not referenced in content)
export function cleanupUnusedImages(content: string) {
  const images = getStoredImages();
  const used = new Set<string>();
  const regex = /!\[.*?\]\(image:\/\/(\w+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    used.add(match[1]);
  }
  
  for (const id of Object.keys(images)) {
    if (!used.has(id)) {
      delete images[id];
    }
  }
  saveStoredImages(images);
}

// Convert file to data URL
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Show paste hint
function showPasteHint(message: string = '📎 Image pasted') {
  const hint = document.getElementById('paste-hint');
  if (!hint) return;
  hint.textContent = message;
  hint.classList.add('show');
  setTimeout(() => {
    hint.classList.remove('show');
  }, 2000);
}

// Handle paste event
async function handlePaste(view: EditorView, event: ClipboardEvent): Promise<boolean> {
  const items = event.clipboardData?.items;
  if (!items) return false;

  const imageItems: DataTransferItem[] = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      imageItems.push(item);
    }
  }

  if (imageItems.length === 0) return false;

  event.preventDefault();
  let successCount = 0;

  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) continue;

    try {
      const dataUrl = await fileToDataUrl(file);
      const id = storeImage(dataUrl, file.name);
      
      // Insert markdown image syntax at cursor position
      const imageMarkdown = `![${file.name}](image://${id})`;
      const pos = view.state.selection.main.head;
      
      view.dispatch({
        changes: {
          from: pos,
          to: pos,
          insert: imageMarkdown,
        },
        selection: { anchor: pos + imageMarkdown.length },
      });
      successCount++;
    } catch (err) {
      console.error('Failed to process pasted image:', err);
    }
  }

  if (successCount > 0) {
    showPasteHint(successCount === 1 ? '📎 Image pasted' : `📎 ${successCount} images pasted`);
  }

  return true;
}

// Create the paste handler plugin
export function imagePasteHandler() {
  return ViewPlugin.fromClass(
    class {
      view: EditorView;

      constructor(view: EditorView) {
        this.view = view;
        this.handlePaste = this.handlePaste.bind(this);
        view.dom.addEventListener('paste', this.handlePaste);
      }

      handlePaste(event: ClipboardEvent) {
        handlePaste(this.view, event);
      }

      destroy() {
        this.view.dom.removeEventListener('paste', this.handlePaste);
      }

      update(_update: ViewUpdate) {}
    }
  );
}

// Custom image renderer extension
export function imageRenderer() {
  return EditorView.domEventHandlers({
    // Override click on image:// links to prevent navigation
    click(event, view) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        const match = img.src.match(/^image:\/\/(\w+)$/);
        if (match) {
          // Prevent default to avoid navigation
          event.preventDefault();
          return true;
        }
      }
      return false;
    },
  });
}

// Get all images referenced in content
export function getReferencedImages(content: string): string[] {
  const ids: string[] = [];
  const regex = /!\[.*?\]\(image:\/\/(\w+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

// Replace image:// URLs with actual data URLs for preview/export
export function resolveImageUrls(content: string): string {
  return content.replace(/!\[(.*?)\]\(image:\/\/(\w+)\)/g, (match, alt, id) => {
    const img = getImage(id);
    if (img) {
      return `![${alt}](${img.dataUrl})`;
    }
    return match; // Keep original if image not found
  });
}

// Prepare content for sending (resolve all image URLs)
export function prepareContentForSend(content: string): string {
  return resolveImageUrls(content);
}
