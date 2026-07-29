import Foundation

public final class KimiParser: PromptMemoryParser {
    public let agent: PromptMemoryAgent = .kimi
    private let commands: Set<String> = ["/help", "/clear", "/compact", "/exit"]

    public init() {}

    public func parse(directory: PromptMemoryDirectory) async -> [PromptMemoryItem] {
        let root = URL(fileURLWithPath: directory.path).appendingPathComponent("user-history")
        let files = PromptMemoryJSON.recursiveFiles(root: root) { $0.pathExtension == "jsonl" }
        let items = files.flatMap { parse(file: $0, directory: directory) }
        return PromptMemoryDeduper.deduplicate(items)
    }

    private func parse(file: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        let fallbackTimestamp = (try? file.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
        return PromptMemoryJSON.objects(in: file).compactMap { record in
            guard let raw = record["content"] as? String,
                  let content = PromptMemoryNormalizer.normalize(raw),
                  !PromptMemoryFilters.isControlCommand(content, knownCommands: commands)
            else { return nil }

            return PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: PromptMemoryJSON.parseDate(record["createdAt"] ?? record["timestamp"]) ?? fallbackTimestamp,
                agents: [agent],
                sourceDirectories: [directory.path],
                projectDirectory: record["cwd"] as? String
            )
        }
    }
}
