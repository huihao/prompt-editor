import Cocoa
import WebKit
import PromptEditorCore

public class MainWindow: NSObject, WKScriptMessageHandler, NSWindowDelegate, WKNavigationDelegate {
    public let window: NSWindow
    public let webView: WKWebView
    public var isPipeMode = false
    private var snippetWheelWindow: SnippetWheelWindow?
    private var captureServer: TerminalCaptureServer?
    private var terminalContext = TerminalContext.empty
    private let promptMemoryScanner = PromptMemoryScanner()

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
        
        // Use persistent data store for localStorage to work properly with file URLs
        config.websiteDataStore = WKWebsiteDataStore.default()
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false

        super.init()

        // Set window delegate for focus management
        window.delegate = self
        webView.navigationDelegate = self

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
        
        // Start terminal capture server
        startCaptureServer()
    }
    
    deinit {
        captureServer?.stop()
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

    // MARK: - NSWindowDelegate

    public func windowDidBecomeKey(_ notification: Notification) {
        // Ensure WKWebView becomes first responder when window is activated
        // This fixes input issues in regular HTML input elements inside WKWebView
        window.makeFirstResponder(webView)
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

        switch action {
        case .send(let content, let target, let agentId, let pid, let terminalApp):
            guard let delegate = NSApp.delegate as? AppDelegate else { return }
            NSLog("[MainWindow] Received send action - target: \(target), agentId: \(agentId ?? "nil"), pid: \(pid ?? 0), terminalApp: \(terminalApp ?? "nil")")
            if isPipeMode {
                delegate.pipeOutput(content)
            } else {
                // Create agent info for precise targeting
                let agentInfo: DetectedAgent? = (agentId != nil) ? DetectedAgent(
                    id: agentId!,
                    name: target,
                    type: DetectedAgent.AgentType(rawValue: target) ?? .unknown,
                    pid: pid ?? 0,
                    terminalApp: terminalApp,
                    windowTitle: nil,
                    workingDirectory: nil
                ) : nil
                NSLog("[MainWindow] Calling sendContent with agentInfo: \(agentInfo != nil ? "present" : "nil")")
                delegate.sendContent(content, target: target, agent: agentInfo)
            }
        case .copy(let content):
            // Copy to clipboard without sending
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(content, forType: .string)
        case .pasteToPrevious(let content, let callback):
            guard let delegate = NSApp.delegate as? AppDelegate else { return }
            delegate.pasteToPrevious(content, callback: callback)
        case .openAccessibilitySettings:
            guard let delegate = NSApp.delegate as? AppDelegate else { return }
            delegate.openAccessibilitySettings()
        case .resetAccessibilityPermission:
            guard let delegate = NSApp.delegate as? AppDelegate else { return }
            delegate.resetAccessibilityPermission()
        case .restartApp:
            guard let delegate = NSApp.delegate as? AppDelegate else { return }
            delegate.restartApp()
        case .hide:
            guard let delegate = NSApp.delegate as? AppDelegate else { return }
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
        case .saveFile(let filename, let content, let callback):
            handleSaveFile(filename: filename, content: content, callback: callback)
        case .getRunningAgents(let callback):
            handleGetRunningAgents(callback: callback)
        case .detectPromptMemoryDirectories(let callback):
            handleDetectPromptMemoryDirectories(callback: callback)
        case .choosePromptMemoryDirectory(let callback):
            handleChoosePromptMemoryDirectory(callback: callback)
        case .startPromptMemoryScan(let scanId, let directories):
            handleStartPromptMemoryScan(scanId: scanId, directories: directories)
        case .cancelPromptMemoryScan(let scanId):
            promptMemoryScanner.cancel(scanId: scanId)
        case .showSnippetWheel:
            handleShowSnippetWheel()
        case .captureTerminal(let maxLines, let callback):
            handleCaptureTerminal(maxLines: maxLines, callback: callback)
        case .installShellIntegration(let callback):
            handleInstallShellIntegration(callback: callback)
        case .uninstallShellIntegration(let callback):
            handleUninstallShellIntegration(callback: callback)
        case .getShellIntegrationStatus(let callback):
            handleGetShellIntegrationStatus(callback: callback)
        case .unknown:
            break
        }
    }

    public func sendNativeResult(requestId: String, success: Bool, message: String) {
        webView.evaluateJavaScript(Helpers.buildNativeResultJS(
            requestId: requestId,
            success: success,
            message: message
        ))
    }

    public func updateAccessibilityPermission(trusted: Bool, requiresRestart: Bool) {
        webView.evaluateJavaScript(Helpers.buildAccessibilityPermissionStatusJS(
            trusted: trusted,
            requiresRestart: requiresRestart
        ))
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        (NSApp.delegate as? AppDelegate)?.notifyAccessibilityPermission(requiresRestart: false)
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
    
    private func handleSaveFile(filename: String, content: String, callback: String) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = filename
        panel.message = "Choose where to save the exported file"
        
        panel.beginSheetModal(for: window) { [weak self] result in
            guard result == .OK, let url = panel.url else {
                self?.callJS("window['\(callback)'](null)")
                return
            }
            do {
                try content.write(to: url, atomically: true, encoding: .utf8)
                self?.callJS("window['\(callback)']('true')")
            } catch {
                let message = Helpers.escapeForJS(error.localizedDescription)
                self?.callJS("window['\(callback)'](null, '\(message)')")
            }
        }
    }
    
    private func handleGetRunningAgents(callback: String) {
        print("[MainWindow] handleGetRunningAgents called with callback: \(callback)")
        // Run detection asynchronously to avoid blocking main thread
        Task {
            print("[MainWindow] Starting agent detection...")
            let agents = await AgentDetector.detectRunningAgents()
            print("[MainWindow] Detected \(agents.count) agents")
            
            await MainActor.run {
                if let json = AgentDetector.toJSON(agents) {
                    print("[MainWindow] JSON encoded, length: \(json.count)")
                    let escaped = Helpers.escapeForJS(json)
                    self.callJS("window['\(callback)']('\(escaped)')")
                } else {
                    print("[MainWindow] Failed to encode agents to JSON")
                    self.callJS("window['\(callback)'](null, 'Failed to encode agents')")
                }
            }
        }
    }
    
    private func callJS(_ script: String) {
        webView.evaluateJavaScript(script) { _, error in
            if let error = error {
                print("JS Error: \(error)")
            }
        }
    }

    private func callJSFunction<T: Encodable>(_ name: String, argument: T) {
        guard !name.isEmpty,
              let data = try? JSONEncoder.promptMemory.encode(argument),
              let json = String(data: data, encoding: .utf8)
        else { return }
        callJS("window['\(Helpers.escapeForJS(name))']?.(\(json))")
    }

    // MARK: - Prompt Memory Handlers

    private func handleDetectPromptMemoryDirectories(callback: String) {
        callJSFunction(callback, argument: promptMemoryScanner.detectDefaultDirectories())
    }

    private func handleChoosePromptMemoryDirectory(callback: String) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select a prompt memory directory"

        panel.beginSheetModal(for: window) { [weak self] result in
            let path: String? = result == .OK ? panel.url?.path : nil
            self?.callJSFunction(callback, argument: path)
        }
    }

    private func handleStartPromptMemoryScan(scanId: String, directories: [PromptMemoryDirectory]) {
        promptMemoryScanner.start(
            scanId: scanId,
            directories: directories,
            progress: { [weak self] progress in
                DispatchQueue.main.async { [weak self] in
                    self?.callJSFunction("onPromptMemoryScanProgress", argument: progress)
                }
            },
            batch: { [weak self] items in
                DispatchQueue.main.async { [weak self] in
                    self?.callJSFunction("onPromptMemoryScanBatch", argument: PromptMemoryItemBatch(scanId: scanId, items: items))
                }
            },
            completed: { [weak self] items in
                DispatchQueue.main.async { [weak self] in
                    self?.callJSFunction("onPromptMemoryScanCompleted", argument: PromptMemoryItemBatch(scanId: scanId, items: items))
                }
            },
            failed: { [weak self] message in
                DispatchQueue.main.async { [weak self] in
                    self?.callJSFunction("onPromptMemoryScanFailed", argument: PromptMemoryFailure(scanId: scanId, error: message))
                }
            }
        )
    }
    
    // MARK: - Terminal Capture
    
    private func startCaptureServer() {
        captureServer = TerminalCaptureServer()
        captureServer?.start { [weak self] message in
            self?.handleCaptureMessage(message)
        }
        NSLog("[MainWindow] Terminal capture server started")
    }
    
    private func handleCaptureMessage(_ message: TerminalCaptureMessage) {
        switch message {
        case .output(let content):
            terminalContext.recentOutput = content
            terminalContext.lastUpdated = Date()
            notifyTerminalContextUpdated()
            
        case .cwd(let path):
            terminalContext.currentDirectory = path
            terminalContext.lastUpdated = Date()
            notifyTerminalContextUpdated()
            
        case .command(let cmd):
            terminalContext.lastCommand = cmd
            terminalContext.lastExitCode = nil
            notifyTerminalContextUpdated()
            
        case .commandFinished(let cmd, let exitCode, let output):
            terminalContext.lastCommand = cmd
            terminalContext.lastExitCode = exitCode
            terminalContext.recentOutput = output
            terminalContext.lastUpdated = Date()
            notifyTerminalContextUpdated()
            
        case .size, .unknown:
            break
        }
    }
    
    private func notifyTerminalContextUpdated() {
        guard let json = terminalContext.toJSON() else { return }
        let escaped = Helpers.escapeForJS(json)
        callJS("window.terminalContext?.onUpdate('\(escaped)')")
    }
    
    private func handleCaptureTerminal(maxLines: Int, callback: String) {
        // Try immediate capture methods (tmux or shell hooks)
        Task { [weak self] in
            guard let self = self else { return }
            
            // 1. Try tmux capture-pane first
            let captured: TerminalContext
            if TmuxDetector.hasActiveTmux() {
                captured = await self.captureViaTmux(maxLines: maxLines)
            } else {
                captured = TerminalContext.empty
            }
            
            // 2. Fall back to accumulated context from shell hooks
            let result: TerminalContext
            if captured.recentOutput == nil || captured.recentOutput?.isEmpty == true {
                result = self.terminalContext
            } else {
                result = captured
            }
            
            await MainActor.run {
                if let json = result.toJSON() {
                    let escaped = Helpers.escapeForJS(json)
                    self.callJS("window['\(callback)']('\(escaped)')")
                } else {
                    self.callJS("window['\(callback)'](null, 'Failed to encode context')")
                }
            }
        }
    }
    
    private func captureViaTmux(maxLines: Int) async -> TerminalContext {
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .utility).async {
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
                process.arguments = ["tmux", "capture-pane", "-p", "-S", "-\(maxLines)"]
                
                let pipe = Pipe()
                process.standardOutput = pipe
                process.standardError = Pipe()
                
                do {
                    try process.run()
                    process.waitUntilExit()
                    
                    let data = pipe.fileHandleForReading.readDataToEndOfFile()
                    let output = String(data: data, encoding: .utf8) ?? ""
                    
                    // Get current working directory from tmux
                    let cwdProcess = Process()
                    cwdProcess.executableURL = URL(fileURLWithPath: "/usr/bin/env")
                    cwdProcess.arguments = ["tmux", "display-message", "-p", "#{pane_current_path}"]
                    let cwdPipe = Pipe()
                    cwdProcess.standardOutput = cwdPipe
                    try? cwdProcess.run()
                    cwdProcess.waitUntilExit()
                    let cwdData = cwdPipe.fileHandleForReading.readDataToEndOfFile()
                    let cwd = String(data: cwdData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
                    
                    let context = TerminalContext(
                        currentDirectory: cwd,
                        recentOutput: output,
                        lastUpdated: Date()
                    )
                    continuation.resume(returning: context)
                } catch {
                    continuation.resume(returning: TerminalContext.empty)
                }
            }
        }
    }
    
    // MARK: - Shell Integration Management
    
    private func handleInstallShellIntegration(callback: String) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let results = ShellIntegrationScripts.installAll()
            let success = results.allSatisfy { $0.success }
            let messages = results.map { "\($0.shell.displayName): \($0.message)" }.joined(separator: "\\n")
            
            DispatchQueue.main.async {
                let escapedMsg = Helpers.escapeForJS(messages)
                self?.callJS("window['\(callback)'](\(success), '\(escapedMsg)')")
            }
        }
    }
    
    private func handleUninstallShellIntegration(callback: String) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let results = ShellIntegrationScripts.uninstallAll()
            let success = results.allSatisfy { $0.success }
            let messages = results.map { "\($0.shell.displayName): \($0.message)" }.joined(separator: "\\n")
            
            DispatchQueue.main.async {
                let escapedMsg = Helpers.escapeForJS(messages)
                self?.callJS("window['\(callback)'](\(success), '\(escapedMsg)')")
            }
        }
    }
    
    private func handleGetShellIntegrationStatus(callback: String) {
        let status: [String: Bool] = [
            "zsh": ShellIntegrationScripts.isInstalled(for: .zsh),
            "bash": ShellIntegrationScripts.isInstalled(for: .bash),
            "fish": ShellIntegrationScripts.isInstalled(for: .fish),
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: status),
           let json = String(data: jsonData, encoding: .utf8) {
            let escaped = Helpers.escapeForJS(json)
            callJS("window['\(callback)']('\(escaped)')")
        } else {
            callJS("window['\(callback)'](null)")
        }
    }
    
    // MARK: - Snippet Wheel
    
    private func handleShowSnippetWheel() {
        // Create wheel window if needed
        if snippetWheelWindow == nil {
            snippetWheelWindow = SnippetWheelWindow()
            
            snippetWheelWindow?.onSnippetSelected = { [weak self] content in
                // Insert the snippet content into the editor
                self?.setContent(content)
                self?.focusEditor()
            }
            
            snippetWheelWindow?.onClose = { [weak self] in
                // Return focus to main window
                self?.window.makeKeyAndOrderFront(nil)
                self?.focusEditor()
            }
            
            snippetWheelWindow?.onManage = { [weak self] in
                // Return focus to main window and open snippet manager
                self?.window.makeKeyAndOrderFront(nil)
                // Call JavaScript to open snippet manager
                self?.webView.evaluateJavaScript("window.snippetManagerUI?.open() || console.log('snippetManagerUI not available')")
            }
        }
        
        // Load snippet data from WebView (includes user custom data from localStorage)
        webView.evaluateJavaScript("window.snippetManager?.exportData() || '{\"version\":\"1.0\",\"categories\":[]}'") { [weak self] result, error in
            let json = (result as? String) ?? snippetManager.toJSON()
            self?.webView.evaluateJavaScript("window.promptEditor?.getLocale?.() || 'en'") { locale, _ in
                DispatchQueue.main.async {
                    self?.snippetWheelWindow?.injectLocale(locale as? String ?? "en")
                    self?.snippetWheelWindow?.injectSnippetData(json)
                    self?.snippetWheelWindow?.show()
                }
            }
        }
    }
}
