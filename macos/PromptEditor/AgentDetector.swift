import Foundation

/// Represents a detected running code agent
public struct DetectedAgent: Codable, Identifiable {
    public let id: String
    public let name: String
    public let type: AgentType
    public let pid: Int32
    public let terminalApp: String?
    public let windowTitle: String?
    public let workingDirectory: String?
    
    public enum AgentType: String, Codable {
        case claude = "claude"
        case kimi = "kimi"
        case codex = "codex"
        case cursor = "cursor"
        case warp = "warp"
        case unknown = "unknown"
    }
    
    public init(id: String, name: String, type: AgentType, pid: Int32, terminalApp: String? = nil, windowTitle: String? = nil, workingDirectory: String? = nil) {
        self.id = id
        self.name = name
        self.type = type
        self.pid = pid
        self.terminalApp = terminalApp
        self.windowTitle = windowTitle
        self.workingDirectory = workingDirectory
    }
}

/// Detects running code agents (Claude Code, Kimi CLI, Codex, etc.)
/// All detection methods are async to avoid blocking the main thread
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
    
    /// Detect all running code agents asynchronously
    /// This method runs on a background queue to avoid blocking the main thread
    public static func detectRunningAgents() async -> [DetectedAgent] {
        print("[AgentDetector] detectRunningAgents called")
        // Use continuation for cleaner async/await
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .utility).async {
                print("[AgentDetector] Running detection on background thread")
                let agents = Self.detectRunningAgentsSync()
                print("[AgentDetector] Found \(agents.count) agents")
                continuation.resume(returning: agents)
            }
        }
    }
    
    /// Synchronous version - runs on background thread only
    private static func detectRunningAgentsSync() -> [DetectedAgent] {
        print("[AgentDetector] detectRunningAgentsSync started")
        var agents: [DetectedAgent] = []
        let processList = getProcessList()
        print("[AgentDetector] Got \(processList.count) processes")
        
        for pattern in agentPatterns {
            for process in processList {
                if matchesPattern(process, pattern: pattern) {
                    let terminalApp = detectTerminalApp(for: process)
                    let workingDir = detectWorkingDirectory(for: process)
                    let agent = DetectedAgent(
                        id: "\(pattern.type.rawValue)-\(process.pid)",
                        name: pattern.displayName,
                        type: pattern.type,
                        pid: process.pid,
                        terminalApp: terminalApp,
                        windowTitle: nil,
                        workingDirectory: workingDir
                    )
                    // Avoid duplicates
                    if !agents.contains(where: { $0.pid == agent.pid }) {
                        agents.append(agent)
                    }
                }
            }
        }
        
        return agents.sorted { 
            if $0.type.rawValue == $1.type.rawValue {
                return ($0.workingDirectory ?? "") < ($1.workingDirectory ?? "")
            }
            return $0.name < $1.name 
        }
    }
    
    /// Check if any code agents are running (async version)
    public static func hasRunningAgents() async -> Bool {
        let agents = await detectRunningAgents()
        return !agents.isEmpty
    }
    
    // MARK: - Private helpers
    
    private struct ProcessInfo {
        let pid: Int32
        let command: String
        let args: [String]
    }
    
    /// Get list of processes synchronously using Process
    private static func getProcessList() -> [ProcessInfo] {
        var processes: [ProcessInfo] = []
        
        // Use ps command to get process list
        let task = Process()
        task.launchPath = "/bin/ps"
        task.arguments = ["-eo", "pid,comm,args"]
        
        let pipe = Pipe()
        task.standardOutput = pipe
        
        // Capture data in a local variable that will be modified in the handler
        var outputData = Data()
        let dataLock = NSLock()
        
        pipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            dataLock.lock()
            outputData.append(data)
            dataLock.unlock()
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        task.terminationHandler = { _ in
            // Give a small delay for final data to arrive
            Thread.sleep(forTimeInterval: 0.05)
            semaphore.signal()
        }
        
        do {
            try task.run()
            
            // Wait with timeout
            let result = semaphore.wait(timeout: .now() + 3)
            if result == .timedOut {
                task.terminate()
                pipe.fileHandleForReading.readabilityHandler = nil
                return processes
            }
            
            pipe.fileHandleForReading.readabilityHandler = nil
            
            // Use lossy string decoding to handle invalid UTF-8 bytes
            let output = String(decoding: outputData, as: UTF8.self)
            
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
    
    /// Detect which terminal app a process is running in (synchronous, call from background task only)
    private static func detectTerminalApp(for process: ProcessInfo) -> String? {
        // Get parent process info to find terminal using non-blocking approach
        guard let ppidStr = runProcessCommand(executable: "/bin/ps", arguments: ["-o", "ppid=", "-p", String(process.pid)]),
              let ppid = Int32(ppidStr) else {
            return nil
        }
        
        // Get parent process command
        guard let parentComm = runProcessCommand(executable: "/bin/ps", arguments: ["-o", "comm=", "-p", String(ppid)]) else {
            return nil
        }
        
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
    
    /// Helper to run a process command with timeout
    private static func runProcessCommand(executable: String, arguments: [String]) -> String? {
        let task = Process()
        task.launchPath = executable
        task.arguments = arguments
        
        let pipe = Pipe()
        task.standardOutput = pipe
        
        var outputData = Data()
        let dataLock = NSLock()
        
        pipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            dataLock.lock()
            outputData.append(data)
            dataLock.unlock()
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        task.terminationHandler = { _ in
            Thread.sleep(forTimeInterval: 0.05)
            semaphore.signal()
        }
        
        do {
            try task.run()
            
            let result = semaphore.wait(timeout: .now() + 2)
            if result == .timedOut {
                task.terminate()
                pipe.fileHandleForReading.readabilityHandler = nil
                return nil
            }
            
            pipe.fileHandleForReading.readabilityHandler = nil
            
            let output = String(decoding: outputData, as: UTF8.self).trimmingCharacters(in: .whitespaces)
            return output.isEmpty ? nil : output
        } catch {
            return nil
        }
    }
    
    /// Detect working directory of a process using lsof
    private static func detectWorkingDirectory(for process: ProcessInfo) -> String? {
        // Try to get working directory using lsof
        let task = Process()
        task.launchPath = "/usr/sbin/lsof"
        task.arguments = ["-a", "-d", "cwd", "-p", String(process.pid), "-Fn"]
        
        let pipe = Pipe()
        task.standardOutput = pipe
        
        do {
            try task.run()
            task.waitUntilExit()
            
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                // lsof output format: n/path/to/directory
                for line in output.components(separatedBy: .newlines) {
                    if line.hasPrefix("n") {
                        let path = String(line.dropFirst())
                        // Return last component for brevity, or full path if short
                        if path.count > 30 {
                            let components = path.components(separatedBy: "/")
                            if components.count > 2 {
                                return ".../" + components.suffix(2).joined(separator: "/")
                            }
                        }
                        return path
                    }
                }
            }
        } catch {
            // lsof might fail for some processes, that's ok
        }
        
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
