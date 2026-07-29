import Foundation

/// Manages shell integration scripts for terminal capture.
/// Provides install/uninstall functionality and script generation.
public enum ShellIntegrationScripts {
    
    // MARK: - Types
    
    public enum ShellType: String, CaseIterable {
        case zsh = "zsh"
        case bash = "bash"
        case fish = "fish"
        
        public var configFile: String {
            switch self {
            case .zsh: return ".zshrc"
            case .bash: return ".bashrc"
            case .fish: return ".config/fish/config.fish"
            }
        }
        
        public var displayName: String {
            switch self {
            case .zsh: return "Zsh"
            case .bash: return "Bash"
            case .fish: return "Fish"
            }
        }
    }
    
    public struct InstallResult {
        public let shell: ShellType
        public let success: Bool
        public let message: String
    }
    
    // MARK: - Constants
    
    private static let markerStart = "# >>> PromptEditor Shell Integration"
    private static let markerEnd = "# <<< PromptEditor Shell Integration"
    private static let scriptDir = "~/.prompt-editor"
    private static let scriptName = "shell-integration.sh"
    private static let fishScriptName = "shell-integration.fish"
    
    // MARK: - Public API
    
    /// Check if shell integration is installed for a given shell.
    public static func isInstalled(for shell: ShellType) -> Bool {
        let configPath = (resolvePath("~") as NSString).appendingPathComponent(shell.configFile)
        if configPath.isEmpty {
            return false
        }
        guard let content = try? String(contentsOfFile: configPath, encoding: .utf8) else {
            return false
        }
        return content.contains(markerStart)
    }
    
    /// Install shell integration for all detected shells.
    /// - Returns: Array of results for each attempted installation.
    public static func installAll() -> [InstallResult] {
        var results: [InstallResult] = []
        
        for shell in ShellType.allCases {
            // Only install if config file exists or shell is the current one
            let configPath = (resolvePath("~") as NSString).appendingPathComponent(shell.configFile)
            let configExists = !configPath.isEmpty && FileManager.default.fileExists(atPath: configPath)
            let isCurrentShell = currentShell()?.hasPrefix(shell.rawValue) ?? false
            
            if configExists || isCurrentShell {
                let result = install(for: shell)
                results.append(result)
            }
        }
        
        return results
    }
    
    /// Install shell integration for a specific shell.
    public static func install(for shell: ShellType) -> InstallResult {
        // Create script directory
        let scriptDirPath = resolvePath(scriptDir)
        if !FileManager.default.fileExists(atPath: scriptDirPath) {
            do {
                try FileManager.default.createDirectory(
                    atPath: scriptDirPath,
                    withIntermediateDirectories: true,
                    attributes: nil
                )
            } catch {
                return InstallResult(
                    shell: shell,
                    success: false,
                    message: "Failed to create directory \(scriptDirPath): \(error.localizedDescription)"
                )
            }
        }
        
        // Write integration script
        let scriptContent = generateScript(for: shell)
        let scriptFileName = (shell == .fish) ? fishScriptName : scriptName
        let scriptPath = (scriptDirPath as NSString).appendingPathComponent(scriptFileName)
        
        do {
            try scriptContent.write(toFile: scriptPath, atomically: true, encoding: .utf8)
            // Make executable
            chmod(scriptPath, 0o755)
        } catch {
            return InstallResult(
                shell: shell,
                success: false,
                message: "Failed to write script: \(error.localizedDescription)"
            )
        }
        
        // Add source line to shell config
        let configPath = (resolvePath("~") as NSString).appendingPathComponent(shell.configFile)
        if configPath.isEmpty {
            return InstallResult(
                shell: shell,
                success: false,
                message: "Could not resolve config file path"
            )
        }
        
        // Create config file if it doesn't exist (for current shell)
        if !FileManager.default.fileExists(atPath: configPath) {
            FileManager.default.createFile(atPath: configPath, contents: nil, attributes: nil)
        }
        
        guard var configContent = try? String(contentsOfFile: configPath, encoding: .utf8) else {
            return InstallResult(
                shell: shell,
                success: false,
                message: "Could not read config file \(configPath)"
            )
        }
        
        // Remove existing integration first (to handle updates)
        configContent = removeIntegration(from: configContent)
        
        // Append new integration block
        let sourceLine: String
        if shell == .fish {
            sourceLine = "source \(scriptPath)"
        } else {
            sourceLine = "source \"\(scriptPath)\""
        }
        
        let integrationBlock = """
        \(markerStart)
        # This block is managed by PromptEditor. Do not edit manually.
        # Remove this block to uninstall.
        \(sourceLine)
        \(markerEnd)
        """
        
        configContent += "\n" + integrationBlock + "\n"
        
        do {
            try configContent.write(toFile: configPath, atomically: true, encoding: .utf8)
        } catch {
            return InstallResult(
                shell: shell,
                success: false,
                message: "Failed to update config file: \(error.localizedDescription)"
            )
        }
        
        return InstallResult(
            shell: shell,
            success: true,
            message: "Installed in \(configPath)"
        )
    }
    
    /// Uninstall shell integration from all shells.
    public static func uninstallAll() -> [InstallResult] {
        var results: [InstallResult] = []
        
        for shell in ShellType.allCases {
            let result = uninstall(for: shell)
            results.append(result)
        }
        
        // Remove script directory
        let scriptDirPath = resolvePath(scriptDir)
        if FileManager.default.fileExists(atPath: scriptDirPath) {
            try? FileManager.default.removeItem(atPath: scriptDirPath)
        }
        
        return results
    }
    
    /// Uninstall shell integration from a specific shell.
    public static func uninstall(for shell: ShellType) -> InstallResult {
        let configPath = (resolvePath("~") as NSString).appendingPathComponent(shell.configFile)
        guard !configPath.isEmpty,
              FileManager.default.fileExists(atPath: configPath),
              var configContent = try? String(contentsOfFile: configPath, encoding: .utf8) else {
            return InstallResult(
                shell: shell,
                success: true,
                message: "No config file found, nothing to uninstall"
            )
        }
        
        let hadIntegration = configContent.contains(markerStart)
        configContent = removeIntegration(from: configContent)
        
        do {
            try configContent.write(toFile: configPath, atomically: true, encoding: .utf8)
        } catch {
            return InstallResult(
                shell: shell,
                success: false,
                message: "Failed to update config file: \(error.localizedDescription)"
            )
        }
        
        return InstallResult(
            shell: shell,
            success: true,
            message: hadIntegration ? "Removed from \(configPath)" : "No integration found in \(configPath)"
        )
    }
    
    /// Generate the standalone integration script content.
    public static func generateScript(for shell: ShellType) -> String {
        switch shell {
        case .zsh: return zshScript
        case .bash: return bashScript
        case .fish: return fishScript
        }
    }
    
    // MARK: - Private Helpers
    
    private static func resolvePath(_ path: String) -> String {
        let expanded = path.replacingOccurrences(of: "~", with: NSHomeDirectory())
        return (expanded as NSString).standardizingPath
    }
    
    private static func currentShell() -> String? {
        let task = Process()
        task.launchPath = "/bin/ps"
        task.arguments = ["-p", String(getppid()), "-o", "comm="]
        let pipe = Pipe()
        task.standardOutput = pipe
        try? task.run()
        task.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private static func removeIntegration(from content: String) -> String {
        guard let startRange = content.range(of: markerStart),
              let endRange = content.range(of: markerEnd) else {
            return content
        }
        
        // Remove from markerStart to end of markerEnd line
        let fullEnd = content.index(endRange.upperBound, offsetBy: 0)
        var endLine = fullEnd
        if let newline = content[fullEnd...].range(of: "\n") {
            endLine = newline.upperBound
        }
        
        var result = content
        result.removeSubrange(startRange.lowerBound..<endLine)
        return result
    }
    
    // MARK: - Script Templates
    
    private static var commonHeader: String {
        """
        #!/usr/bin/env bash
        # PromptEditor Shell Integration
        # Auto-generated. Do not edit manually.
        #
        # This script sends terminal context to PromptEditor via Unix domain socket.
        # It only activates when PromptEditor is running.
        
        PROMPT_EDITOR_SOCK="/tmp/prompt-editor.sock"
        PROMPT_EDITOR_MAX_LINES=500
        PROMPT_EDITOR_ENABLED=1
        
        _prompt_editor_running() {
            [[ -S "$PROMPT_EDITOR_SOCK" ]]
        }
        
        _prompt_editor_send() {
            local msg="$1"
            if _prompt_editor_running; then
                printf '%s' "$msg" | nc -U "$PROMPT_EDITOR_SOCK" 2>/dev/null || true
            fi
        }
        
        _prompt_editor_cwd() {
            if _prompt_editor_running; then
                _prompt_editor_send "CWD:$(pwd)"
            fi
        }
        """
    }
    
    private static var zshScript: String {
        commonHeader + "\n" + """
        
        # --- zsh-specific hooks ---
        
        _prompt_editor_preexec() {
            local cmd="$1"
            _prompt_editor_cmd_start_time=$(date +%s)
            _prompt_editor_last_cmd="$cmd"
            _prompt_editor_send "CMD:$cmd"
        }
        
        _prompt_editor_precmd() {
            local exit_code=$?
            local output=""
            
            # Try tmux first (most reliable)
            if [[ -n "$TMUX" ]]; then
                output=$(tmux capture-pane -p -S - 2>/dev/null | tail -n "$PROMPT_EDITOR_MAX_LINES")
            fi
            
            # Send command finished event with output
            if [[ -n "$_prompt_editor_last_cmd" ]]; then
                if [[ -n "$output" ]]; then
                    _prompt_editor_send "FINISHED:$exit_code\\n$_prompt_editor_last_cmd\\n$output"
                else
                    _prompt_editor_send "FINISHED:$exit_code\\n$_prompt_editor_last_cmd"
                fi
            fi
            
            # Send CWD
            _prompt_editor_cwd
            
            unset _prompt_editor_last_cmd
        }
        
        # Register hooks (only if not already registered)
        if (( ! ${+precmd_functions} )); then
            typeset -ga precmd_functions
        fi
        if (( ! ${+preexec_functions} )); then
            typeset -ga preexec_functions
        fi
        
        if [[ "${precmd_functions[(r)_prompt_editor_precmd]}" != "_prompt_editor_precmd" ]]; then
            precmd_functions+=(_prompt_editor_precmd)
        fi
        if [[ "${preexec_functions[(r)_prompt_editor_preexec]}" != "_prompt_editor_preexec" ]]; then
            preexec_functions+=(_prompt_editor_preexec)
        fi
        """
    }
    
    private static var bashScript: String {
        commonHeader + "\n" + """
        
        # --- bash-specific hooks ---
        
        _prompt_editor_preexec() {
            local cmd="$BASH_COMMAND"
            _prompt_editor_cmd_start_time=$(date +%s)
            _prompt_editor_last_cmd="$cmd"
            _prompt_editor_send "CMD:$cmd"
        }
        
        _prompt_editor_precmd() {
            local exit_code=$?
            local output=""
            
            # Try tmux first
            if [[ -n "$TMUX" ]]; then
                output=$(tmux capture-pane -p -S - 2>/dev/null | tail -n "$PROMPT_EDITOR_MAX_LINES")
            fi
            
            # Send command finished event with output
            if [[ -n "$_prompt_editor_last_cmd" ]]; then
                if [[ -n "$output" ]]; then
                    _prompt_editor_send "FINISHED:$exit_code\\n$_prompt_editor_last_cmd\\n$output"
                else
                    _prompt_editor_send "FINISHED:$exit_code\\n$_prompt_editor_last_cmd"
                fi
            fi
            
            _prompt_editor_cwd
            unset _prompt_editor_last_cmd
        }
        
        # Use DEBUG trap for preexec and PROMPT_COMMAND for precmd
        if [[ "$PROMPT_COMMAND" != *"_prompt_editor_precmd"* ]]; then
            PROMPT_COMMAND="_prompt_editor_precmd${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
        fi
        
        # DEBUG trap to capture command
        if [[ "$(trap -p DEBUG)" != *"_prompt_editor_preexec"* ]]; then
            trap '_prompt_editor_preexec' DEBUG
        fi
        """
    }
    
    private static var fishScript: String {
        """
        #!/usr/bin/env fish
        # PromptEditor Shell Integration for Fish
        # Auto-generated. Do not edit manually.
        
        set -gx PROMPT_EDITOR_SOCK "/tmp/prompt-editor.sock"
        set -gx PROMPT_EDITOR_MAX_LINES 500
        
        function _prompt_editor_running
            test -S "$PROMPT_EDITOR_SOCK"
        end
        
        function _prompt_editor_send --argument msg
            if _prompt_editor_running
                printf '%s' "$msg" | nc -U "$PROMPT_EDITOR_SOCK" 2>/dev/null
            end
        end
        
        function _prompt_editor_cwd
            if _prompt_editor_running
                _prompt_editor_send "CWD:"(pwd)
            end
        end
        
        function _prompt_editor_preexec --on-event fish_preexec
            set -g _prompt_editor_last_cmd "$argv"
            _prompt_editor_send "CMD:$argv"
        end
        
        function _prompt_editor_precmd --on-event fish_prompt
            set -l exit_code $status
            set -l output ""
            
            # Try tmux
            if test -n "$TMUX"
                set output (tmux capture-pane -p -S - 2>/dev/null | tail -n $PROMPT_EDITOR_MAX_LINES)
            end
            
            if set -q _prompt_editor_last_cmd
                if test -n "$output"
                    _prompt_editor_send "FINISHED:$exit_code\\n$_prompt_editor_last_cmd\\n$output"
                else
                    _prompt_editor_send "FINISHED:$exit_code\\n$_prompt_editor_last_cmd"
                end
            end
            
            _prompt_editor_cwd
            set -e _prompt_editor_last_cmd
        end
        """
    }
}
