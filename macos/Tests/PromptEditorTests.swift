import XCTest
import Cocoa
import WebKit
@testable import PromptEditorLib

// MARK: - Helpers Tests

final class HelpersTests: XCTestCase {

    // MARK: escapeForJS

    func testEscapeForJS_plainText() {
        XCTAssertEqual(Helpers.escapeForJS("hello world"), "hello world")
    }

    func testEscapeForJS_singleQuotes() {
        XCTAssertEqual(Helpers.escapeForJS("it's a test"), "it\\'s a test")
    }

    func testEscapeForJS_backslash() {
        XCTAssertEqual(Helpers.escapeForJS("path\\to\\file"), "path\\\\to\\\\file")
    }

    func testEscapeForJS_newlines() {
        XCTAssertEqual(Helpers.escapeForJS("line1\nline2"), "line1\\nline2")
    }

    func testEscapeForJS_carriageReturn() {
        XCTAssertEqual(Helpers.escapeForJS("line1\rline2"), "line1\\rline2")
    }

    func testEscapeForJS_tab() {
        XCTAssertEqual(Helpers.escapeForJS("col1\tcol2"), "col1\\tcol2")
    }

    func testEscapeForJS_combined() {
        let input = "He said 'hello'\nPath: C:\\Users\\"
        let expected = "He said \\'hello\\'\\nPath: C:\\\\Users\\\\"
        XCTAssertEqual(Helpers.escapeForJS(input), expected)
    }

    func testEscapeForJS_emptyString() {
        XCTAssertEqual(Helpers.escapeForJS(""), "")
    }

    func testEscapeForJS_unicode() {
        XCTAssertEqual(Helpers.escapeForJS("你好世界 🌍"), "你好世界 🌍")
    }

    func testEscapeForJS_markdownContent() {
        let md = "# Title\n\n- item 1\n- item 2\n\n```code```"
        let escaped = Helpers.escapeForJS(md)
        XCTAssertTrue(escaped.contains("\\n"))
        XCTAssertFalse(escaped.contains("\n"))
    }

    // MARK: buildSetContentJS

    func testBuildSetContentJS_simple() {
        let js = Helpers.buildSetContentJS("hello")
        XCTAssertEqual(js, "window.promptEditor?.setContent('hello')")
    }

    func testBuildSetContentJS_withSpecialChars() {
        let js = Helpers.buildSetContentJS("it's\nnew")
        XCTAssertEqual(js, "window.promptEditor?.setContent('it\\'s\\nnew')")
    }

    func testBuildSetContentJS_empty() {
        let js = Helpers.buildSetContentJS("")
        XCTAssertEqual(js, "window.promptEditor?.setContent('')")
    }

    // MARK: parseBridgeMessage

    func testParseBridgeMessage_send() {
        let body: [String: Any] = ["action": "send", "content": "hello world", "target": "default"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .send(content: "hello world", target: "default", agentId: nil, pid: nil, terminalApp: nil))
    }
    
    func testParseBridgeMessage_sendWithTarget() {
        let body: [String: Any] = ["action": "send", "content": "hello", "target": "kimi"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .send(content: "hello", target: "kimi", agentId: nil, pid: nil, terminalApp: nil))
    }

    func testParseBridgeMessage_sendEmpty() {
        let body: [String: Any] = ["action": "send", "content": "", "target": "default"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .send(content: "", target: "default", agentId: nil, pid: nil, terminalApp: nil))
    }

    func testParseBridgeMessage_sendMissingContent() {
        let body: [String: Any] = ["action": "send"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertNil(action)
    }

    func testParseBridgeMessage_hide() {
        let body: [String: Any] = ["action": "hide"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .hide)
    }

    func testParseBridgeMessage_pasteToPrevious() {
        let body: [String: Any] = ["action": "pasteToPrevious", "content": "paste here", "callback": "paste-1"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .pasteToPrevious(content: "paste here", callback: "paste-1"))
    }

    func testParseBridgeMessage_openAccessibilitySettings() {
        let body: [String: Any] = ["action": "openAccessibilitySettings"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .openAccessibilitySettings)
    }

    func testParseBridgeMessage_restartApp() {
        let body: [String: Any] = ["action": "restartApp"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .restartApp)
    }

    func testShouldAutoOpenAccessibilitySettings_onlyWhenUntrustedAndNotOpened() {
        XCTAssertTrue(Helpers.shouldAutoOpenAccessibilitySettings(isTrusted: false, hasOpened: false))
        XCTAssertFalse(Helpers.shouldAutoOpenAccessibilitySettings(isTrusted: true, hasOpened: false))
        XCTAssertFalse(Helpers.shouldAutoOpenAccessibilitySettings(isTrusted: false, hasOpened: true))
    }

    func testShouldRequestAccessibilityConsent_onlyOnceForUntrustedApp() {
        XCTAssertTrue(Helpers.shouldRequestAccessibilityConsent(isTrusted: false, consentPrompted: false))
        XCTAssertFalse(Helpers.shouldRequestAccessibilityConsent(isTrusted: true, consentPrompted: false))
        XCTAssertFalse(Helpers.shouldRequestAccessibilityConsent(isTrusted: false, consentPrompted: true))
    }

    func testParseBridgeMessage_showHistory() {
        let body: [String: Any] = ["action": "showHistory"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .showHistory)
    }

    func testParseBridgeMessage_detectPromptMemoryDirectories() {
        let body: [String: Any] = ["action": "detectPromptMemoryDirectories", "callback": "cb"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .detectPromptMemoryDirectories(callback: "cb"))
    }

    func testParseBridgeMessage_choosePromptMemoryDirectory() {
        let body: [String: Any] = ["action": "choosePromptMemoryDirectory", "callback": "cb"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .choosePromptMemoryDirectory(callback: "cb"))
    }

    func testParseBridgeMessage_startPromptMemoryScan() {
        let body: [String: Any] = [
            "action": "startPromptMemoryScan",
            "scanId": "scan-1",
            "directories": [
                ["id": "d", "agent": "codex", "path": "/tmp/codex", "isDetected": true, "exists": true]
            ],
        ]
        let action = Helpers.parseBridgeMessage(body)
        if case .startPromptMemoryScan(let scanId, let directories) = action {
            XCTAssertEqual(scanId, "scan-1")
            XCTAssertEqual(directories.count, 1)
            XCTAssertEqual(directories[0].agent, .codex)
        } else {
            XCTFail("Expected startPromptMemoryScan")
        }
    }

    func testParseBridgeMessage_cancelPromptMemoryScan() {
        let body: [String: Any] = ["action": "cancelPromptMemoryScan", "scanId": "scan-1"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .cancelPromptMemoryScan(scanId: "scan-1"))
    }

    func testParseBridgeMessage_unknown() {
        let body: [String: Any] = ["action": "doSomething"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .unknown("doSomething"))
    }

    func testParseBridgeMessage_invalidBody_string() {
        let action = Helpers.parseBridgeMessage("not a dict")
        XCTAssertNil(action)
    }

    func testParseBridgeMessage_invalidBody_number() {
        let action = Helpers.parseBridgeMessage(42)
        XCTAssertNil(action)
    }

    func testParseBridgeMessage_missingAction() {
        let body: [String: Any] = ["content": "test"]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertNil(action)
    }

    func testParseBridgeMessage_actionNotString() {
        let body: [String: Any] = ["action": 123]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertNil(action)
    }

    func testParseBridgeMessage_sendWithExtraFields() {
        let body: [String: Any] = ["action": "send", "content": "test", "target": "codex", "extra": true]
        let action = Helpers.parseBridgeMessage(body)
        XCTAssertEqual(action, .send(content: "test", target: "codex", agentId: nil, pid: nil, terminalApp: nil))
    }

    // MARK: isPipeMode

    func testIsPipeMode_withFlag() {
        XCTAssertTrue(Helpers.isPipeMode(arguments: ["app", "--pipe"]))
    }

    func testIsPipeMode_withoutFlag() {
        XCTAssertFalse(Helpers.isPipeMode(arguments: ["app"]))
    }

    func testIsPipeMode_emptyArgs() {
        XCTAssertFalse(Helpers.isPipeMode(arguments: []))
    }

    func testIsPipeMode_flagAmongOthers() {
        XCTAssertTrue(Helpers.isPipeMode(arguments: ["app", "--verbose", "--pipe", "--debug"]))
    }

    func testIsPipeMode_similarButNotExact() {
        XCTAssertFalse(Helpers.isPipeMode(arguments: ["app", "--piped"]))
        XCTAssertFalse(Helpers.isPipeMode(arguments: ["app", "pipe"]))
        XCTAssertFalse(Helpers.isPipeMode(arguments: ["app", "-pipe"]))
    }

    // MARK: WindowConfig Constants

    func testWindowConfig_defaultSize() {
        XCTAssertEqual(Helpers.WindowConfig.defaultWidth, 720)
        XCTAssertEqual(Helpers.WindowConfig.defaultHeight, 520)
    }

    func testWindowConfig_minSize() {
        XCTAssertEqual(Helpers.WindowConfig.minWidth, 400)
        XCTAssertEqual(Helpers.WindowConfig.minHeight, 300)
    }

    func testWindowConfig_minSmallerThanDefault() {
        XCTAssertLessThan(Helpers.WindowConfig.minWidth, Helpers.WindowConfig.defaultWidth)
        XCTAssertLessThan(Helpers.WindowConfig.minHeight, Helpers.WindowConfig.defaultHeight)
    }

    func testWindowConfig_animationDurations() {
        XCTAssertGreaterThan(Helpers.WindowConfig.showAnimationDuration, 0)
        XCTAssertGreaterThan(Helpers.WindowConfig.hideAnimationDuration, 0)
        XCTAssertLessThan(Helpers.WindowConfig.showAnimationDuration, 1.0)
        XCTAssertLessThan(Helpers.WindowConfig.hideAnimationDuration, 1.0)
    }

    func testWindowConfig_slideOffset() {
        XCTAssertGreaterThan(Helpers.WindowConfig.slideOffset, 0)
    }

    // MARK: MenuTitles

    func testMenuTitles() {
        XCTAssertEqual(Helpers.MenuTitles.toggle, "Toggle Editor")
        XCTAssertEqual(Helpers.MenuTitles.quit, "Quit Prompt Editor")
    }
}

// MARK: - MainWindow Tests

final class MainWindowTests: XCTestCase {

    var mainWindow: MainWindow!

    override func setUp() {
        super.setUp()
        mainWindow = MainWindow()
    }

    override func tearDown() {
        mainWindow.window.orderOut(nil)
        mainWindow = nil
        super.tearDown()
    }

    // MARK: Window Configuration

    func testWindowSize() {
        let frame = mainWindow.window.frame
        XCTAssertEqual(frame.width, Helpers.WindowConfig.defaultWidth)
        // macOS may adjust height slightly for titlebar; allow 2px tolerance
        XCTAssertEqual(frame.height, Helpers.WindowConfig.defaultHeight, accuracy: 2.0)
    }

    func testWindowMinSize() {
        let minSize = mainWindow.window.minSize
        XCTAssertEqual(minSize.width, Helpers.WindowConfig.minWidth)
        XCTAssertEqual(minSize.height, Helpers.WindowConfig.minHeight)
    }

    func testWindowLevel_isFloating() {
        XCTAssertEqual(mainWindow.window.level, .floating)
    }

    func testWindowTitlebar_isTransparent() {
        XCTAssertTrue(mainWindow.window.titlebarAppearsTransparent)
    }

    func testWindowTitleVisibility_isHidden() {
        XCTAssertEqual(mainWindow.window.titleVisibility, .hidden)
    }

    func testWindowIsMovableByBackground() {
        XCTAssertTrue(mainWindow.window.isMovableByWindowBackground)
    }

    func testWindowHasShadow() {
        XCTAssertTrue(mainWindow.window.hasShadow)
    }

    func testWindowStyleMask() {
        let mask = mainWindow.window.styleMask
        XCTAssertTrue(mask.contains(.titled))
        XCTAssertTrue(mask.contains(.closable))
        XCTAssertTrue(mask.contains(.resizable))
        XCTAssertTrue(mask.contains(.fullSizeContentView))
    }

    func testWindowBackgroundColor_isClear() {
        XCTAssertEqual(mainWindow.window.backgroundColor, .clear)
    }

    // MARK: WebView Configuration

    func testWebViewExists() {
        XCTAssertNotNil(mainWindow.webView)
    }

    func testWebViewIsSubviewOfContentView() {
        // WebView is now wrapped in a container, so it's a subview of contentView
        XCTAssertTrue(mainWindow.webView.superview === mainWindow.window.contentView)
    }

    func testWebViewIsSubviewOfWindow() {
        // When set as contentView, the webView is part of the window hierarchy
        XCTAssertNotNil(mainWindow.webView.superview)
    }

    // MARK: Pipe Mode

    func testIsPipeMode_defaultFalse() {
        XCTAssertFalse(mainWindow.isPipeMode)
    }

    func testIsPipeMode_canBeSet() {
        mainWindow.isPipeMode = true
        XCTAssertTrue(mainWindow.isPipeMode)
    }
}

// MARK: - StatusBarItem Tests

final class StatusBarItemTests: XCTestCase {

    var delegate: AppDelegate!
    var statusBarItem: StatusBarItem!

    override func setUp() {
        super.setUp()
        delegate = AppDelegate()
        delegate.mainWindow = MainWindow()
        statusBarItem = StatusBarItem(delegate: delegate)
    }

    override func tearDown() {
        delegate.mainWindow.window.orderOut(nil)
        statusBarItem = nil
        delegate = nil
        super.tearDown()
    }

    func testStatusItemExists() {
        XCTAssertNotNil(statusBarItem.statusItem)
    }

    func testStatusItemHasButton() {
        XCTAssertNotNil(statusBarItem.statusItem.button)
    }

    func testStatusItemHasMenu() {
        XCTAssertNotNil(statusBarItem.statusItem.menu)
    }

    func testMenuItemCount() {
        // Toggle, Separator, Quit = 3 items
        let menu = statusBarItem.statusItem.menu!
        XCTAssertEqual(menu.items.count, 3)
    }

    func testMenuToggleItem() {
        let menu = statusBarItem.statusItem.menu!
        let toggleItem = menu.items[0]
        XCTAssertEqual(toggleItem.title, Helpers.MenuTitles.toggle)
    }

    func testMenuSeparator() {
        let menu = statusBarItem.statusItem.menu!
        XCTAssertTrue(menu.items[1].isSeparatorItem)
    }

    func testMenuQuitItem() {
        let menu = statusBarItem.statusItem.menu!
        let quitItem = menu.items[2]
        XCTAssertEqual(quitItem.title, Helpers.MenuTitles.quit)
        XCTAssertEqual(quitItem.keyEquivalent, "q")
    }

    func testStatusButtonAccessibility() {
        let image = statusBarItem.statusItem.button?.image
        XCTAssertNotNil(image)
    }
}

// MARK: - AppDelegate Tests

final class AppDelegateTests: XCTestCase {

    func testAppDelegate_initialState() {
        let delegate = AppDelegate()
        XCTAssertNil(delegate.statusBarItem)
        XCTAssertNil(delegate.mainWindow)
        XCTAssertNil(delegate.hotKeyRef)
        XCTAssertNil(delegate.previousApp)
    }

    func testSendContent_copiesToClipboard() {
        let delegate = AppDelegate()
        delegate.mainWindow = MainWindow()

        let testContent = "Test prompt content \(UUID().uuidString)"

        // Use TerminalSender directly (nonTerminal path copies to clipboard synchronously)
        TerminalSender.send(content: testContent, to: nil)

        let pasteboard = NSPasteboard.general
        let pasteboardContent = pasteboard.string(forType: .string)
        XCTAssertEqual(pasteboardContent, testContent)

        delegate.mainWindow.window.orderOut(nil)
    }

    func testSendContent_multilineCopiesToClipboard() {
        let delegate = AppDelegate()
        delegate.mainWindow = MainWindow()

        let testContent = "# Prompt\n\nLine 1\nLine 2\n- bullet"

        TerminalSender.send(content: testContent, to: nil)

        let pasteboard = NSPasteboard.general
        let pasteboardContent = pasteboard.string(forType: .string)
        XCTAssertEqual(pasteboardContent, testContent)

        delegate.mainWindow.window.orderOut(nil)
    }

    func testSendContent_unicodeCopiesToClipboard() {
        let delegate = AppDelegate()
        delegate.mainWindow = MainWindow()

        let testContent = "你好世界 🌍 Ελληνικά العربية"

        TerminalSender.send(content: testContent, to: nil)

        let pasteboard = NSPasteboard.general
        XCTAssertEqual(pasteboard.string(forType: .string), testContent)

        delegate.mainWindow.window.orderOut(nil)
    }
}

// MARK: - BridgeAction Equatable Tests

final class BridgeActionTests: XCTestCase {

    func testEquatable_send() {
        XCTAssertEqual(
            Helpers.BridgeAction.send(content: "a", target: "default", agentId: nil, pid: nil, terminalApp: nil),
            Helpers.BridgeAction.send(content: "a", target: "default", agentId: nil, pid: nil, terminalApp: nil)
        )
        XCTAssertNotEqual(
            Helpers.BridgeAction.send(content: "a", target: "default", agentId: nil, pid: nil, terminalApp: nil),
            Helpers.BridgeAction.send(content: "b", target: "default", agentId: nil, pid: nil, terminalApp: nil)
        )
        XCTAssertNotEqual(
            Helpers.BridgeAction.send(content: "a", target: "default", agentId: nil, pid: nil, terminalApp: nil),
            Helpers.BridgeAction.send(content: "a", target: "kimi", agentId: nil, pid: nil, terminalApp: nil)
        )
    }

    func testEquatable_hide() {
        XCTAssertEqual(Helpers.BridgeAction.hide, Helpers.BridgeAction.hide)
    }

    func testEquatable_differentTypes() {
        XCTAssertNotEqual(Helpers.BridgeAction.hide, Helpers.BridgeAction.showHistory)
        XCTAssertNotEqual(
            Helpers.BridgeAction.send(content: "hide", target: "default", agentId: nil, pid: nil, terminalApp: nil),
            Helpers.BridgeAction.hide
        )
    }

    func testEquatable_unknown() {
        XCTAssertEqual(
            Helpers.BridgeAction.unknown("x"),
            Helpers.BridgeAction.unknown("x")
        )
        XCTAssertNotEqual(
            Helpers.BridgeAction.unknown("x"),
            Helpers.BridgeAction.unknown("y")
        )
    }
}

// MARK: - Integration Tests

final class IntegrationTests: XCTestCase {

    func testFullBridgeFlow_sendAction() {
        // Simulate: JS sends message → parse → clipboard
        let jsMessage: [String: Any] = [
            "action": "send",
            "content": "# Hello\n\nThis is a **prompt**.",
            "target": "claude"
        ]

        // Parse
        guard let action = Helpers.parseBridgeMessage(jsMessage) else {
            XCTFail("Failed to parse bridge message")
            return
        }
        XCTAssertEqual(action, .send(content: "# Hello\n\nThis is a **prompt**.", target: "claude", agentId: nil, pid: nil, terminalApp: nil))

        // Simulate clipboard copy
        if case .send(let content, let target, let agentId, let pid, let terminalApp) = action {
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(content, forType: .string)

            XCTAssertEqual(pasteboard.string(forType: .string), "# Hello\n\nThis is a **prompt**.")
            XCTAssertEqual(target, "claude")
            XCTAssertNil(agentId)
            XCTAssertNil(pid)
            XCTAssertNil(terminalApp)
        }
    }

    func testSetContentJS_roundTrip() {
        // Verify the JS string won't break with tricky content
        let trickyContent = "He said: 'it\\'s\\\\ a \\\"test\\\"'\nLine 2\r\n\tTabbed"
        let js = Helpers.buildSetContentJS(trickyContent)

        // The JS should be a valid-looking call
        XCTAssertTrue(js.hasPrefix("window.promptEditor?.setContent('"))
        XCTAssertTrue(js.hasSuffix("')"))

        // No unescaped single quotes inside
        let inner = String(js.dropFirst("window.promptEditor?.setContent('".count).dropLast(2))
        XCTAssertFalse(inner.contains("'") && !inner.contains("\\'"))
    }

    func testWindowCreation_performance() {
        measure {
            let win = MainWindow()
            win.window.orderOut(nil)
        }
    }
}

// MARK: - TerminalTarget Tests

final class TerminalTargetTests: XCTestCase {

    func testITerm2() {
        let target = TerminalTarget.from(bundleIdentifier: "com.googlecode.iterm2")
        XCTAssertEqual(target, .iterm2)
        XCTAssertTrue(target.isTerminal)
    }

    func testTerminalApp() {
        let target = TerminalTarget.from(bundleIdentifier: "com.apple.Terminal")
        XCTAssertEqual(target, .terminalApp)
        XCTAssertTrue(target.isTerminal)
    }

    func testWarp() {
        let target = TerminalTarget.from(bundleIdentifier: "dev.warp.Warp-Stable")
        XCTAssertEqual(target, .warp)
        XCTAssertTrue(target.isTerminal)
    }

    func testKitty() {
        let target = TerminalTarget.from(bundleIdentifier: "net.kovidgoyal.kitty")
        XCTAssertEqual(target, .kitty)
        XCTAssertTrue(target.isTerminal)
    }

    func testAlacritty() {
        let target = TerminalTarget.from(bundleIdentifier: "org.alacritty")
        XCTAssertEqual(target, .alacritty)
        XCTAssertTrue(target.isTerminal)
    }

    func testGenericTerminal_heuristic() {
        let target = TerminalTarget.from(bundleIdentifier: "com.example.MyTerminal")
        XCTAssertEqual(target, .genericTerminal)
        XCTAssertTrue(target.isTerminal)
    }

    func testNonTerminal() {
        let target = TerminalTarget.from(bundleIdentifier: "com.apple.Safari")
        XCTAssertEqual(target, .nonTerminal)
        XCTAssertFalse(target.isTerminal)
    }

    func testNilBundleId() {
        let target = TerminalTarget.from(bundleIdentifier: nil)
        XCTAssertEqual(target, .nonTerminal)
        XCTAssertFalse(target.isTerminal)
    }
}

// MARK: - escapeForAppleScript Tests

final class EscapeForAppleScriptTests: XCTestCase {

    func testPlainText() {
        XCTAssertEqual(Helpers.escapeForAppleScript("hello world"), "hello world")
    }

    func testDoubleQuotes() {
        XCTAssertEqual(Helpers.escapeForAppleScript("say \"hello\""), "say \\\"hello\\\"")
    }

    func testBackslash() {
        XCTAssertEqual(Helpers.escapeForAppleScript("path\\to\\file"), "path\\\\to\\\\file")
    }

    func testCombined() {
        let input = "He said \"hello\\world\""
        let expected = "He said \\\"hello\\\\world\\\""
        XCTAssertEqual(Helpers.escapeForAppleScript(input), expected)
    }

    func testEmpty() {
        XCTAssertEqual(Helpers.escapeForAppleScript(""), "")
    }

    func testNewlinesPreserved() {
        // AppleScript handles newlines in strings; we don't escape them
        XCTAssertEqual(Helpers.escapeForAppleScript("line1\nline2"), "line1\nline2")
    }
}

// MARK: - TerminalConfig Constants Tests

final class TerminalConfigTests: XCTestCase {

    func testTmuxDetectTimeout() {
        XCTAssertEqual(Helpers.TerminalConfig.tmuxDetectTimeout, 0.5)
    }

    func testPostPasteEnterDelay() {
        XCTAssertEqual(Helpers.TerminalConfig.postPasteEnterDelay, 0.1)
    }
}

// MARK: - Prompt Memory Core Tests

final class PromptMemoryCoreTests: XCTestCase {
    func testNormalizePromptMemoryContent() {
        XCTAssertEqual(PromptMemoryNormalizer.normalize("  a\r\n  b\r c  "), "a\n  b\n c")
        XCTAssertNil(PromptMemoryNormalizer.normalize(" \n\t "))
    }

    func testKnownControlCommandFiltering() {
        XCTAssertTrue(PromptMemoryFilters.isControlCommand("/help", knownCommands: ["/help"]))
        XCTAssertTrue(PromptMemoryFilters.isControlCommand("/help search", knownCommands: ["/help"]))
        XCTAssertFalse(PromptMemoryFilters.isControlCommand("/Users/me/project", knownCommands: ["/help"]))
        XCTAssertFalse(PromptMemoryFilters.isControlCommand("!ls -la", knownCommands: ["/help"]))
    }

    func testDeduplicatePromptMemoryItemsKeepsLatestAndMergesSources() {
        let old = PromptMemoryItem(
            id: "old",
            content: "build this",
            timestamp: Date(timeIntervalSince1970: 10),
            agents: [.codex],
            sourceDirectories: ["/tmp/codex"],
            projectDirectory: "/tmp/a"
        )
        let latest = PromptMemoryItem(
            id: "new",
            content: " build this ",
            timestamp: Date(timeIntervalSince1970: 20),
            agents: [.claudeCode],
            sourceDirectories: ["/tmp/claude"],
            projectDirectory: "/tmp/b"
        )
        let result = PromptMemoryDeduper.deduplicate([old, latest])
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].content, "build this")
        XCTAssertEqual(result[0].timestamp, Date(timeIntervalSince1970: 20))
        XCTAssertEqual(Set(result[0].agents), Set([.codex, .claudeCode]))
        XCTAssertEqual(Set(result[0].sourceDirectories), Set(["/tmp/codex", "/tmp/claude"]))
        XCTAssertEqual(result[0].projectDirectory, "/tmp/b")
    }
}

// MARK: - Prompt Memory JSONL Parser Tests

final class PromptMemoryJSONLParserTests: XCTestCase {
    func testCodexHistoryParserReadsUserTextAndFiltersInjectedContext() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"session_id":"s1","ts":"2026-07-29T01:02:03Z","text":"build a parser"}
        {"session_id":"s2","ts":"2026-07-29T01:02:04Z","text":"<environment_context>auto</environment_context>"}
        {"session_id":"s3","ts":"2026-07-29T01:02:05Z","text":"/help"}
        """, to: root.appendingPathComponent("history.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .codex, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await CodexParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["build a parser"])
        XCTAssertEqual(items[0].timestamp, ISO8601DateFormatter().date(from: "2026-07-29T01:02:03Z"))
    }

    func testClaudeParserReadsUserMessageBlocksOnly() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"type":"user","cwd":"/tmp/project","timestamp":"2026-07-29T02:00:00Z","message":{"role":"user","content":[{"type":"text","text":"fix the tests"}]}}
        {"type":"user","message":{"role":"user","content":"<environment_context>auto</environment_context>"}}
        {"type":"assistant","message":{"role":"assistant","content":"not a prompt"}}
        """, to: root.appendingPathComponent("projects/a/session.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .claudeCode, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await ClaudeCodeParser().parse(directory: directory)
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].content, "fix the tests")
        XCTAssertEqual(items[0].projectDirectory, "/tmp/project")
    }

    func testPiParserReadsUserMessageText() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"cwd":"/tmp/pi","message":{"role":"user","content":"ship it"},"timestamp":"2026-07-29T03:00:00Z"}
        {"message":{"role":"user","content":"<skills_instructions>auto</skills_instructions>"}}
        {"message":{"role":"assistant","content":"done"}}
        """, to: root.appendingPathComponent("sessions/one.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .pi, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await PiParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["ship it"])
    }

    func testKimiParserReadsUserHistoryContent() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"content":"review this diff","createdAt":"2026-07-29T04:00:00Z"}
        {"content":"<environment_context>auto</environment_context>","createdAt":"2026-07-29T04:00:30Z"}
        {"content":"/clear","createdAt":"2026-07-29T04:01:00Z"}
        """, to: root.appendingPathComponent("user-history/history.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .kimi, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await KimiParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["review this diff"])
    }
}

// MARK: - Prompt Memory Scanner Tests

final class PromptMemoryScannerTests: XCTestCase {
    func testOpenCodePromptHistoryParserReadsInput() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"input":"explain this error","time_created":1780000000}
        {"input":"<environment_context>auto</environment_context>","time_created":1780000000}
        {"input":"/help","time_created":1780000001}
        """, to: root.appendingPathComponent("prompt-history.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .openCode, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await OpenCodeParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["explain this error"])
    }

    func testScannerDeduplicatesAcrossParsers() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        let codex = root.appendingPathComponent("codex")
        let kimi = root.appendingPathComponent("kimi")
        try PromptMemoryFixtures.write("{\"text\":\"same prompt\",\"ts\":\"2026-07-29T01:00:00Z\"}\n", to: codex.appendingPathComponent("history.jsonl"))
        try PromptMemoryFixtures.write("{\"content\":\"same prompt\",\"createdAt\":\"2026-07-29T02:00:00Z\"}\n", to: kimi.appendingPathComponent("user-history/history.jsonl"))
        let scanner = PromptMemoryScanner(homeDirectory: root)
        let items = await scanner.scanForTests(directories: [
            PromptMemoryDirectory(id: "c", agent: .codex, path: codex.path, isDetected: true, exists: true, modifiedAt: nil),
            PromptMemoryDirectory(id: "k", agent: .kimi, path: kimi.path, isDetected: true, exists: true, modifiedAt: nil),
        ])
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(Set(items[0].agents), Set([.codex, .kimi]))
        XCTAssertEqual(items[0].timestamp, ISO8601DateFormatter().date(from: "2026-07-29T02:00:00Z"))
    }

    func testDetectedDirectoriesUseKnownAgentPaths() {
        let root = URL(fileURLWithPath: "/Users/tester")
        let scanner = PromptMemoryScanner(homeDirectory: root)
        let directories = scanner.detectDefaultDirectories()
        XCTAssertTrue(directories.contains { $0.agent == .claudeCode && $0.path == "/Users/tester/.claude" })
        XCTAssertTrue(directories.contains { $0.agent == .codex && $0.path == "/Users/tester/.codex" })
        XCTAssertTrue(directories.contains { $0.agent == .openCode && $0.path == "/Users/tester/.local/state/opencode" })
        XCTAssertTrue(directories.contains { $0.agent == .pi && $0.path == "/Users/tester/.pi/agent" })
        XCTAssertTrue(directories.contains { $0.agent == .kimi && $0.path == "/Users/tester/.kimi" })
    }
}
