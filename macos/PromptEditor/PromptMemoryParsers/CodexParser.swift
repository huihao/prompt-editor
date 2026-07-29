import Foundation

public final class CodexParser: PromptMemoryParser {
    public let agent: PromptMemoryAgent = .codex
    private let commands: Set<String> = ["/help", "/clear", "/compact", "/exit"]

    public init() {}

    public func parse(directory: PromptMemoryDirectory) async -> [PromptMemoryItem] {
        let root = URL(fileURLWithPath: directory.path)
        var items = parseHistoryFile(root.appendingPathComponent("history.jsonl"), directory: directory)
        let sessions = root.appendingPathComponent("sessions")
        let sessionFiles = PromptMemoryJSON.recursiveFiles(root: sessions) { $0.pathExtension == "jsonl" }
        for file in sessionFiles {
            items.append(contentsOf: parseSessionFile(file, directory: directory))
        }
        return PromptMemoryDeduper.deduplicate(items)
    }

    private func parseHistoryFile(_ file: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        PromptMemoryJSON.objects(in: file).compactMap { record in
            makeItem(
                rawContent: record["text"] as? String,
                timestamp: PromptMemoryJSON.parseDate(record["ts"] ?? record["timestamp"]),
                projectDirectory: record["cwd"] as? String,
                directory: directory
            )
        }
    }

    private func parseSessionFile(_ file: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        PromptMemoryJSON.objects(in: file).compactMap { record in
            let payload = record["payload"] as? [String: Any]
            let role = payload?["role"] as? String ?? record["role"] as? String
            guard role == "user" else { return nil }
            return makeItem(
                rawContent: PromptMemoryJSON.textContent(from: payload?["content"] ?? record["content"]),
                timestamp: PromptMemoryJSON.parseDate(record["ts"] ?? record["timestamp"]),
                projectDirectory: record["cwd"] as? String,
                directory: directory
            )
        }
    }

    private func makeItem(
        rawContent: String?,
        timestamp: Date?,
        projectDirectory: String?,
        directory: PromptMemoryDirectory
    ) -> PromptMemoryItem? {
        guard let rawContent,
              let content = PromptMemoryNormalizer.normalize(rawContent),
              !PromptMemoryAutoContextFilter.isAutoInjectedContext(content),
              !PromptMemoryFilters.isControlCommand(content, knownCommands: commands)
        else { return nil }

        return PromptMemoryItem(
            id: PromptMemoryNormalizer.stableId(for: content),
            content: content,
            timestamp: timestamp,
            agents: [agent],
            sourceDirectories: [directory.path],
            projectDirectory: projectDirectory
        )
    }
}
