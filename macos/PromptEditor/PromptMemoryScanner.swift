import Foundation

public final class PromptMemoryScanner {
    private let homeDirectory: URL
    private let parsers: [PromptMemoryAgent: PromptMemoryParser]

    public init(homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.homeDirectory = homeDirectory
        self.parsers = [
            .claudeCode: ClaudeCodeParser(),
            .codex: CodexParser(),
            .openCode: OpenCodeParser(),
            .pi: PiParser(),
            .kimi: KimiParser(),
        ]
    }

    public func detectDefaultDirectories() -> [PromptMemoryDirectory] {
        [
            (.claudeCode, ".claude"),
            (.codex, ".codex"),
            (.openCode, ".local/state/opencode"),
            (.openCode, ".local/share/opencode"),
            (.pi, ".pi/agent"),
            (.kimi, ".kimi"),
        ].map { agent, relativePath in
            let url = homeDirectory.appendingPathComponent(relativePath)
            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey])
            return PromptMemoryDirectory(
                id: "\(agent.rawValue):\(url.path)",
                agent: agent,
                path: url.path,
                isDetected: true,
                exists: FileManager.default.fileExists(atPath: url.path),
                modifiedAt: values?.contentModificationDate
            )
        }
    }

    public func scanForTests(directories: [PromptMemoryDirectory]) async -> [PromptMemoryItem] {
        var items: [PromptMemoryItem] = []
        for directory in directories where directory.exists {
            guard let parser = parsers[directory.agent] else { continue }
            items.append(contentsOf: await parser.parse(directory: directory))
        }
        return PromptMemoryDeduper.deduplicate(items)
    }
}
