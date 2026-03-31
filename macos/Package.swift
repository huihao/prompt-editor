// swift-tools-version: 5.6
import PackageDescription

let package = Package(
    name: "PromptEditor",
    platforms: [.macOS(.v12)],
    targets: [
        .systemLibrary(
            name: "PromptEditorCore",
            path: "Libraries",
            pkgConfig: nil
        ),
        .target(
            name: "PromptEditorLib",
            dependencies: ["PromptEditorCore"],
            path: "PromptEditor",
            exclude: ["Info.plist", "main.swift", "BridgingHeader.h"],
            sources: ["Helpers.swift", "MainWindow.swift", "StatusBarItem.swift", "AppDelegate.swift", "TerminalSender.swift", "AgentDetector.swift"],
            swiftSettings: [
                .unsafeFlags(["-I", "Libraries"]),
            ],
            linkerSettings: [
                .unsafeFlags([
                    "-L", "Libraries",
                    "-lprompt_editor_core",
                ]),
            ]
        ),
        .executableTarget(
            name: "PromptEditor",
            dependencies: ["PromptEditorLib"],
            path: "PromptEditor",
            exclude: ["Info.plist", "Helpers.swift", "MainWindow.swift", "StatusBarItem.swift", "AppDelegate.swift", "TerminalSender.swift", "AgentDetector.swift"],
            sources: ["main.swift"]
        ),
        .testTarget(
            name: "PromptEditorTests",
            dependencies: ["PromptEditorLib"],
            path: "Tests"
        ),
    ]
)
