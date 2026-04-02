import Foundation

struct SnippetData: Codable {
    let version: String
    let categories: [SnippetCategory]
}

struct SnippetCategory: Codable {
    let id: String
    let name: String
    let icon: String
    let description: String
    let subcategories: [SnippetCategory]?
    let snippets: [SnippetItem]?
}

struct SnippetItem: Codable {
    let id: String
    let name: String
    let description: String
    let content: String
}

/// Simple snippet data manager for the wheel
class SnippetDataManager {
    static let shared = SnippetDataManager()
    private var data: SnippetData?
    
    func loadData() {
        guard data == nil else { return }
        
        // Try to load from bundled resources
        if let url = Bundle.main.url(forResource: "snippets", withExtension: "json", subdirectory: "data") {
            do {
                let jsonData = try Data(contentsOf: url)
                data = try JSONDecoder().decode(SnippetData.self, from: jsonData)
                print("[SnippetDataManager] Loaded snippets from bundle")
                return
            } catch {
                print("[SnippetDataManager] Failed to load from bundle: \(error)")
            }
        }
        
        // Fallback: load from editor/dist/data
        let paths = [
            "../editor/dist/data/snippets.json",
            "../../editor/dist/data/snippets.json",
            "../../../editor/dist/data/snippets.json",
        ]
        
        let fm = FileManager.default
        for path in paths {
            let fullPath = (fm.currentDirectoryPath as NSString).appendingPathComponent(path)
            let resolved = (fullPath as NSString).standardizingPath
            if fm.fileExists(atPath: resolved) {
                do {
                    let url = URL(fileURLWithPath: resolved)
                    let jsonData = try Data(contentsOf: url)
                    data = try JSONDecoder().decode(SnippetData.self, from: jsonData)
                    print("[SnippetDataManager] Loaded snippets from: \(resolved)")
                    return
                } catch {
                    print("[SnippetDataManager] Failed to load from \(resolved): \(error)")
                }
            }
        }
        
        print("[SnippetDataManager] Could not find snippets.json")
    }
    
    func toJSON() -> String {
        loadData()
        guard let data = data else {
            return "{\"version\":\"1.0\",\"categories\":[]}"
        }
        
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            let jsonData = try encoder.encode(data)
            return String(data: jsonData, encoding: .utf8) ?? "{\"version\":\"1.0\",\"categories\":[]}"
        } catch {
            print("[SnippetDataManager] Failed to encode: \(error)")
            return "{\"version\":\"1.0\",\"categories\":[]}"
        }
    }
}

// Global instance for MainWindow access
let snippetManager = SnippetDataManager.shared
