import Foundation

/// Pure helper functions extracted for testability.
public enum Helpers {
    /// Escape a string for safe injection into a JavaScript single-quoted string literal.
    public static func escapeForJS(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")
    }

    /// Parse a JS bridge message body dictionary into a typed action.
    public enum BridgeAction: Equatable {
        case send(content: String, target: String, agentId: String?, pid: Int32?, terminalApp: String?)
        case copy(content: String)
        case pasteToPrevious(content: String, callback: String?)
        case openAccessibilitySettings
        case restartApp
        case hide
        case showHistory
        case scanDirectory(path: String, callback: String)
        case showFolderPicker(callback: String)
        case readFile(path: String, callback: String)
        case getRunningAgents(callback: String)
        case detectPromptMemoryDirectories(callback: String)
        case choosePromptMemoryDirectory(callback: String)
        case startPromptMemoryScan(scanId: String, directories: [PromptMemoryDirectory])
        case cancelPromptMemoryScan(scanId: String)
        case showSnippetWheel
        case captureTerminal(maxLines: Int, callback: String)
        case installShellIntegration(callback: String)
        case uninstallShellIntegration(callback: String)
        case getShellIntegrationStatus(callback: String)
        case unknown(String)
    }

    public static func parseBridgeMessage(_ body: Any) -> BridgeAction? {
        guard let dict = body as? [String: Any],
              let action = dict["action"] as? String
        else { return nil }

        switch action {
        case "send":
            guard let content = dict["content"] as? String else { return nil }
            let target = dict["target"] as? String ?? "default"
            let agentId = dict["agentId"] as? String
            let pid = dict["pid"] as? Int32
            let terminalApp = dict["terminalApp"] as? String
            return .send(content: content, target: target, agentId: agentId, pid: pid, terminalApp: terminalApp)
        case "copy":
            guard let content = dict["content"] as? String else { return nil }
            return .copy(content: content)
        case "pasteToPrevious":
            guard let content = dict["content"] as? String else { return nil }
            return .pasteToPrevious(content: content, callback: dict["callback"] as? String)
        case "openAccessibilitySettings":
            return .openAccessibilitySettings
        case "restartApp":
            return .restartApp
        case "hide":
            return .hide
        case "showHistory":
            return .showHistory
        case "scanDirectory":
            guard let path = dict["path"] as? String else { return nil }
            let callback = dict["callback"] as? String ?? ""
            return .scanDirectory(path: path, callback: callback)
        case "showFolderPicker":
            let callback = dict["callback"] as? String ?? ""
            return .showFolderPicker(callback: callback)
        case "readFile":
            guard let path = dict["path"] as? String else { return nil }
            let callback = dict["callback"] as? String ?? ""
            return .readFile(path: path, callback: callback)
        case "getRunningAgents":
            let callback = dict["callback"] as? String ?? ""
            return .getRunningAgents(callback: callback)
        case "detectPromptMemoryDirectories":
            let callback = dict["callback"] as? String ?? ""
            return .detectPromptMemoryDirectories(callback: callback)
        case "choosePromptMemoryDirectory":
            let callback = dict["callback"] as? String ?? ""
            return .choosePromptMemoryDirectory(callback: callback)
        case "startPromptMemoryScan":
            guard let scanId = dict["scanId"] as? String,
                  let directoryObjects = dict["directories"] as? [[String: Any]],
                  let data = try? JSONSerialization.data(withJSONObject: directoryObjects),
                  let directories = try? JSONDecoder.promptMemory.decode([PromptMemoryDirectory].self, from: data)
            else { return nil }
            return .startPromptMemoryScan(scanId: scanId, directories: directories)
        case "cancelPromptMemoryScan":
            guard let scanId = dict["scanId"] as? String else { return nil }
            return .cancelPromptMemoryScan(scanId: scanId)
        case "showSnippetWheel":
            return .showSnippetWheel
        case "captureTerminal":
            let maxLines = dict["maxLines"] as? Int ?? 500
            let callback = dict["callback"] as? String ?? ""
            return .captureTerminal(maxLines: maxLines, callback: callback)
        case "installShellIntegration":
            let callback = dict["callback"] as? String ?? ""
            return .installShellIntegration(callback: callback)
        case "uninstallShellIntegration":
            let callback = dict["callback"] as? String ?? ""
            return .uninstallShellIntegration(callback: callback)
        case "getShellIntegrationStatus":
            let callback = dict["callback"] as? String ?? ""
            return .getShellIntegrationStatus(callback: callback)
        default:
            return .unknown(action)
        }
    }

    /// Detect whether the process was launched in pipe mode.
    public static func isPipeMode(arguments: [String] = CommandLine.arguments) -> Bool {
        arguments.contains("--pipe")
    }

    /// Build the JavaScript call to set editor content.
    public static func buildSetContentJS(_ text: String) -> String {
        let escaped = escapeForJS(text)
        return "window.promptEditor?.setContent('\(escaped)')"
    }

    /// Build a callback invocation for an asynchronous native bridge result.
    public static func buildNativeResultJS(requestId: String, success: Bool, message: String) -> String {
        let values: [Any] = [requestId, success, message]
        let json = (try? JSONSerialization.data(withJSONObject: values))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\",false,\"Unknown native result\"]"
        return "window.promptEditorNativeResult?.apply(null, \(json))"
    }

    /// Build the JavaScript callback used to update the macOS permission banner.
    public static func buildAccessibilityPermissionStatusJS(trusted: Bool, requiresRestart: Bool) -> String {
        "window.promptEditorPermissionStatus?.(\(trusted), \(requiresRestart))"
    }

    public static func shouldAutoOpenAccessibilitySettings(isTrusted: Bool, hasOpened: Bool) -> Bool {
        !isTrusted && !hasOpened
    }

    public static func shouldRequestAccessibilityConsent(isTrusted: Bool, consentPrompted: Bool) -> Bool {
        !isTrusted && !consentPrompted
    }

    /// Escape a string for safe injection into an AppleScript double-quoted string literal.
    public static func escapeForAppleScript(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }

    /// Terminal send configuration constants.
    public enum TerminalConfig {
        /// Timeout for detecting an active tmux session.
        public static let tmuxDetectTimeout: TimeInterval = 0.5
        /// Delay between paste and Enter keystroke for generic terminals.
        public static let postPasteEnterDelay: TimeInterval = 0.1
    }

    /// Window configuration constants.
    public enum WindowConfig {
        public static let defaultWidth: CGFloat = 720
        public static let defaultHeight: CGFloat = 520
        public static let minWidth: CGFloat = 400
        public static let minHeight: CGFloat = 300
        public static let verticalOffset: CGFloat = 80
        public static let showAnimationDuration: TimeInterval = 0.2
        public static let hideAnimationDuration: TimeInterval = 0.15
        public static let slideOffset: CGFloat = 20
        public static let pasteDelay: TimeInterval = 0.5
        public static let activateDelay: TimeInterval = 0.3
    }

    /// Menu item titles for the status bar menu.
    public enum MenuTitles {
        public static let toggle = "Toggle Editor"
        public static let quit = "Quit Prompt Editor"
    }
}
