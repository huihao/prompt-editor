// Diagnostic Script for Snippet Manager
// Run this in Safari Web Inspector Console

console.log("=== Prompt Editor Diagnostic Tool ===");
console.log("");

// 1. Check if logger exists
console.log("1. Logger System Check:");
console.log("  - typeof ue:", typeof ue);
console.log("  - ue instance:", ue);
console.log("");

// 2. Check Snippet Manager
console.log("2. Snippet Manager Check:");
console.log("  - typeof be:", typeof be);
console.log("  - be.isLoaded:", be?.isLoaded);
console.log("  - Categories count:", be?.categoryMap?.size);
console.log("  - Snippets count:", be?.snippetMap?.size);
console.log("");

// 3. Check UI instance
console.log("3. UI Instance Check:");
console.log("  - typeof O$:", typeof O$);
console.log("  - O$.isOpen():", O$?.isOpen?.());
console.log("");

// 4. Check DOM elements (if UI is open)
console.log("4. DOM Elements Check:");
const overlay = document.querySelector('.snippet-manager-overlay');
console.log("  - Overlay exists:", !!overlay);

if (overlay) {
  console.log("  - Container exists:", !!document.querySelector('.snippet-manager-body'));

  const toolbar = document.querySelector('.snippet-manager-toolbar');
  console.log("  - Toolbar exists:", !!toolbar);

  const buttons = {
    'btn-add-category': document.getElementById('btn-add-category'),
    'btn-add-snippet': document.getElementById('btn-add-snippet'),
    'btn-logs': document.getElementById('btn-logs'),
    'btn-export': document.getElementById('btn-export'),
    'btn-import': document.getElementById('btn-import'),
    'btn-reset': document.getElementById('btn-reset')
  };

  console.log("  - Buttons found:");
  for (const [id, el] of Object.entries(buttons)) {
    console.log(`    - ${id}:`, !!el, el?.outerHTML?.substring(0, 60));
  }

  console.log("");
  console.log("5. Manual Test Actions:");

  // Test clicking logs button
  console.log("  - Clicking logs button manually...");
  if (buttons['btn-logs']) {
    buttons['btn-logs'].click();
    console.log("    ✓ Logs button clicked, check if logs view appeared");
  } else {
    console.log("    ✗ Logs button not found!");
    console.log("    - Toolbar HTML:", toolbar?.innerHTML?.substring(0, 200));
  }
} else {
  console.log("  ✗ UI is not open. Please open Snippet Manager first.");
  console.log("  - To open: Click snippet button in editor or use O$.open()");
}

console.log("");
console.log("=== Diagnostic Complete ===");
console.log("");

// Return summary
const summary = {
  loggerReady: typeof ue === 'object',
  managerReady: typeof be === 'object',
  uiReady: typeof O$ === 'object',
  uiOpen: !!overlay,
  logsButtonExists: !!document.getElementById('btn-logs')
};

console.log("Summary:", summary);
summary;