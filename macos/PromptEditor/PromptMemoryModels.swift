import Foundation

public enum PromptMemoryAgent: String, Codable, CaseIterable, Hashable {
    case claudeCode
    case codex
    case openCode
    case pi
    case kimi

    public var displayName: String {
        switch self {
        case .claudeCode:
            return "Claude Code"
        case .codex:
            return "Codex"
        case .openCode:
            return "OpenCode"
        case .pi:
            return "Pi"
        case .kimi:
            return "Kimi"
        }
    }
}

public struct PromptMemoryDirectory: Codable, Identifiable, Equatable {
    public let id: String
    public let agent: PromptMemoryAgent
    public let path: String
    public let isDetected: Bool
    public let exists: Bool
    public let modifiedAt: Date?

    public init(
        id: String,
        agent: PromptMemoryAgent,
        path: String,
        isDetected: Bool,
        exists: Bool,
        modifiedAt: Date?
    ) {
        self.id = id
        self.agent = agent
        self.path = path
        self.isDetected = isDetected
        self.exists = exists
        self.modifiedAt = modifiedAt
    }
}

public struct PromptMemoryItem: Codable, Identifiable, Equatable {
    public let id: String
    public let content: String
    public let timestamp: Date?
    public let agents: [PromptMemoryAgent]
    public let sourceDirectories: [String]
    public let projectDirectory: String?

    public init(
        id: String,
        content: String,
        timestamp: Date?,
        agents: [PromptMemoryAgent],
        sourceDirectories: [String],
        projectDirectory: String?
    ) {
        self.id = id
        self.content = content
        self.timestamp = timestamp
        self.agents = agents
        self.sourceDirectories = sourceDirectories
        self.projectDirectory = projectDirectory
    }
}

public enum PromptMemoryScanStatus: String, Codable {
    case waiting
    case scanning
    case completed
    case skipped
    case failed
    case cancelled
}

public struct PromptMemoryProgress: Codable, Equatable {
    public let scanId: String
    public let directoryId: String
    public let status: PromptMemoryScanStatus
    public let filesRead: Int
    public let extracted: Int
    public let skipped: Int
    public let error: String?
}

public struct PromptMemoryScanRequest: Codable, Equatable {
    public let scanId: String
    public let directories: [PromptMemoryDirectory]
}

public struct PromptMemoryItemBatch: Codable, Equatable {
    public let scanId: String
    public let items: [PromptMemoryItem]
}

public struct PromptMemoryFailure: Codable, Equatable {
    public let scanId: String
    public let error: String
}

public extension JSONEncoder {
    static var promptMemory: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

public extension JSONDecoder {
    static var promptMemory: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
