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
