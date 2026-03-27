import Cocoa
import WebKit
import PromptEditorCore

public class MainWindow: NSObject, WKScriptMessageHandler {
    public let window: NSWindow
    public let webView: WKWebView
    public var isPipeMode = false

    public override init() {
        // Calculate window frame: centered, 720x520
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let windowWidth: CGFloat = Helpers.WindowConfig.defaultWidth
        let windowHeight: CGFloat = Helpers.WindowConfig.defaultHeight
        let windowFrame = NSRect(
            x: screenFrame.midX - windowWidth / 2,
            y: screenFrame.midY - windowHeight / 2 + Helpers.WindowConfig.verticalOffset,
            width: windowWidth,
            height: windowHeight
        )

        // Configure window
        window = NSWindow(
            contentRect: windowFrame,
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.level = .floating
        window.backgroundColor = .clear
        window.hasShadow = true
        window.minSize = NSSize(width: Helpers.WindowConfig.minWidth, height: Helpers.WindowConfig.minHeight)
        window.hidesOnDeactivate = true

        // Configure WKWebView
        let config = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        config.userContentController = userContentController
        
        // Enable developer tools and preferences
        config.preferences.javaScriptEnabled = true
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false

        super.init()

        // Add message handler for JS bridge
        userContentController.add(self, name: "promptEditor")

        let container = NSView(frame: .zero)
        container.translatesAutoresizingMaskIntoConstraints = false
        window.contentView = container
        container.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor),
        ])

        // Load editor HTML
        loadEditor()
    }

    public func loadEditor() {
        // Try to load bundled HTML first
        if let htmlPath = Bundle.main.path(forResource: "editor", ofType: "html") {
            let htmlURL = URL(fileURLWithPath: htmlPath)
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        } else {
            // Development: load from editor/dist or editor dev server
            let devPath = findEditorHTML()
            if let path = devPath {
                let url = URL(fileURLWithPath: path)
                webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
            } else {
                // Fallback: try dev server
                let url = URL(string: "http://localhost:5173")!
                webView.load(URLRequest(url: url))
            }
        }
    }

    private func findEditorHTML() -> String? {
        let candidates = [
            "../editor/dist/index.html",
            "../../editor/dist/index.html",
        ]
        let fm = FileManager.default
        for candidate in candidates {
            let path = (fm.currentDirectoryPath as NSString).appendingPathComponent(candidate)
            let resolved = (path as NSString).standardizingPath
            if fm.fileExists(atPath: resolved) {
                return resolved
            }
        }
        return nil
    }

    public func focusEditor() {
        webView.evaluateJavaScript("window.promptEditor?.focus()")
    }

    public func getContent(completion: @escaping (String) -> Void) {
        webView.evaluateJavaScript("window.promptEditor?.getContent() || ''") { result, _ in
            completion(result as? String ?? "")
        }
    }

    public func setContent(_ text: String) {
        webView.evaluateJavaScript(Helpers.buildSetContentJS(text))
    }

    // MARK: - WKScriptMessageHandler

    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let action = Helpers.parseBridgeMessage(message.body) else { return }

        let delegate = NSApp.delegate as! AppDelegate

        switch action {
        case .send(let content, let target):
            if isPipeMode {
                delegate.pipeOutput(content)
            } else {
                delegate.sendContent(content, target: target)
            }
        case .copy(let content):
            // Copy to clipboard without sending
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(content, forType: .string)
        case .hide:
            delegate.hideWindow()
        case .showHistory:
            // TODO: show history panel
            break
        case .scanDirectory(let path, let callback):
            handleScanDirectory(path: path, callback: callback)
        case .showFolderPicker(let callback):
            handleShowFolderPicker(callback: callback)
        case .readFile(let path, let callback):
            handleReadFile(path: path, callback: callback)
        case .unknown:
            break
        }
    }
    
    // MARK: - File Reference Handlers
    
    private func handleScanDirectory(path: String, callback: String) {
        // Import the Rust core library
        guard let result = pe_scan_directory(path) else {
            callJS("window['\(callback)'](null, 'Scan failed')")
            return
        }
        
        let filesJSON = String(cString: result)
        pe_free_string(result)
        
        // Escape for JavaScript
        let escaped = Helpers.escapeForJS(filesJSON)
        callJS("window['\(callback)']('\(escaped)')")
    }
    
    private func handleShowFolderPicker(callback: String) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select a folder to scan"
        
        panel.beginSheetModal(for: window) { [weak self] result in
            if result == .OK, let url = panel.url {
                let path = Helpers.escapeForJS(url.path)
                self?.callJS("window['\(callback)']('\(path)')")
            } else {
                self?.callJS("window['\(callback)'](null)")
            }
        }
    }
    
    private func handleReadFile(path: String, callback: String) {
        guard let result = pe_read_file(path) else {
            callJS("window['\(callback)'](null, 'Read failed')")
            return
        }
        
        let content = String(cString: result)
        pe_free_string(result)
        
        let escaped = Helpers.escapeForJS(content)
        callJS("window['\(callback)']('\(escaped)')")
    }
    
    private func callJS(_ script: String) {
        webView.evaluateJavaScript(script) { _, error in
            if let error = error {
                print("JS Error: \(error)")
            }
        }
    }
}
