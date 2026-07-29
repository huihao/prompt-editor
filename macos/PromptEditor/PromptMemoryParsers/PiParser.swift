import Foundation

public final class PiParser: PromptMemoryParser {
    public let agent: PromptMemoryAgent = .pi
    private let commands: Set<String> = ["/help", "/clear", "/compact", "/exit"]

    public init() {}

    public func parse(directory: PromptMemoryDirectory) async -> [PromptMemoryItem] {
        let root = URL(fileURLWithPath: directory.path).appendingPathComponent("sessions")
        let files = PromptMemoryJSON.recursiveFiles(root: root) { $0.pathExtension == "jsonl" }
        let items = files.flatMap { parse(file: $0, directory: directory) }
        return PromptMemoryDeduper.deduplicate(items)
    }

    private func parse(file: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        PromptMemoryJSON.objects(in: file).compactMap { record in
            let message = record["message"] as? [String: Any]
            guard (message?["role"] as? String) == "user" else { return nil }
            guard let content = PromptMemoryNormalizer.normalize(
                PromptMemoryJSON.textContent(from: message?["content"]) ?? ""
            ),
                !PromptMemoryFilters.isControlCommand(content, knownCommands: commands)
            else { return nil }

            return PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: PromptMemoryJSON.parseDate(message?["timestamp"] ?? record["timestamp"]),
                agents: [agent],
                sourceDirectories: [directory.path],
                projectDirectory: record["cwd"] as? String
            )
        }
    }
}
