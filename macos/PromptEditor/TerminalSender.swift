import Cocoa

/// Identifies the type of terminal application from its bundle identifier.
public enum TerminalTarget {
    case iterm2
    case terminalApp
    case warp
    case kitty
    case alacritty
    case genericTerminal
    case nonTerminal

    public static func from(bundleIdentifier: String?) -> TerminalTarget {
        guard let id = bundleIdentifier else { return .nonTerminal }
        switch id {
        case "com.googlecode.iterm2":       return .iterm2
        case "com.apple.Terminal":           return .terminalApp
        case "dev.warp.Warp-Stable":        return .warp
        case "net.kovidgoyal.kitty":         return .kitty
        case "org.alacritty":               return .alacritty
        default:
            // Heuristic: apps with "terminal" or "term" in their bundle ID
            let lower = id.lowercased()
            if lower.contains("terminal") || lower.contains("term") {
                return .genericTerminal
            }
            return .nonTerminal
        }
    }

    public var isTerminal: Bool {
        self != .nonTerminal
    }
}

/// Detects whether a tmux session is active and accessible.
public enum TmuxDetector {
    /// Check if tmux is running and has an active pane.
    /// Runs with a timeout to avoid blocking.
    public static func hasActiveTmux() -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["tmux", "display-message", "-p", "#{pane_id}"]
        process.standardOutput = Pipe()
        process.standardError = Pipe()

        do {
            try process.run()
        } catch {
            return false
        }

        // Wait with timeout
        let deadline = DispatchTime.now() + Helpers.TerminalConfig.tmuxDetectTimeout
        let group = DispatchGroup()
        group.enter()
        DispatchQueue.global().async {
            process.waitUntilExit()
            group.leave()
        }

        let result = group.wait(timeout: deadline)
        if result == .timedOut {
            process.terminate()
            return false
        }

        return process.terminationStatus == 0
    }
}

/// CLI Target types
public enum CLITarget: String {
    case `default` = "default"
    case claude = "claude"
    case codex = "codex"
    case kimi = "kimi"
    case cursor = "cursor"
    
    /// Returns the CLI command prefix if needed
    var commandPrefix: String? {
        switch self {
        case .claude: return nil  // Uses tmux or direct paste
        case .codex:  return nil
        case .kimi:   return nil
        case .cursor: return nil
        case .default: return nil
        }
    }
}

/// Sends prompt content to terminals with strategy-based dispatch.
public enum TerminalSender {

    /// Send content to the previously active application.
    /// Detects terminal type and tmux, then dispatches to the optimal strategy.
    public static func send(content: String, to app: NSRunningApplication?, completion: (() -> Void)? = nil) {
        send(content: content, to: app, target: .default, completion: completion)
    }
    
    /// Send content to a specific CLI target (claude, codex, kimi, cursor).
    /// For CLI targets, content is sent directly to the terminal where the CLI is running.
    public static func send(content: String, to app: NSRunningApplication?, target: CLITarget, completion: (() -> Void)? = nil) {
        let terminalTarget = TerminalTarget.from(bundleIdentifier: app?.bundleIdentifier)
        
        NSLog("PromptEditor: Sending to target '\(target)' via app '\(app?.bundleIdentifier ?? "unknown")'")

        // For CLI targets (kimi, codex, claude, cursor), we prepare content
        // to ensure it works correctly with these interactive CLI tools
        let finalContent: String
        switch target {
        case .claude, .codex, .kimi, .cursor:
            // These CLIs run in terminal and handle multiline input
            // We keep content as-is, the terminal/CLI handles the rest
            finalContent = content
        case .default:
            finalContent = content
        }

        // Only try tmux if the target is a terminal
        if terminalTarget.isTerminal && TmuxDetector.hasActiveTmux() {
            NSLog("PromptEditor: Using tmux send-keys")
            sendViaTmux(content: finalContent, completion: completion)
            return
        }

        switch terminalTarget {
        case .iterm2:
            NSLog("PromptEditor: Using iTerm2 AppleScript")
            sendViaITerm2(content: finalContent, to: app, completion: completion)
        case .terminalApp:
            NSLog("PromptEditor: Using Terminal.app AppleScript")
            sendViaTerminalApp(content: finalContent, to: app, completion: completion)
        case .warp, .kitty, .alacritty, .genericTerminal:
            NSLog("PromptEditor: Using generic terminal paste")
            sendViaGenericTerminal(content: finalContent, to: app, completion: completion)
        case .nonTerminal:
            NSLog("PromptEditor: Using clipboard paste for non-terminal")
            sendViaPaste(content: finalContent, to: app, completion: completion)
        }
    }

    // MARK: - Strategies

    /// tmux send-keys: no clipboard pollution, auto-enter.
    private static func sendViaTmux(content: String, completion: (() -> Void)?) {
        DispatchQueue.global().async {
            // Send content literally (-l flag handles special characters)
            let sendContent = Process()
            sendContent.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            sendContent.arguments = ["tmux", "send-keys", "-l", content]
            sendContent.standardOutput = Pipe()
            sendContent.standardError = Pipe()
            try? sendContent.run()
            sendContent.waitUntilExit()

            // Send Enter
            let sendEnter = Process()
            sendEnter.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            sendEnter.arguments = ["tmux", "send-keys", "Enter"]
            sendEnter.standardOutput = Pipe()
            sendEnter.standardError = Pipe()
            try? sendEnter.run()
            sendEnter.waitUntilExit()

            DispatchQueue.main.async {
                completion?()
            }
        }
    }

    /// iTerm2: AppleScript `write text` — no clipboard pollution, auto-enter.
    private static func sendViaITerm2(content: String, to app: NSRunningApplication?, completion: (() -> Void)?) {
        let escaped = Helpers.escapeForAppleScript(content)
        let source = """
            tell application "iTerm2"
                tell current session of current window
                    write text "\(escaped)"
                end tell
            end tell
        """
        runAppleScript(source)
        activateApp(app)
        completion?()
    }

    /// Terminal.app: AppleScript `do script` — no clipboard pollution, auto-enter.
    private static func sendViaTerminalApp(content: String, to app: NSRunningApplication?, completion: (() -> Void)?) {
        let escaped = Helpers.escapeForAppleScript(content)
        let source = """
            tell application "Terminal"
                do script "\(escaped)" in front window
            end tell
        """
        runAppleScript(source)
        activateApp(app)
        completion?()
    }

    /// Generic terminal: Cmd+V paste then Enter with delay.
    private static func sendViaGenericTerminal(content: String, to app: NSRunningApplication?, completion: (() -> Void)?) {
        // Copy to clipboard first
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(content, forType: .string)

        // Activate target app first, then wait for it to become frontmost
        activateApp(app)

        // Wait longer for app activation to complete, then paste
        DispatchQueue.main.asyncAfter(deadline: .now() + Helpers.WindowConfig.activateDelay) {
            // Ensure the target app is actually frontmost before sending keystrokes
            if let targetApp = app, !targetApp.isActive {
                targetApp.activate(options: .activateIgnoringOtherApps)
            }
            
            // Small additional delay to ensure activation completes
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                simulateKeystroke("v", withCommand: true)

                // Send Enter after a short delay to ensure paste completes
                DispatchQueue.main.asyncAfter(deadline: .now() + Helpers.TerminalConfig.postPasteEnterDelay) {
                    simulateKeystroke("\r", withCommand: false)
                    completion?()
                }
            }
        }
    }

    /// Non-terminal: Cmd+V paste only, no Enter.
    private static func sendViaPaste(content: String, to app: NSRunningApplication?, completion: (() -> Void)?) {
        // Copy to clipboard
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(content, forType: .string)

        // Activate target app
        activateApp(app)

        // Wait for activation to complete
        DispatchQueue.main.asyncAfter(deadline: .now() + Helpers.WindowConfig.activateDelay) {
            // Ensure the target app is actually frontmost
            if let targetApp = app, !targetApp.isActive {
                targetApp.activate(options: .activateIgnoringOtherApps)
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                simulateKeystroke("v", withCommand: true)
                completion?()
            }
        }
    }

    // MARK: - Helpers

    private static func activateApp(_ app: NSRunningApplication?) {
        app?.activate(options: .activateIgnoringOtherApps)
    }

    private static func runAppleScript(_ source: String) {
        let script = NSAppleScript(source: source)
        var error: NSDictionary?
        script?.executeAndReturnError(&error)
        if let error = error {
            NSLog("TerminalSender AppleScript error: \(error)")
        }
    }

    private static func simulateKeystroke(_ key: String, withCommand: Bool) {
        let modifier = withCommand ? "using command down" : ""
        let source = """
            tell application "System Events"
                keystroke "\(key)" \(modifier)
            end tell
        """
        runAppleScript(source)
    }
}
