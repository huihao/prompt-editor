import Foundation

/// Pure helper functions extracted for testability.
public enum Helpers {
    /// Escape a string for safe injection into a JavaScript single-quoted string literal.
    public static func escapeForJS(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")
    }

    /// Parse a JS bridge message body dictionary into a typed action.
    public enum BridgeAction: Equatable {
        case send(content: String, target: String)
        case copy(content: String)
        case hide
        case showHistory
        case scanDirectory(path: String, callback: String)
        case showFolderPicker(callback: String)
        case readFile(path: String, callback: String)
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
            return .send(content: content, target: target)
        case "copy":
            guard let content = dict["content"] as? String else { return nil }
            return .copy(content: content)
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
