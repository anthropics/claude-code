import WidgetKit
import Foundation

// MARK: - Timeline Entry

struct ClaudeSessionEntry: TimelineEntry {
    let date: Date
    let session: ClaudeSessionData
    let isPlaceholder: Bool

    static let placeholder = ClaudeSessionEntry(
        date: .now,
        session: .placeholder,
        isPlaceholder: true
    )
}

// MARK: - Timeline Provider

struct ClaudeSessionProvider: TimelineProvider {
    typealias Entry = ClaudeSessionEntry

    func placeholder(in context: Context) -> ClaudeSessionEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (ClaudeSessionEntry) -> Void) {
        let entry = ClaudeSessionEntry(
            date: .now,
            session: loadSession(),
            isPlaceholder: context.isPreview
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ClaudeSessionEntry>) -> Void) {
        let currentDate = Date.now
        let session = loadSession()

        let entry = ClaudeSessionEntry(date: currentDate, session: session, isPlaceholder: false)

        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    // MARK: - Private

    private func loadSession() -> ClaudeSessionData {
        guard
            let defaults = UserDefaults.widgetGroup,
            let data = defaults.data(forKey: "claudeSession"),
            let decoded = try? JSONDecoder().decode(ClaudeSessionData.self, from: data)
        else {
            return .placeholder
        }
        return decoded
    }
}
