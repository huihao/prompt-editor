import Cocoa
import WebKit

/// A borderless, transparent popup window for the snippet wheel selector
/// Similar to CS:GO weapon wheel - appears as an overlay without window chrome
public class SnippetWheelWindow: NSObject, WKScriptMessageHandler {
    public let window: NSPanel
    public let webView: WKWebView
    public var onSnippetSelected: ((String) -> Void)?
    public var onClose: (() -> Void)?
    public var onManage: (() -> Void)?
    
    private let wheelRadius: CGFloat = 200
    private var clickMonitor: Any?
    private var snippetData: String = ""
    
    public override init() {
        // Calculate window size - needs to fit the wheel
        let windowSize: CGFloat = 600
        
        // Center on screen
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let windowFrame = NSRect(
            x: screenFrame.midX - windowSize / 2,
            y: screenFrame.midY - windowSize / 2,
            width: windowSize,
            height: windowSize
        )
        
        // Create borderless, transparent panel
        window = NSPanel(
            contentRect: windowFrame,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        
        // Configure for overlay appearance - full screen transparent window
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.level = .modalPanel
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.isFloatingPanel = true
        
        // Make window full screen size (covering entire screen)
        if let screen = NSScreen.main {
            window.setFrame(screen.visibleFrame, display: false)
        }
        
        // Configure WKWebView
        let config = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        config.userContentController = userContentController
        
        // Configure for transparency
        config.preferences.setValue(true, forKey: "allowsPictureInPictureMediaPlayback")
        
        // Use persistent data store for localStorage consistency
        config.websiteDataStore = WKWebsiteDataStore.default()
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.setValue(false, forKey: "drawsBackground")
        
        super.init()
        
        // Add message handler for JS bridge
        userContentController.add(self, name: "snippetWheel")
        
        // Setup content view
        let container = NSView(frame: .zero)
        container.translatesAutoresizingMaskIntoConstraints = false
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor.clear.cgColor
        window.contentView = container
        container.addSubview(webView)
        
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
    }
    
    private func loadWheelHTML() {
        // Build inline HTML with embedded snippet data
        let html = buildHTML()
        DispatchQueue.main.async { [weak self] in
            self?.webView.loadHTMLString(html, baseURL: nil)
        }
    }
    
    private func buildHTML() -> String {
        // Safely encode snippet data to base64
        let base64Data: String
        if let data = snippetData.data(using: .utf8) {
            base64Data = data.base64EncodedString()
        } else {
            base64Data = "eyJ2ZXJzaW9uIjoiMS4wIiwiY2F0ZWdvcmllcyI6W119" // Empty data
        }
        
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body {
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    background: transparent;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .snippet-wheel-popup {
                    width: 100%;
                    height: 100%;
                    background: transparent;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: default;
                }
                
                /* Click-through background - clicking here closes the window */
                .wheel-background {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: transparent;
                    cursor: default;
                }
                
                .snippet-wheel-container {
                    position: relative;
                    width: 600px;
                    height: 600px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border-radius: 20px;
                    cursor: default;
                    pointer-events: auto;
                }
                
                .snippet-wheel-breadcrumb {
                    position: absolute;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    color: var(--fg, #d4d4d4);
                    padding: 8px 16px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 20px;
                    max-width: 90%;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                @media (prefers-color-scheme: light) {
                    .snippet-wheel-breadcrumb {
                        color: #1d1d1f;
                        background: transparent;
                        border-color: rgba(0, 0, 0, 0.1);
                    }
                }
                
                .snippet-wheel-breadcrumb .bc-root,
                .snippet-wheel-breadcrumb .bc-item {
                    cursor: pointer;
                    opacity: 0.7;
                    transition: opacity 0.15s;
                }
                
                .snippet-wheel-breadcrumb .bc-root:hover,
                .snippet-wheel-breadcrumb .bc-item:hover {
                    opacity: 1;
                    color: #0066ff;
                }
                
                .snippet-wheel-breadcrumb .bc-separator {
                    opacity: 0.4;
                }
                
                .snippet-wheel-breadcrumb .bc-current {
                    font-weight: 600;
                    opacity: 1;
                }
                
                /* Manage button */
                .snippet-wheel-manage {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(60, 60, 60, 0.8);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: #fff;
                    font-size: 20px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    z-index: 10;
                }
                
                .snippet-wheel-manage:hover {
                    background: #0066ff;
                    border-color: #0066ff;
                    transform: rotate(30deg);
                }
                
                /* Close button */
                .snippet-wheel-close {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(60, 60, 60, 0.8);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: #fff;
                    font-size: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    z-index: 10;
                }
                
                .snippet-wheel-close:hover {
                    background: #ff3b30;
                    border-color: #ff3b30;
                    color: #fff;
                }
                
                @media (prefers-color-scheme: light) {
                    .snippet-wheel-manage {
                        background: rgba(255, 255, 255, 0.9);
                        border-color: rgba(0, 0, 0, 0.1);
                        color: #1d1d1f;
                    }
                    .snippet-wheel-manage:hover {
                        background: #0066ff;
                        border-color: #0066ff;
                        color: #fff;
                    }
                    .snippet-wheel-close {
                        background: rgba(255, 255, 255, 0.9);
                        border-color: rgba(0, 0, 0, 0.1);
                        color: #1d1d1f;
                    }
                    .snippet-wheel-close:hover {
                        background: #ff3b30;
                        border-color: #ff3b30;
                        color: #fff;
                    }
                }
                
                .snippet-wheel {
                    position: relative;
                    width: 400px;
                    height: 400px;
                }
                
                /* Prominent center disc */
                .snippet-wheel-center {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 140px;
                    height: 140px;
                    border-radius: 50%;
                    background: linear-gradient(145deg, #3a3a3c 0%, #2d2d2f 100%);
                    border: 3px solid rgba(100, 181, 246, 0.4);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 12px;
                    z-index: 10;
                    box-shadow: 
                        0 8px 32px rgba(0, 0, 0, 0.4),
                        0 0 0 8px rgba(50, 50, 50, 0.3),
                        inset 0 2px 4px rgba(255, 255, 255, 0.05),
                        inset 0 -2px 4px rgba(0, 0, 0, 0.2);
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .snippet-wheel-center::before {
                    content: '';
                    position: absolute;
                    top: -12px;
                    left: -12px;
                    right: -12px;
                    bottom: -12px;
                    border-radius: 50%;
                    background: conic-gradient(from 0deg, transparent, rgba(100, 181, 246, 0.1), transparent);
                    animation: rotate 10s linear infinite;
                    z-index: -1;
                }

                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                @media (prefers-color-scheme: light) {
                    .snippet-wheel-center {
                        background: linear-gradient(145deg, #ffffff 0%, #f0f0f5 100%);
                        border-color: rgba(0, 102, 255, 0.3);
                        box-shadow: 
                            0 8px 32px rgba(0, 0, 0, 0.15),
                            0 0 0 8px rgba(255, 255, 255, 0.5),
                            inset 0 2px 4px rgba(255, 255, 255, 1),
                            inset 0 -2px 4px rgba(0, 0, 0, 0.05);
                    }
                    .snippet-wheel-center::before {
                        background: conic-gradient(from 0deg, transparent, rgba(0, 102, 255, 0.1), transparent);
                    }
                }
                
                .snippet-wheel-center .center-icon {
                    font-size: 36px;
                    margin-bottom: 6px;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
                }
                
                .snippet-wheel-center .center-text {
                    font-size: 13px;
                    font-weight: 700;
                    margin-bottom: 4px;
                    line-height: 1.2;
                    color: #f5f5f7;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
                }

                @media (prefers-color-scheme: light) {
                    .snippet-wheel-center .center-text {
                        color: #1d1d1f;
                        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
                    }
                }
                
                .snippet-wheel-center .center-desc {
                    font-size: 10px;
                    color: #999;
                    line-height: 1.3;
                    max-height: 36px;
                    overflow: hidden;
                    padding: 0 4px;
                }

                @media (prefers-color-scheme: light) {
                    .snippet-wheel-center .center-desc {
                        color: #666;
                    }
                }
                
                .wheel-item {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 80px;
                    height: 80px;
                    margin-left: -40px;
                    margin-top: -40px;
                    border-radius: 50%;
                    background: rgba(50, 50, 50, 0.9);
                    border: 2px solid rgba(100, 181, 246, 0.3);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    cursor: pointer;
                    pointer-events: auto;
                    user-select: none;
                    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                    animation: scaleIn 0.3s ease backwards;
                    box-shadow: 
                        0 4px 15px rgba(0, 0, 0, 0.3), 
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    z-index: 5;
                }
                
                @media (prefers-color-scheme: light) {
                    .wheel-item {
                        background: rgba(255, 255, 255, 0.95);
                        border-color: rgba(0, 102, 255, 0.2);
                        box-shadow: 
                            0 4px 15px rgba(0, 0, 0, 0.1), 
                            inset 0 1px 0 rgba(255, 255, 255, 0.8);
                    }
                }
                
                @keyframes scaleIn {
                    from { opacity: 0; transform: translate(0, 0) scale(0.3); }
                    to { opacity: 1; transform: scale(1); }
                }
                
                .wheel-item:hover {
                    transform: scale(1.2);
                    border-color: #64b5f6;
                    box-shadow: 0 8px 30px rgba(100, 181, 246, 0.3);
                    z-index: 6;
                }
                
                .wheel-item.category {
                    background: linear-gradient(135deg, rgba(60,60,60,0.95) 0%, rgba(45,45,45,0.95) 100%);
                }
                
                @media (prefers-color-scheme: light) {
                    .wheel-item.category {
                        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(245,245,247,0.95) 100%);
                    }
                }
                
                .wheel-item.snippet {
                    background: linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%);
                    color: #fff;
                    border-color: rgba(100, 181, 246, 0.5);
                }
                
                .wheel-item.snippet:hover {
                    background: linear-gradient(135deg, #42a5f5 0%, #2196f3 100%);
                    box-shadow: 0 8px 30px rgba(100, 181, 246, 0.4);
                }
                
                .wheel-item.back {
                    background: transparent;
                    border: 2px dashed rgba(255, 255, 255, 0.2);
                    opacity: 0.8;
                }
                
                @media (prefers-color-scheme: light) {
                    .wheel-item.back {
                        border-color: rgba(0, 0, 0, 0.2);
                    }
                }
                
                .wheel-item.back:hover {
                    opacity: 1;
                    border-color: #ff9500;
                    background: rgba(255, 149, 0, 0.1);
                }
                
                .wheel-item-icon {
                    font-size: 24px;
                    margin-bottom: 2px;
                }
                
                .wheel-item-name {
                    font-size: 10px;
                    font-weight: 600;
                    line-height: 1.2;
                    max-width: 70px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .wheel-item-desc {
                    font-size: 8px;
                    opacity: 0.8;
                    max-width: 70px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: none;
                    margin-top: 2px;
                }
                
                .wheel-item:hover .wheel-item-desc {
                    display: block;
                }
            </style>
        </head>
        <body>
            <div class="snippet-wheel-popup" id="root">
                <div class="wheel-background" id="background"></div>
            </div>
            <script>
                // Snippet data injected from native (base64 encoded)
                const SNIPPET_DATA_JSON = '\(base64Data)';
                const SNIPPET_DATA = JSON.parse(
                    new TextDecoder().decode(
                        Uint8Array.from(atob(SNIPPET_DATA_JSON), c => c.charCodeAt(0))
                    )
                );
                
                // Wheel state
                let currentCategoryId = null;
                let currentItems = [];
                const WHEEL_RADIUS = 180;
                
                // Initialize
                document.addEventListener('DOMContentLoaded', () => {
                    renderRoot();
                    setupBackgroundClick();
                });
                
                // Setup click on background to close window
                function setupBackgroundClick() {
                    const background = document.getElementById('background');
                    if (background) {
                        background.addEventListener('click', (e) => {
                            // Only close if clicking directly on the background
                            if (e.target === background) {
                                closeWheel();
                            }
                        });
                    }
                }
                
                function closeWheel() {
                    window.webkit?.messageHandlers?.snippetWheel?.postMessage({ type: 'close' });
                }
                
                function getCategories() {
                    return SNIPPET_DATA.categories || [];
                }
                
                function getCategory(id) {
                    function find(cat) {
                        if (cat.id === id) return cat;
                        if (cat.subcategories) {
                            for (const sub of cat.subcategories) {
                                const found = find(sub);
                                if (found) return found;
                            }
                        }
                        return null;
                    }
                    for (const cat of getCategories()) {
                        const found = find(cat);
                        if (found) return found;
                    }
                    return null;
                }
                
                function getSubcategories(categoryId) {
                    const cat = getCategory(categoryId);
                    return cat?.subcategories || [];
                }
                
                function getSnippets(categoryId) {
                    const cat = getCategory(categoryId);
                    return cat?.snippets || [];
                }
                
                function hasSubcategories(categoryId) {
                    return getSubcategories(categoryId).length > 0;
                }
                
                function hasSnippets(categoryId) {
                    return getSnippets(categoryId).length > 0;
                }
                
                function getBreadcrumbPath(categoryId) {
                    const path = [];
                    function find(categories, targetId, currentPath) {
                        for (const cat of categories) {
                            const newPath = [...currentPath, cat];
                            if (cat.id === targetId) {
                                path.push(...newPath);
                                return true;
                            }
                            if (cat.subcategories && find(cat.subcategories, targetId, newPath)) {
                                return true;
                            }
                        }
                        return false;
                    }
                    find(getCategories(), categoryId, []);
                    return path;
                }
                
                function renderRoot() {
                    currentCategoryId = null;
                    const categories = getCategories();
                    currentItems = categories.map(cat => ({
                        id: cat.id,
                        name: cat.name,
                        icon: cat.icon,
                        description: cat.description,
                        type: 'category',
                        data: cat
                    }));
                    renderWheel();
                    updateBreadcrumb();
                }
                
                function renderCategory(categoryId) {
                    const category = getCategory(categoryId);
                    if (!category) return;
                    
                    currentCategoryId = categoryId;
                    currentItems = [];
                    
                    // Add back button
                    currentItems.push({
                        id: 'back',
                        name: 'Back',
                        icon: '←',
                        description: 'Go back',
                        type: 'back'
                    });
                    
                    // Add subcategories
                    const subcategories = getSubcategories(categoryId);
                    subcategories.forEach(sub => {
                        currentItems.push({
                            id: sub.id,
                            name: sub.name,
                            icon: sub.icon,
                            description: sub.description,
                            type: 'category',
                            data: sub
                        });
                    });
                    
                    // Add snippets
                    const snippets = getSnippets(categoryId);
                    snippets.forEach(snippet => {
                        currentItems.push({
                            id: snippet.id,
                            name: snippet.name,
                            icon: '📝',
                            description: snippet.description,
                            type: 'snippet',
                            data: snippet
                        });
                    });
                    
                    renderWheel();
                    updateBreadcrumb();
                }
                
                function renderWheel() {
                    const root = document.getElementById('root');
                    const itemCount = currentItems.length;
                    
                    let wheelHTML = '<div class="snippet-wheel-container">';
                    wheelHTML += '<div class="snippet-wheel-manage" id="manageBtn" title="Manage Snippets">⚙️</div>';
                    wheelHTML += '<div class="snippet-wheel-close" id="closeBtn" title="Close">✕</div>';
                    wheelHTML += '<div class="snippet-wheel-breadcrumb" id="breadcrumb"></div>';
                    wheelHTML += '<div class="snippet-wheel">';
                    wheelHTML += '<div class="snippet-wheel-center" id="center">';
                    wheelHTML += '<div class="center-icon">🎯</div>';
                    wheelHTML += '<div class="center-text">Prompt Snippets</div>';
                    wheelHTML += '<div class="center-desc">Select a category<br>⚙️ to manage</div>';
                    wheelHTML += '</div></div></div>';
                    
                    root.innerHTML = wheelHTML;
                    
                    // Add manage button click handler
                    const manageBtn = document.getElementById('manageBtn');
                    if (manageBtn) {
                        manageBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            window.webkit?.messageHandlers?.snippetWheel?.postMessage({ type: 'manage' });
                        });
                    }
                    
                    // Add close button click handler
                    const closeBtn = document.getElementById('closeBtn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            closeWheel();
                        });
                    }
                    
                    const wheelContainer = root.querySelector('.snippet-wheel');
                    const centerEl = document.getElementById('center');
                    
                    if (currentCategoryId) {
                        const cat = getCategory(currentCategoryId);
                        if (cat) {
                            centerEl.innerHTML = `<div class="center-icon">${cat.icon}</div><div class="center-text">${cat.name}</div><div class="center-desc">${cat.description}</div>`;
                        }
                    }
                    
                    // Calculate positions
                    const angleStep = (2 * Math.PI) / itemCount;
                    const startAngle = -Math.PI / 2;
                    
                    currentItems.forEach((item, index) => {
                        const angle = startAngle + index * angleStep;
                        const x = Math.cos(angle) * WHEEL_RADIUS;
                        const y = Math.sin(angle) * WHEEL_RADIUS;
                        
                        const itemEl = document.createElement('div');
                        itemEl.className = `wheel-item ${item.type}`;
                        itemEl.style.cssText = `transform: translate(${x}px, ${y}px); animation-delay: ${index * 0.05}s;`;
                        itemEl.innerHTML = `<div class="wheel-item-icon">${item.icon}</div><div class="wheel-item-name">${item.name}</div><div class="wheel-item-desc">${item.description}</div>`;
                        
                        itemEl.addEventListener('click', () => handleItemClick(item));
                        itemEl.addEventListener('mouseenter', () => updateCenterPreview(item));
                        itemEl.addEventListener('mouseleave', () => resetCenterPreview());
                        
                        wheelContainer.appendChild(itemEl);
                    });
                    
                    updateBreadcrumb();
                }
                
                function updateCenterPreview(item) {
                    const centerEl = document.getElementById('center');
                    if (!centerEl) return;
                    
                    if (item.type === 'snippet' && item.data) {
                        const snippet = item.data;
                        const preview = snippet.content.slice(0, 60) + (snippet.content.length > 60 ? '...' : '');
                        centerEl.innerHTML = `<div class="center-icon">${item.icon}</div><div class="center-text">${item.name}</div><div class="center-desc">${preview}</div>`;
                    } else {
                        centerEl.innerHTML = `<div class="center-icon">${item.icon}</div><div class="center-text">${item.name}</div><div class="center-desc">${item.description}</div>`;
                    }
                }
                
                function resetCenterPreview() {
                    const centerEl = document.getElementById('center');
                    if (!centerEl) return;
                    
                    if (currentCategoryId) {
                        const cat = getCategory(currentCategoryId);
                        if (cat) {
                            centerEl.innerHTML = `<div class="center-icon">${cat.icon}</div><div class="center-text">${cat.name}</div><div class="center-desc">${cat.description}</div>`;
                        }
                    } else {
                        centerEl.innerHTML = `<div class="center-icon">🎯</div><div class="center-text">Prompt Snippets</div><div class="center-desc">Select a category</div>`;
                    }
                }
                
                function handleItemClick(item) {
                    if (item.type === 'back') {
                        goBack();
                    } else if (item.type === 'category' && item.data) {
                        if (hasSubcategories(item.id) || hasSnippets(item.id)) {
                            renderCategory(item.id);
                        }
                    } else if (item.type === 'snippet' && item.data) {
                        selectSnippet(item.data);
                    }
                }
                
                function goBack() {
                    if (!currentCategoryId) return;
                    const path = getBreadcrumbPath(currentCategoryId);
                    if (path.length <= 1) {
                        renderRoot();
                    } else {
                        const parent = path[path.length - 2];
                        if (parent) {
                            renderCategory(parent.id);
                        } else {
                            renderRoot();
                        }
                    }
                }
                
                function updateBreadcrumb() {
                    const breadcrumbEl = document.getElementById('breadcrumb');
                    if (!breadcrumbEl) return;
                    
                    if (!currentCategoryId) {
                        breadcrumbEl.innerHTML = '<span class="bc-root">Categories</span>';
                        return;
                    }
                    
                    const path = getBreadcrumbPath(currentCategoryId);
                    let html = '<span class="bc-root" data-id="">Categories</span>';
                    
                    path.forEach((cat, index) => {
                        html += ' <span class="bc-separator">›</span> ';
                        if (index === path.length - 1) {
                            html += `<span class="bc-current">${cat.icon} ${cat.name}</span>`;
                        } else {
                            html += `<span class="bc-item" data-id="${cat.id}">${cat.icon} ${cat.name}</span>`;
                        }
                    });
                    
                    breadcrumbEl.innerHTML = html;
                    
                    breadcrumbEl.querySelectorAll('.bc-root, .bc-item').forEach(el => {
                        el.addEventListener('click', (e) => {
                            const id = e.currentTarget.dataset.id;
                            if (!id) {
                                renderRoot();
                            } else {
                                renderCategory(id);
                            }
                        });
                    });
                }
                
                function selectSnippet(snippet) {
                    window.webkit?.messageHandlers?.snippetWheel?.postMessage({
                        type: 'select',
                        content: snippet.content
                    });
                }
            </script>
        </body>
        </html>
        """
    }
    
    deinit {
        if let monitor = clickMonitor {
            NSEvent.removeMonitor(monitor)
        }
    }
    
    public func show() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            // Ensure window is centered
            if let screen = NSScreen.main {
                let windowSize: CGFloat = 600
                let windowFrame = NSRect(
                    x: screen.visibleFrame.midX - windowSize / 2,
                    y: screen.visibleFrame.midY - windowSize / 2,
                    width: windowSize,
                    height: windowSize
                )
                self.window.setFrame(windowFrame, display: false)
            }
            
            // Activate app and show window
            NSApp.activate(ignoringOtherApps: true)
            self.window.makeKeyAndOrderFront(nil)
            self.window.alphaValue = 0
            
            // Setup click outside monitor
            self.setupClickOutsideMonitor()
            
            // Fade in animation
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.15
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                self.window.animator().alphaValue = 1
            }
        }
    }
    
    private func setupClickOutsideMonitor() {
        // Remove existing monitor if any
        if let monitor = clickMonitor {
            NSEvent.removeMonitor(monitor)
            clickMonitor = nil
        }
        
        // Add local monitor for Escape key to close the wheel
        clickMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self else { return event }
            
            if event.keyCode == 53 { // Escape key
                self.close()
                return nil // Consume the event
            }
            
            return event
        }
    }
    
    public func close() {
        // Remove monitor
        if let monitor = clickMonitor {
            NSEvent.removeMonitor(monitor)
            clickMonitor = nil
        }
        
        NSAnimationContext.runAnimationGroup({ [weak self] context in
            context.duration = 0.1
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            self?.window.animator().alphaValue = 0
        }, completionHandler: { [weak self] in
            self?.window.orderOut(nil)
            self?.onClose?()
        })
    }
    
    public func injectSnippetData(_ json: String) {
        snippetData = json
        // Reload HTML with new data
        loadWheelHTML()
    }
    
    // MARK: - WKScriptMessageHandler
    
    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        
        switch type {
        case "select":
            if let content = body["content"] as? String {
                onSnippetSelected?(content)
            }
        case "manage":
            // Close wheel and notify to open manager
            onManage?()
            close()
        case "close":
            close()
        default:
            break
        }
    }
}

// MARK: - Integration with MainWindow

extension MainWindow {
    /// Show the snippet wheel popup
    public func showSnippetWheel(onSelect: @escaping (String) -> Void) {
        // Create wheel window if needed
        let wheelWindow = SnippetWheelWindow()
        
        wheelWindow.onSnippetSelected = { content in
            onSelect(content)
        }
        
        wheelWindow.onClose = { [weak self] in
            // Return focus to main window
            self?.window.makeKeyAndOrderFront(nil)
        }
        
        wheelWindow.show()
    }
}
