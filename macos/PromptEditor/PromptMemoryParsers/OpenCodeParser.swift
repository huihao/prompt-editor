import Foundation
import SQLite3

public final class OpenCodeParser: PromptMemoryParser {
    public let agent: PromptMemoryAgent = .openCode
    private let commands: Set<String> = ["/help", "/clear", "/compact", "/exit"]

    public init() {}

    public func parse(directory: PromptMemoryDirectory) async -> [PromptMemoryItem] {
        let root = URL(fileURLWithPath: directory.path)
        let historyFile = root.appendingPathComponent("prompt-history.jsonl")
        if FileManager.default.fileExists(atPath: historyFile.path) {
            return PromptMemoryDeduper.deduplicate(parsePromptHistory(file: historyFile, directory: directory))
        }
        return PromptMemoryDeduper.deduplicate(parseDatabase(root: root, directory: directory))
    }

    private func parsePromptHistory(file: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        PromptMemoryJSON.objects(in: file).compactMap { record in
            guard let raw = record["input"] as? String,
                  let content = PromptMemoryNormalizer.normalize(raw),
                  !PromptMemoryAutoContextFilter.isAutoInjectedContext(content),
                  !PromptMemoryFilters.isControlCommand(content, knownCommands: commands)
            else { return nil }

            return PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: PromptMemoryJSON.parseDate(record["time_created"] ?? record["createdAt"] ?? record["timestamp"]),
                agents: [agent],
                sourceDirectories: [directory.path],
                projectDirectory: record["directory"] as? String
            )
        }
    }

    private func parseDatabase(root: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        let dbURL = root.appendingPathComponent("opencode.db")
        guard FileManager.default.fileExists(atPath: dbURL.path) else { return [] }

        var db: OpaquePointer?
        guard sqlite3_open_v2(dbURL.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else {
            return []
        }
        defer { sqlite3_close(db) }

        let query = "SELECT prompt, time_created FROM session_input ORDER BY time_created DESC LIMIT 100000"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else {
            return []
        }
        defer { sqlite3_finalize(statement) }

        var items: [PromptMemoryItem] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            guard let cString = sqlite3_column_text(statement, 0),
                  let content = PromptMemoryNormalizer.normalize(String(cString: cString)),
                  !PromptMemoryAutoContextFilter.isAutoInjectedContext(content),
                  !PromptMemoryFilters.isControlCommand(content, knownCommands: commands)
            else { continue }

            let seconds = sqlite3_column_double(statement, 1)
            items.append(PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: seconds > 0 ? Date(timeIntervalSince1970: seconds) : nil,
                agents: [agent],
                sourceDirectories: [directory.path],
                projectDirectory: nil
            ))
        }
        return items
    }
}
