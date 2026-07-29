import Foundation

/// IPC message types sent from shell integration scripts
public enum TerminalCaptureMessage: Equatable {
    /// Full pane output from tmux capture-pane or terminal log
    case output(content: String)
    /// Current working directory
    case cwd(path: String)
    /// Command about to execute
    case command(cmd: String)
    /// Command finished with exit code
    case commandFinished(cmd: String, exitCode: Int, output: String)
    /// Terminal size info
    case size(rows: Int, cols: Int)
    /// Unknown/unsupported message
    case unknown(raw: String)
}

/// Unix domain socket server that receives terminal output from shell hooks.
/// Runs on a background thread and delivers parsed messages via callback.
public final class TerminalCaptureServer {
    
    // MARK: - Constants
    
    private let socketPath: String
    private let maxOutputLines: Int
    private let maxOutputBytes: Int
    
    // MARK: - State
    
    private var socketFd: Int32 = -1
    private var isRunning = false
    private let queue = DispatchQueue(label: "com.prompteditor.terminal-capture", qos: .utility)
    private var onMessage: ((TerminalCaptureMessage) -> Void)?
    
    // MARK: - Initialization
    
    /// Initialize the server with a specific socket path and output limits.
    /// - Parameters:
    ///   - socketPath: Path to the Unix domain socket. Defaults to `/tmp/prompt-editor.sock`
    ///   - maxOutputLines: Maximum number of lines to accept per message. Excess is truncated from the top.
    ///   - maxOutputBytes: Maximum byte size per message. Excess is truncated.
    public init(
        socketPath: String = "/tmp/prompt-editor.sock",
        maxOutputLines: Int = 500,
        maxOutputBytes: Int = 262144 // 256KB
    ) {
        self.socketPath = socketPath
        self.maxOutputLines = maxOutputLines
        self.maxOutputBytes = maxOutputBytes
    }
    
    deinit {
        stop()
    }
    
    // MARK: - Public API
    
    /// Start the socket server. Must be called before shell hooks can connect.
    /// - Parameter handler: Callback invoked for each parsed message.
    public func start(handler: @escaping (TerminalCaptureMessage) -> Void) {
        guard !isRunning else { return }
        isRunning = true
        onMessage = handler
        
        queue.async { [weak self] in
            self?.runServer()
        }
    }
    
    /// Stop the server and clean up the socket file.
    public func stop() {
        isRunning = false
        if socketFd >= 0 {
            close(socketFd)
            socketFd = -1
        }
        unlink(socketPath)
        onMessage = nil
    }
    
    /// Check if the server is currently accepting connections.
    public var running: Bool {
        isRunning && socketFd >= 0
    }
    
    // MARK: - Private
    
    private func runServer() {
        // Clean up any stale socket
        unlink(socketPath)
        
        // Create socket
        socketFd = socket(AF_UNIX, SOCK_STREAM, 0)
        guard socketFd >= 0 else {
            NSLog("TerminalCaptureServer: Failed to create socket")
            isRunning = false
            return
        }
        
        // Set non-blocking mode for clean shutdown
        var flags = fcntl(socketFd, F_GETFL, 0)
        fcntl(socketFd, F_SETFL, flags | O_NONBLOCK)
        
        // Bind to Unix domain socket
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let pathLen = min(socketPath.utf8.count, MemoryLayout.size(ofValue: addr.sun_path) - 1)
        socketPath.withCString { src in
            memcpy(&addr.sun_path, src, pathLen)
        }
        
        let bindResult = withUnsafePointer(to: &addr) { ptr -> Int32 in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                bind(socketFd, sockaddrPtr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        
        guard bindResult == 0 else {
            NSLog("TerminalCaptureServer: Failed to bind socket: \(errno)")
            close(socketFd)
            socketFd = -1
            isRunning = false
            return
        }
        
        // Set socket permissions so any user process can write
        chmod(socketPath, 0o777)
        
        // Listen for connections
        guard listen(socketFd, 5) == 0 else {
            NSLog("TerminalCaptureServer: Failed to listen on socket")
            close(socketFd)
            socketFd = -1
            isRunning = false
            return
        }
        
        NSLog("TerminalCaptureServer: Listening on \(socketPath)")
        
        // Accept loop
        while isRunning {
            let clientFd = accept(socketFd, nil, nil)
            guard clientFd >= 0 else {
                if errno == EAGAIN || errno == EWOULDBLOCK {
                    // No pending connections, sleep briefly
                    usleep(10000) // 10ms
                    continue
                }
                if isRunning {
                    NSLog("TerminalCaptureServer: Accept error: \(errno)")
                }
                continue
            }
            
            handleClient(clientFd)
        }
        
        // Cleanup
        close(socketFd)
        socketFd = -1
        unlink(socketPath)
        NSLog("TerminalCaptureServer: Stopped")
    }
    
    private func handleClient(_ clientFd: Int32) {
        defer { close(clientFd) }
        
        var data = Data()
        let bufferSize = 65536
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        
        // Read all available data
        while true {
            let n = read(clientFd, &buffer, bufferSize)
            if n > 0 {
                data.append(buffer, count: n)
            } else {
                break
            }
        }
        
        guard !data.isEmpty,
              let rawString = String(data: data, encoding: .utf8) else {
            return
        }
        
        // Parse and deliver message
        let message = parseMessage(rawString)
        DispatchQueue.main.async { [weak self] in
            self?.onMessage?(message)
        }
    }
    
    // MARK: - Message Parsing
    
    /// Parse raw message from shell hook.
    /// Format: `<TYPE>\n<CONTENT>` or `<TYPE>:<META>\n<CONTENT>`
    private func parseMessage(_ raw: String) -> TerminalCaptureMessage {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .unknown(raw: raw) }
        
        // Check for typed messages (first line is header)
        let lines = trimmed.components(separatedBy: .newlines)
        guard let header = lines.first else { return .unknown(raw: raw) }
        
        let content = lines.dropFirst().joined(separator: "\n")
        
        if header == "OUTPUT" {
            return .output(content: truncate(content))
        } else if header.hasPrefix("CWD:") {
            let path = String(header.dropFirst(4))
            return .cwd(path: path)
        } else if header.hasPrefix("CMD:") {
            let cmd = String(header.dropFirst(4))
            return .command(cmd: cmd)
        } else if header.hasPrefix("FINISHED:") {
            // Format: FINISHED:<exit_code>\n<cmd>\n<output>
            let meta = String(header.dropFirst(9))
            let rest = lines.dropFirst()
            if let exitCode = Int(meta),
               let cmdLine = rest.first {
                let output = rest.dropFirst().joined(separator: "\n")
                return .commandFinished(cmd: cmdLine, exitCode: exitCode, output: truncate(output))
            }
        } else if header.hasPrefix("SIZE:") {
            let dims = header.dropFirst(5).components(separatedBy: ",")
            if dims.count == 2,
               let rows = Int(dims[0]),
               let cols = Int(dims[1]) {
                return .size(rows: rows, cols: cols)
            }
        }
        
        // Fallback: treat entire message as raw output
        return .output(content: truncate(trimmed))
    }
    
    // MARK: - Truncation
    
    private func truncate(_ content: String) -> String {
        var result = content
        
        // Truncate by lines (remove from top)
        let lines = result.components(separatedBy: .newlines)
        if lines.count > maxOutputLines {
            let trimmed = lines.suffix(maxOutputLines).joined(separator: "\n")
            result = trimmed
        }
        
        // Truncate by bytes (remove from end to avoid splitting multi-byte chars)
        if result.utf8.count > maxOutputBytes {
            let prefix = String(result.prefix(maxOutputBytes))
            result = prefix + "\n...[truncated]"
        }
        
        return result
    }
}

// MARK: - Terminal Context Model

/// Aggregated terminal context from shell hooks
public struct TerminalContext: Codable, Equatable {
    /// Current working directory
    public var currentDirectory: String?
    /// Last executed command
    public var lastCommand: String?
    /// Last command exit code
    public var lastExitCode: Int?
    /// Recent terminal output (last N lines)
    public var recentOutput: String?
    /// Timestamp of last update
    public var lastUpdated: Date?
    
    public init(
        currentDirectory: String? = nil,
        lastCommand: String? = nil,
        lastExitCode: Int? = nil,
        recentOutput: String? = nil,
        lastUpdated: Date? = nil
    ) {
        self.currentDirectory = currentDirectory
        self.lastCommand = lastCommand
        self.lastExitCode = lastExitCode
        self.recentOutput = recentOutput
        self.lastUpdated = lastUpdated
    }
    
    /// Serialize to JSON string for JavaScript bridge
    public func toJSON() -> String? {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .sortedKeys
        guard let data = try? encoder.encode(self) else { return nil }
        return String(data: data, encoding: .utf8)
    }
    
    /// Empty context
    public static let empty = TerminalContext()
}
