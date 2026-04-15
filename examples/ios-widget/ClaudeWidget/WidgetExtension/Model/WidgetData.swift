import Foundation

// MARK: - Widget Data Models

struct ClaudeSessionData: Codable {
    let totalSessions: Int
    let linesChanged: Int
    let filesEdited: Int
    let tasksCompleted: Int
    let lastActive: Date
    let activeProject: String
    let modelUsed: String

    static let placeholder = ClaudeSessionData(
        totalSessions: 42,
        linesChanged: 1_337,
        filesEdited: 28,
        tasksCompleted: 15,
        lastActive: .now,
        activeProject: "claude-code",
        modelUsed: "claude-sonnet-4-6"
    )

    static let empty = ClaudeSessionData(
        totalSessions: 0,
        linesChanged: 0,
        filesEdited: 0,
        tasksCompleted: 0,
        lastActive: .now,
        activeProject: "–",
        modelUsed: "–"
    )
}

struct ClaudeStatusData: Codable {
    let isConnected: Bool
    let apiStatus: APIStatus
    let currentModel: String
    let remainingTokens: Int?
    let lastUpdated: Date

    enum APIStatus: String, Codable {
        case operational = "Operational"
        case degraded = "Degraded"
        case outage = "Outage"

        var color: String {
            switch self {
            case .operational: return "green"
            case .degraded:    return "yellow"
            case .outage:      return "red"
            }
        }
    }

    static let placeholder = ClaudeStatusData(
        isConnected: true,
        apiStatus: .operational,
        currentModel: "claude-sonnet-4-6",
        remainingTokens: 45_000,
        lastUpdated: .now
    )
}

// MARK: - Shared App Group

extension UserDefaults {
    static let widgetGroup = UserDefaults(
        suiteName: "group.com.anthropic.claude-code.widget"
    )
}
