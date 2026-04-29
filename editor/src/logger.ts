// Logger Utility - Writes logs to local file for debugging in WKWebView
// Since console.log is not visible in macOS app, we need file-based logging

class Logger {
  private logs: string[] = [];
  private maxLogs = 1000;
  private logKey = 'prompt-editor-logs';

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    try {
      const stored = localStorage.getItem(this.logKey);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      this.logs = [];
    }
  }

  private saveLogs(): void {
    try {
      // Keep only recent logs to avoid storage limits
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      localStorage.setItem(this.logKey, JSON.stringify(this.logs));
    } catch (error) {
      // Storage full, clear old logs
      this.logs = this.logs.slice(-100);
      try {
        localStorage.setItem(this.logKey, JSON.stringify(this.logs));
      } catch (e) {
        // Still failing, just keep in memory
      }
    }
  }

  log(level: string, category: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level}] [${category}] ${message}`;

    if (data !== undefined) {
      try {
        logEntry += ` | Data: ${JSON.stringify(data, null, 2)}`;
      } catch (e) {
        logEntry += ` | Data: [Circular or non-serializable]`;
      }
    }

    this.logs.push(logEntry);
    this.saveLogs();

    // Also log to console for debugging in browser
    console.log(logEntry);
  }

  info(category: string, message: string, data?: any): void {
    this.log('INFO', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log('ERROR', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log('WARN', category, message, data);
  }

  debug(category: string, message: string, data?: any): void {
    this.log('DEBUG', category, message, data);
  }

  // Get all logs as text
  getAllLogs(): string {
    return this.logs.join('\n');
  }

  // Get recent logs (last N entries)
  getRecentLogs(count: number = 50): string {
    return this.logs.slice(-count).join('\n');
  }

  // Clear all logs
  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem(this.logKey);
  }

  // Export logs as downloadable file
  exportLogs(): void {
    const logsText = this.getAllLogs();
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-editor-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const logger = new Logger();
export default logger;