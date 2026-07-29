import CryptoKit
import Foundation

public protocol PromptMemoryParser {
    var agent: PromptMemoryAgent { get }
    func parse(directory: PromptMemoryDirectory) async -> [PromptMemoryItem]
}

public enum PromptMemoryNormalizer {
    public static func normalize(_ content: String) -> String? {
        let normalized = content
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    public static func stableId(for content: String) -> String {
        let digest = SHA256.hash(data: Data(content.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

public enum PromptMemoryFilters {
    public static func isControlCommand(_ content: String, knownCommands: Set<String>) -> Bool {
        guard let normalized = PromptMemoryNormalizer.normalize(content) else {
            return true
        }
        if normalized.hasPrefix("!") {
            return false
        }
        for command in knownCommands where normalized == command || normalized.hasPrefix(command + " ") {
            return true
        }
        return false
    }
}

public enum PromptMemoryDeduper {
    public static func deduplicate(_ items: [PromptMemoryItem]) -> [PromptMemoryItem] {
        var grouped: [String: [PromptMemoryItem]] = [:]
        for item in items {
            guard let normalized = PromptMemoryNormalizer.normalize(item.content) else { continue }
            grouped[normalized, default: []].append(item)
        }

        return grouped.map { content, group in
            let latest = group.max {
                ($0.timestamp ?? .distantPast) < ($1.timestamp ?? .distantPast)
            }!
            let agents = Array(Set(group.flatMap(\.agents))).sorted { $0.rawValue < $1.rawValue }
            let sourceDirectories = Array(Set(group.flatMap(\.sourceDirectories))).sorted()
            return PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: latest.timestamp,
                agents: agents,
                sourceDirectories: sourceDirectories,
                projectDirectory: latest.projectDirectory
            )
        }
        .sorted {
            switch ($0.timestamp, $1.timestamp) {
            case let (lhs?, rhs?):
                return lhs > rhs
            case (_?, nil):
                return true
            case (nil, _?):
                return false
            case (nil, nil):
                return $0.id < $1.id
            }
        }
    }
}

public enum PromptMemoryJSON {
    public static func objects(in file: URL) -> [[String: Any]] {
        guard let handle = try? FileHandle(forReadingFrom: file) else { return [] }
        defer { try? handle.close() }
        guard let data = try? handle.readToEnd(),
              let text = String(data: data, encoding: .utf8)
        else { return [] }

        return text.split(separator: "\n").compactMap { line in
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return nil }
            return object
        }
    }

    public static func recursiveFiles(root: URL, matching predicate: (URL) -> Bool) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else { return [] }

        return enumerator.compactMap { item in
            guard let url = item as? URL else { return nil }
            return predicate(url) ? url : nil
        }
    }

    public static func parseDate(_ raw: Any?) -> Date? {
        if let text = raw as? String {
            return ISO8601DateFormatter().date(from: text)
        }
        if let seconds = raw as? TimeInterval {
            return Date(timeIntervalSince1970: seconds)
        }
        if let intSeconds = raw as? Int {
            return Date(timeIntervalSince1970: TimeInterval(intSeconds))
        }
        return nil
    }

    public static func textContent(from value: Any?) -> String? {
        if let string = value as? String {
            return string
        }
        if let blocks = value as? [[String: Any]] {
            let parts = blocks.compactMap { block -> String? in
                guard (block["type"] as? String) == "text" else { return nil }
                return block["text"] as? String
            }
            return parts.isEmpty ? nil : parts.joined(separator: "\n")
        }
        return nil
    }
}

public enum PromptMemoryAutoContextFilter {
    public static func isAutoInjectedContext(_ content: String) -> Bool {
        guard let normalized = PromptMemoryNormalizer.normalize(content) else {
            return true
        }
        return normalized.hasPrefix("<environment_context>") ||
            normalized.hasPrefix("<permissions>") ||
            normalized.hasPrefix("<collaboration_mode>") ||
            normalized.hasPrefix("<skills_instructions>")
    }
}
