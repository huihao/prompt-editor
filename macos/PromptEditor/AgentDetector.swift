import Foundation

/// Represents a detected running code agent
public struct DetectedAgent: Codable, Identifiable {
    public let id: String
    public let name: String
    public let type: AgentType
    public let pid: Int32
    public let terminalApp: String?
    public let windowTitle: String?
    
    public enum AgentType: String, Codable {
        case claude = "claude"
        case kimi = "kimi"
        case codex = "codex"
        case cursor = "cursor"
        case warp = "warp"
        case unknown = "unknown"
    }
    
    public init(id: String, name: String, type: AgentType, pid: Int32, terminalApp: String? = nil, windowTitle: String? = nil) {
        self.id = id
        self.name = name
        self.type = type
        self.pid = pid
        self.terminalApp = terminalApp
        self.windowTitle = windowTitle
    }
}

/// Detects running code agents (Claude Code, Kimi CLI, Codex, etc.)
public enum AgentDetector {
    
    /// Agent process patterns to detect
    private struct AgentPattern {
        let type: DetectedAgent.AgentType
        let keywords: [String]
        let excludeKeywords: [String]
        let displayName: String
    }
    
    private static let agentPatterns: [AgentPattern] = [
        AgentPattern(
            type: .claude,
            keywords: ["claude"],
            excludeKeywords: ["claude-code-helper", "Claude.app"],
            displayName: "Claude Code"
        ),
        AgentPattern(
            type: .kimi,
            keywords: ["kimi-cli", "kimi"],
            excludeKeywords: [],
            displayName: "Kimi CLI"
        ),
        AgentPattern(
            type: .codex,
            keywords: ["codex"],
            excludeKeywords: [],
            displayName: "Codex CLI"
        ),
        AgentPattern(
            type: .cursor,
            keywords: ["cursor"],
            excludeKeywords: ["Cursor.app"],
            displayName: "Cursor Terminal"
        ),
    ]
    
    /// Detect all running code agents
    public static func detectRunningAgents() -> [DetectedAgent] {
        var agents: [DetectedAgent] = []
        let processList = getProcessList()
        
        for pattern in agentPatterns {
            for process in processList {
                if matchesPattern(process, pattern: pattern) {
                    let agent = DetectedAgent(
                        id: "\(pattern.type.rawValue)-\(process.pid)",
                        name: pattern.displayName,
                        type: pattern.type,
                        pid: process.pid,
                        terminalApp: detectTerminalApp(for: process),
                        windowTitle: getWindowTitle(for: process)
                    )
                    // Avoid duplicates
                    if !agents.contains(where: { $0.pid == agent.pid }) {
                        agents.append(agent)
                    }
                }
            }
        }
        
        return agents.sorted { $0.name < $1.name }
    }
    
    /// Check if any code agents are running
    public static func hasRunningAgents() -> Bool {
        return !detectRunningAgents().isEmpty
    }
    
    // MARK: - Private helpers
    
    private struct ProcessInfo {
        let pid: Int32
        let command: String
        let args: [String]
    }
    
    /// Get list of processes with their command lines
    private static func getProcessList() -> [ProcessInfo] {
        var processes: [ProcessInfo] = []
        
        // Use ps command to get process list
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/ps")
        task.arguments = ["-eo", "pid,comm,args"]
        
        let pipe = Pipe()
        task.standardOutput = pipe
        
        do {
            try task.run()
            task.waitUntilExit()
            
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                let lines = output.components(separatedBy: .newlines)
                // Skip header line
                for line in lines.dropFirst() {
                    let trimmed = line.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { continue }
                    
                    // Parse: PID COMMAND ARGS...
                    let components = trimmed.components(separatedBy: .whitespaces)
                    if components.count >= 2,
                       let pid = Int32(components[0]) {
                        let command = components[1]
                        let args = Array(components.dropFirst(2))
                        processes.append(ProcessInfo(pid: pid, command: command, args: args))
                    }
                }
            }
        } catch {
            NSLog("AgentDetector: Failed to get process list: \(error)")
        }
        
        return processes
    }
    
    /// Check if a process matches an agent pattern
    private static func matchesPattern(_ process: ProcessInfo, pattern: AgentPattern) -> Bool {
        let fullCommand = (process.command + " " + process.args.joined(separator: " ")).lowercased()
        
        // Check exclude keywords first
        for exclude in pattern.excludeKeywords {
            if fullCommand.contains(exclude.lowercased()) {
                return false
            }
        }
        
        // Check include keywords
        for keyword in pattern.keywords {
            if fullCommand.contains(keyword.lowercased()) {
                return true
            }
        }
        
        return false
    }
    
    /// Detect which terminal app a process is running in
    private static func detectTerminalApp(for process: ProcessInfo) -> String? {
        // Get parent process info to find terminal
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/ps")
        task.arguments = ["-o", "ppid=", "-p", String(process.pid)]
        
        let pipe = Pipe()
        task.standardOutput = pipe
        
        do {
            try task.run()
            task.waitUntilExit()
            
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let ppidStr = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespaces),
               let ppid = Int32(ppidStr) {
                // Get parent process command
                let parentTask = Process()
                parentTask.executableURL = URL(fileURLWithPath: "/bin/ps")
                parentTask.arguments = ["-o", "comm=", "-p", String(ppid)]
                
                let parentPipe = Pipe()
                parentTask.standardOutput = parentPipe
                
                try parentTask.run()
                parentTask.waitUntilExit()
                
                let parentData = parentPipe.fileHandleForReading.readDataToEndOfFile()
                if let parentComm = String(data: parentData, encoding: .utf8)?.trimmingCharacters(in: .whitespaces) {
                    // Map common terminal apps
                    let terminalNames: [String: String] = [
                        "iTerm2": "iTerm2",
                        "Terminal": "Terminal",
                        "Warp": "Warp",
                        "kitty": "Kitty",
                        "alacritty": "Alacritty",
                        "tmux": "tmux"
                    ]
                    
                    for (key, name) in terminalNames {
                        if parentComm.contains(key) {
                            return name
                        }
                    }
                    return parentComm
                }
            }
        } catch {
            NSLog("AgentDetector: Failed to detect terminal: \(error)")
        }
        
        return nil
    }
    
    /// Get window title for a process (if available)
    private static func getWindowTitle(for process: ProcessInfo) -> String? {
        // This would require accessibility permissions to get window titles
        // For now, return nil as a placeholder
        // Could be implemented using AXUIElementCopyAttributeValue
        return nil
    }
    
    /// Serialize agent list to JSON for JavaScript bridge
    public static func toJSON(_ agents: [DetectedAgent]) -> String? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        do {
            let data = try encoder.encode(agents)
            return String(data: data, encoding: .utf8)
        } catch {
            NSLog("AgentDetector: Failed to encode agents: \(error)")
            return nil
        }
    }
}
