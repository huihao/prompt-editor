import Foundation

public final class PromptMemoryScanner {
    private let homeDirectory: URL
    private let parsers: [PromptMemoryAgent: PromptMemoryParser]
    private var runningTasks: [String: Task<Void, Never>] = [:]

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

    public func start(
        scanId: String,
        directories: [PromptMemoryDirectory],
        progress: @escaping (PromptMemoryProgress) -> Void,
        batch: @escaping ([PromptMemoryItem]) -> Void,
        completed: @escaping ([PromptMemoryItem]) -> Void,
        failed: @escaping (String) -> Void
    ) {
        cancel(scanId: scanId)
        let parsers = parsers
        runningTasks[scanId] = Task(priority: .utility) {
            defer {
                DispatchQueue.main.async { [weak self] in
                    self?.runningTasks[scanId] = nil
                }
            }
            var allItems: [PromptMemoryItem] = []
            for directory in directories {
                if Task.isCancelled { return }
                guard directory.exists else {
                    progress(PromptMemoryProgress(
                        scanId: scanId,
                        directoryId: directory.id,
                        status: .skipped,
                        filesRead: 0,
                        extracted: 0,
                        skipped: 0,
                        error: nil
                    ))
                    continue
                }
                guard let parser = parsers[directory.agent] else {
                    progress(PromptMemoryProgress(
                        scanId: scanId,
                        directoryId: directory.id,
                        status: .failed,
                        filesRead: 0,
                        extracted: 0,
                        skipped: 0,
                        error: "Unsupported agent"
                    ))
                    continue
                }

                progress(PromptMemoryProgress(
                    scanId: scanId,
                    directoryId: directory.id,
                    status: .scanning,
                    filesRead: 0,
                    extracted: 0,
                    skipped: 0,
                    error: nil
                ))
                let items = await parser.parse(directory: directory)
                if Task.isCancelled { return }
                let dedupedBatch = PromptMemoryDeduper.deduplicate(items)
                allItems.append(contentsOf: dedupedBatch)
                batch(dedupedBatch)
                progress(PromptMemoryProgress(
                    scanId: scanId,
                    directoryId: directory.id,
                    status: .completed,
                    filesRead: 0,
                    extracted: dedupedBatch.count,
                    skipped: 0,
                    error: nil
                ))
            }
            completed(PromptMemoryDeduper.deduplicate(allItems))
        }
    }

    public func cancel(scanId: String) {
        runningTasks[scanId]?.cancel()
        runningTasks[scanId] = nil
    }
}
