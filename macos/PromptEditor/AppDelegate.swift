import Cocoa
import Carbon
import WebKit
import ApplicationServices

public class AppDelegate: NSObject, NSApplicationDelegate {
    public var statusBarItem: StatusBarItem!
    public var mainWindow: MainWindow!
    public var hotKeyRef: EventHotKeyRef?
    public var previousApp: NSRunningApplication?
    private var accessibilitySettingsOpened = false
    private var accessibilityConsentPrompted = false

    public func applicationDidFinishLaunching(_ notification: Notification) {
        // Check for --pipe mode
        if Helpers.isPipeMode() {
            runPipeMode()
            return
        }

        // Show in Dock
        NSApp.setActivationPolicy(.regular)
        
        // Setup minimal main menu for edit commands to work in WebView
        setupMainMenu()

        // Setup status bar
        statusBarItem = StatusBarItem(delegate: self)

        // Setup main window
        mainWindow = MainWindow()

        // Register global hotkey: Cmd+Shift+P
        registerGlobalHotkey()

        // Show window on first launch
        toggleWindow()

        // Give the WebView time to load, then guide first-time users to the required permission.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            guard let self else { return }
            guard Helpers.shouldAutoOpenAccessibilitySettings(
                isTrusted: AXIsProcessTrusted(),
                hasOpened: self.accessibilitySettingsOpened
            ) else { return }
            self.requestAccessibilityConsent()
        }
    }
    
    private func setupMainMenu() {
        let mainMenu = NSMenu()
        
        // App menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "Quit", action: #selector(quitApp), keyEquivalent: "q")
        
        // Edit menu - required for copy/paste to work in WebView
        let editMenuItem = NSMenuItem()
        editMenuItem.title = "Edit"
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu()
        editMenu.title = "Edit"
        editMenuItem.submenu = editMenu
        
        editMenu.addItem(withTitle: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        
        NSApp.mainMenu = mainMenu
    }

    public func applicationWillTerminate(_ notification: Notification) {
        unregisterGlobalHotkey()
    }

    public func applicationDidBecomeActive(_ notification: Notification) {
        guard accessibilitySettingsOpened else { return }
        notifyAccessibilityPermission(requiresRestart: true)
    }

    // MARK: - Global Hotkey

    public func registerGlobalHotkey() {
        var hotKeyID = EventHotKeyID()
        hotKeyID.signature = OSType(0x5045_4B59) // "PEKY"
        hotKeyID.id = 1

        var eventType = EventTypeSpec()
        eventType.eventClass = OSType(kEventClassKeyboard)
        eventType.eventKind = UInt32(kEventHotKeyPressed)

        InstallEventHandler(
            GetApplicationEventTarget(),
            { (_, event, _) -> OSStatus in
                let delegate = NSApp.delegate as! AppDelegate
                DispatchQueue.main.async {
                    delegate.toggleWindow()
                }
                return noErr
            },
            1,
            &eventType,
            nil,
            nil
        )

        // Cmd+Shift+P: keycode 35 = P
        let modifiers: UInt32 = UInt32(cmdKey | shiftKey)
        RegisterEventHotKey(
            UInt32(kVK_ANSI_P),
            modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    public func unregisterGlobalHotkey() {
        if let ref_ = hotKeyRef {
            UnregisterEventHotKey(ref_)
        }
    }

    // MARK: - Window Toggle

    public func toggleWindow() {
        if mainWindow.window.isVisible {
            hideWindow()
        } else {
            showWindow()
        }
    }

    public func showWindow() {
        // Remember the previously focused app
        if let frontmostApp = NSWorkspace.shared.frontmostApplication,
           frontmostApp != NSRunningApplication.current {
            previousApp = frontmostApp
        }

        mainWindow.window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // Animate slide down
        let frame = mainWindow.window.frame
        let startFrame = NSRect(
            x: frame.origin.x,
            y: frame.origin.y + Helpers.WindowConfig.slideOffset,
            width: frame.width,
            height: frame.height
        )
        mainWindow.window.setFrame(startFrame, display: false)
        mainWindow.window.alphaValue = 0

        NSAnimationContext.runAnimationGroup { context in
            context.duration = Helpers.WindowConfig.showAnimationDuration
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            self.mainWindow.window.animator().setFrame(frame, display: true)
            self.mainWindow.window.animator().alphaValue = 1
        }

        mainWindow.focusEditor()
    }

    public func hideWindow() {
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = Helpers.WindowConfig.hideAnimationDuration
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            self.mainWindow.window.animator().alphaValue = 0
        }, completionHandler: {
            self.mainWindow.window.orderOut(nil)
            self.mainWindow.window.alphaValue = 1
        })
    }

    // MARK: - Send Content

    public func sendContent(_ content: String, target: String = "default", agent: DetectedAgent? = nil) {
        // Hide window first
        hideWindow()
        
        // Parse CLI target
        let cliTarget = CLITarget(rawValue: target) ?? .default
        
        NSLog("PromptEditor: Sending content to target '\(target)', agent: \(agent?.id ?? "none")")

        // Send to terminal after a short delay
        // The delay allows the window to hide and focus to return to the target app
        DispatchQueue.main.asyncAfter(deadline: .now() + Helpers.WindowConfig.pasteDelay) {
            // If we have specific agent info with terminal app, use that
            if let agent = agent, let terminalApp = agent.terminalApp {
                NSLog("PromptEditor: Looking for terminal app: \(terminalApp)")
                if let specificApp = self.findRunningApplication(named: terminalApp) {
                    NSLog("PromptEditor: Found terminal app, activating and sending")
                    specificApp.activate(options: .activateIgnoringOtherApps)
                    // Add small delay after activation
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        TerminalSender.send(content: content, to: specificApp, target: cliTarget)
                    }
                    return
                } else {
                    NSLog("PromptEditor: Could not find terminal app '\(terminalApp)', falling back to previous app")
                }
            }
            
            // Fall back to previous app
            guard let targetApp = self.previousApp else {
                NSLog("PromptEditor: No previous app to send to")
                return
            }
            
            NSLog("PromptEditor: Sending to previous app: \(targetApp.bundleIdentifier ?? "unknown")")
            TerminalSender.send(content: content, to: targetApp, target: cliTarget)
        }
    }

    public func pasteToPrevious(_ content: String, callback: String? = nil) {
        guard let targetApp = previousApp else {
            NSLog("PromptEditor: No previous app available for paste")
            if let callback {
                mainWindow.sendNativeResult(requestId: callback, success: false, message: "没有可用的上次位置")
            }
            return
        }

        hideWindow()
        DispatchQueue.main.asyncAfter(deadline: .now() + Helpers.WindowConfig.pasteDelay) {
            TerminalSender.pasteOnly(content: content, to: targetApp) { success in
                guard let callback else { return }
                let message = success
                    ? "已粘贴到上次位置"
                    : "粘贴失败，请检查 macOS 辅助功能权限"
                self.mainWindow.sendNativeResult(requestId: callback, success: success, message: message)
            }
        }
    }

    public func notifyAccessibilityPermission(requiresRestart: Bool) {
        guard mainWindow != nil else { return }
        mainWindow.updateAccessibilityPermission(
            trusted: AXIsProcessTrusted(),
            requiresRestart: requiresRestart
        )
    }

    public func openAccessibilitySettings() {
        accessibilitySettingsOpened = true
        let settingsURL = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
        NSWorkspace.shared.open(settingsURL)
    }

    private func requestAccessibilityConsent() {
        guard Helpers.shouldRequestAccessibilityConsent(
            isTrusted: AXIsProcessTrusted(),
            consentPrompted: accessibilityConsentPrompted
        ) else { return }

        accessibilityConsentPrompted = true
        let alert = NSAlert()
        alert.messageText = "Accessibility permission required"
        alert.informativeText = "Prompt Editor needs Accessibility permission to paste prompts into the previously focused app. Open macOS Security Settings now?"
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Open Security Settings")
        alert.addButton(withTitle: "Not Now")

        if alert.runModal() == .alertFirstButtonReturn {
            openAccessibilitySettings()
        }
    }

    public func restartApp() {
        guard let appURL = Bundle.main.bundleURL as URL? else { return }
        NSWorkspace.shared.openApplication(at: appURL, configuration: NSWorkspace.OpenConfiguration()) { _, error in
            if let error {
                NSLog("PromptEditor: Failed to restart app: \(error.localizedDescription)")
                return
            }
            DispatchQueue.main.async {
                NSApp.terminate(nil)
            }
        }
    }
    
    /// Find a running application by name
    private func findRunningApplication(named: String) -> NSRunningApplication? {
        let apps = NSWorkspace.shared.runningApplications
        let searchName = named.lowercased()
        
        for app in apps {
            let appName = app.localizedName?.lowercased() ?? ""
            let bundleId = app.bundleIdentifier?.lowercased() ?? ""
            
            // Check various matching patterns
            if appName.contains(searchName) || 
               bundleId.contains(searchName.replacingOccurrences(of: " ", with: "").lowercased()) ||
               bundleId.contains(searchName.replacingOccurrences(of: "-", with: "").lowercased()) {
                NSLog("PromptEditor: Found app '\(app.localizedName ?? "unknown")' with bundle ID '\(app.bundleIdentifier ?? "unknown")'")
                return app
            }
            
            // Special handling for common terminals
            switch searchName {
            case "iterm2":
                if bundleId.contains("iterm") || appName.contains("iterm") {
                    return app
                }
            case "terminal":
                if bundleId == "com.apple.terminal" || appName == "terminal" {
                    return app
                }
            case "warp":
                if bundleId.contains("warp") || appName.contains("warp") {
                    return app
                }
            case "kitty":
                if bundleId.contains("kitty") || appName.contains("kitty") {
                    return app
                }
            default:
                break
            }
        }
        return nil
    }

    // MARK: - Pipe Mode

    public func runPipeMode() {
        // Open window, wait for send, then output to stdout and exit
        NSApp.setActivationPolicy(.regular)

        mainWindow = MainWindow()
        mainWindow.isPipeMode = true
        mainWindow.window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        mainWindow.focusEditor()
    }

    public func pipeOutput(_ content: String) {
        FileHandle.standardOutput.write(content.data(using: .utf8)!)
        NSApp.terminate(nil)
    }

    // MARK: - Menu Actions

    @objc public func showPreferences() {
        // TODO: preferences window
    }

    @objc public func quitApp() {
        NSApp.terminate(nil)
    }
    
    // MARK: - Edit Actions for WebView
    
    @objc public func copy(_ sender: Any?) {
        // Let the WebView handle copy
        NSApp.sendAction(#selector(NSText.copy(_:)), to: nil, from: sender)
    }
    
    @objc public func cut(_ sender: Any?) {
        NSApp.sendAction(#selector(NSText.cut(_:)), to: nil, from: sender)
    }
    
    @objc public func paste(_ sender: Any?) {
        NSApp.sendAction(#selector(NSText.paste(_:)), to: nil, from: sender)
    }
    
    @objc public func selectAll(_ sender: Any?) {
        NSApp.sendAction(#selector(NSText.selectAll(_:)), to: nil, from: sender)
    }
}
