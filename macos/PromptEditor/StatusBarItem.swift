import Cocoa

public class StatusBarItem {
    public private(set) var statusItem: NSStatusItem
    private weak var delegate: AppDelegate?

    public init(delegate: AppDelegate) {
        self.delegate = delegate

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        if let button = statusItem.button {
            button.image = NSImage(
                systemSymbolName: "text.cursor",
                accessibilityDescription: "Prompt Editor"
            )
            button.action = #selector(toggleWindow(_:))
            button.target = self
        }

        setupMenu()
    }

    private func setupMenu() {
        let menu = NSMenu()

        let toggleItem = NSMenuItem(
            title: Helpers.MenuTitles.toggle,
            action: #selector(toggleWindow(_:)),
            keyEquivalent: ""
        )
        toggleItem.target = self
        menu.addItem(toggleItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(
            title: Helpers.MenuTitles.quit,
            action: #selector(quitApp(_:)),
            keyEquivalent: "q"
        )
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    @objc private func toggleWindow(_ sender: Any?) {
        delegate?.toggleWindow()
    }

    @objc private func quitApp(_ sender: Any?) {
        delegate?.quitApp()
    }
}
